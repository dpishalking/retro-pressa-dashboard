import {
  CUTOVER_MATCHED_DAYS_REQUIRED,
  DUAL_RUN_METRICS,
  SALES_CUTOVER_READINESS_COLUMNS,
  SALES_CUTOVER_READINESS_TAB,
  SALES_OS_DAILY_TAB,
  SALES_RECONCILIATION_COLUMNS,
  SALES_RECONCILIATION_TAB,
  getMotherSpreadsheetId,
  type DualRunMetricId
} from "@/config/sales-dual-run";
import { OS_TABS } from "@/config/os-sheets";
import { salesDailyRowFromSheetLine, type SalesDailyRow } from "@/lib/os-sheets/sales-mapper";
import { ordersRowFromSheetLine, type OrdersRow } from "@/lib/os-sheets/orders-mapper";
import {
  dayKeyFromIso,
  isSalesFunnelDeal,
  parseSheetNumber
} from "@/lib/os-sheets/sales-metric-defs";
import { safeReplaceSheet } from "@/lib/os-sheets/safe-write";
import { withSyncRun } from "@/lib/os-sheets/sync-runs";
import { readGoogleServiceAccount, readSheetValues } from "@/lib/google/sheets-client";

export type ReconStatus =
  | "matched"
  | "within_tolerance"
  | "expected_difference"
  | "mismatch"
  | "pending_definition"
  | "stale_source"
  | "missing_legacy"
  | "missing_sales_os";

export type ReconRow = Record<(typeof SALES_RECONCILIATION_COLUMNS)[number], string>;
export type CutoverRow = Record<(typeof SALES_CUTOVER_READINESS_COLUMNS)[number], string>;

function quoteTab(title: string) {
  return `'${title.replace(/'/g, "''")}'`;
}

function num(value: string | number | null | undefined): number {
  return parseSheetNumber(value);
}

function periodOfDate(date: string): string {
  return date.slice(0, 7);
}

function weekOfDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(d.getTime())) return "";
  const onejan = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d.getTime() - onejan.getTime()) / 86400000) + onejan.getUTCDay() + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function classifyMetricDelta(input: {
  metricId: DualRunMetricId;
  legacyValue: number | null;
  salesOsValue: number | null;
  absoluteTolerance: number;
  relativeTolerancePct: number;
  definitionStatus: string;
  blocksCutover: boolean;
}): { status: ReconStatus; delta: number | null; deltaPct: number | null; reason: string } {
  if (input.definitionStatus === "pending_review" || input.definitionStatus === "different_definition") {
    if (input.legacyValue == null && input.salesOsValue != null) {
      return { status: "pending_definition", delta: null, deltaPct: null, reason: "definition not aligned; legacy missing or different grain" };
    }
    if (!input.blocksCutover) {
      return {
        status: input.definitionStatus === "different_definition" ? "expected_difference" : "pending_definition",
        delta: input.legacyValue != null && input.salesOsValue != null ? input.salesOsValue - input.legacyValue : null,
        deltaPct: null,
        reason: "definitions pending review"
      };
    }
  }

  if (input.legacyValue == null && input.salesOsValue == null) {
    return { status: "matched", delta: 0, deltaPct: 0, reason: "both empty" };
  }
  if (input.legacyValue == null) {
    return { status: "missing_legacy", delta: null, deltaPct: null, reason: "legacy value missing" };
  }
  if (input.salesOsValue == null) {
    return { status: "missing_sales_os", delta: null, deltaPct: null, reason: "sales os value missing" };
  }

  const delta = input.salesOsValue - input.legacyValue;
  const abs = Math.abs(delta);
  const denom = Math.abs(input.legacyValue);
  const deltaPct = denom === 0 ? (abs === 0 ? 0 : 100) : (abs / denom) * 100;

  if (abs <= input.absoluteTolerance || deltaPct <= input.relativeTolerancePct) {
    return {
      status: abs === 0 ? "matched" : "within_tolerance",
      delta,
      deltaPct,
      reason: abs === 0 ? "exact match" : "within configured tolerance"
    };
  }

  return {
    status: "mismatch",
    delta,
    deltaPct,
    reason: "outside tolerance"
  };
}

type Agg = Record<DualRunMetricId, number> & { managers: Set<string> };

function emptyAgg(): Agg {
  return {
    leads: 0,
    deals: 0,
    invoice_events: 0,
    payments: 0,
    paid_revenue: 0,
    active_deals: 0,
    active_pipeline_amount: 0,
    manager_count: 0,
    managers: new Set()
  };
}

function readMap(values: string[][]): Array<Record<string, string>> {
  if (!values.length) return [];
  const [header, ...lines] = values;
  const keys = header.map((cell) => String(cell ?? "").trim());
  return lines.map((line) => {
    const row: Record<string, string> = {};
    keys.forEach((key, index) => {
      if (!key) return;
      row[key] = String(line[index] ?? "").trim();
    });
    return row;
  }).filter((row) => Object.values(row).some(Boolean));
}

export function buildReconciliationRows(input: {
  legacySales: SalesDailyRow[];
  salesOsDaily: Array<Record<string, string>>;
  orders: OrdersRow[];
  periods: string[];
  checkedAt: string;
}): ReconRow[] {
  const legacyByKey = new Map<string, Agg>();
  const candidateByKey = new Map<string, Agg>();

  const bump = (map: Map<string, Agg>, periodType: string, period: string, managerId: string) => {
    const key = `${periodType}|${period}|${managerId || "_all"}`;
    let row = map.get(key);
    if (!row) {
      row = emptyAgg();
      map.set(key, row);
    }
    return row;
  };

  const trackManager = (map: Map<string, Agg>, periodType: string, period: string, managerId: string) => {
    if (!managerId) return;
    bump(map, periodType, period, managerId).managers.add(managerId);
    bump(map, periodType, period, "").managers.add(managerId);
  };

  const touchPeriods = (date: string, managerId: string, map: Map<string, Agg>, fn: (agg: Agg) => void) => {
    if (!date) return;
    const month = periodOfDate(date);
    if (input.periods.length && !input.periods.includes(month)) return;
    for (const [periodType, period] of [["day", date], ["week", weekOfDate(date)], ["month", month]] as const) {
      if (!period) continue;
      fn(bump(map, periodType, period, managerId));
      fn(bump(map, periodType, period, ""));
      trackManager(map, periodType, period, managerId);
    }
  };

  // Legacy: locked sales-funnel defs from Orders when available; else Sales_Daily fallback.
  if (input.orders.length) {
    for (const order of input.orders) {
      if (!isSalesFunnelDeal({ stageId: order.stage_id })) continue;
      const managerId = order.manager_id || "";
      const created = dayKeyFromIso(order.created_at);
      const paid = dayKeyFromIso(order.paid_at);
      const status = order.payment_status || "";

      if (created) {
        touchPeriods(created, managerId, legacyByKey, (agg) => {
          agg.deals += 1;
        });
      }
      if (status === "paid" && paid) {
        touchPeriods(paid, managerId, legacyByKey, (agg) => {
          agg.payments += 1;
          agg.paid_revenue += num(order.amount);
        });
      }
      if (order.stage_semantic === "P") {
        const snapshotPeriod = input.checkedAt.slice(0, 10);
        const month = periodOfDate(snapshotPeriod);
        for (const [periodType, period] of [["day", snapshotPeriod], ["month", month]] as const) {
          const agg = bump(legacyByKey, periodType, period, managerId);
          agg.active_deals += 1;
          agg.active_pipeline_amount += num(order.opportunity || order.amount);
          const all = bump(legacyByKey, periodType, period, "");
          all.active_deals += 1;
          all.active_pipeline_amount += num(order.opportunity || order.amount);
        }
      }
    }
  } else {
    for (const row of input.legacySales) {
      const date = row.date;
      if (!date) continue;
      const month = periodOfDate(date);
      if (input.periods.length && !input.periods.includes(month)) continue;
      const managerId = row.manager_id || "";
      for (const [periodType, period] of [["day", date], ["week", weekOfDate(date)], ["month", month]] as const) {
        if (!period) continue;
        const deals = num(row.deals_created);
        const payments = num(row.payments);
        const revenue = num(row.revenue);
        const invoices = num(row.invoices);
        const agg = bump(legacyByKey, periodType, period, managerId);
        agg.deals += deals;
        agg.invoice_events += invoices;
        agg.payments += payments;
        agg.paid_revenue += revenue;
        const all = bump(legacyByKey, periodType, period, "");
        all.deals += deals;
        all.invoice_events += invoices;
        all.payments += payments;
        all.paid_revenue += revenue;
        if (deals + payments > 0) trackManager(legacyByKey, periodType, period, managerId);
      }
    }
  }

  // Candidate from Sales OS daily mirror — manager_count = create or pay only.
  for (const row of input.salesOsDaily) {
    const date = row.date;
    if (!date) continue;
    const month = periodOfDate(date);
    if (input.periods.length && !input.periods.includes(month)) continue;
    const managerId = row.manager_id || "";
    const leads = num(row.leads);
    const deals = num(row.deals);
    const invoices = num(row.invoice_events);
    const payments = num(row.payments);
    const revenue = num(row.paid_revenue);
    const activeDeals = num(row.active_deals);
    const activeAmount = num(row.active_pipeline_amount);

    for (const [periodType, period] of [["day", date], ["week", weekOfDate(date)], ["month", month]] as const) {
      if (!period) continue;
      const agg = bump(candidateByKey, periodType, period, managerId);
      agg.leads += leads;
      agg.deals += deals;
      agg.invoice_events += invoices;
      agg.payments += payments;
      agg.paid_revenue += revenue;
      agg.active_deals += activeDeals;
      agg.active_pipeline_amount += activeAmount;

      const all = bump(candidateByKey, periodType, period, "");
      all.leads += leads;
      all.deals += deals;
      all.invoice_events += invoices;
      all.payments += payments;
      all.paid_revenue += revenue;
      all.active_deals += activeDeals;
      all.active_pipeline_amount += activeAmount;

      if (deals + payments > 0) trackManager(candidateByKey, periodType, period, managerId);
    }
  }

  const keys = new Set([...legacyByKey.keys(), ...candidateByKey.keys()]);
  const rows: ReconRow[] = [];

  for (const key of [...keys].sort()) {
    const [periodType, period, managerIdRaw] = key.split("|");
    const managerId = managerIdRaw === "_all" ? "all" : managerIdRaw;
    const legacy = legacyByKey.get(key);
    const candidate = candidateByKey.get(key);

    for (const metric of DUAL_RUN_METRICS) {
      let legacyValue: number | null = null;
      let salesOsValue: number | null = null;

      if (metric.metricId === "manager_count") {
        legacyValue = legacy ? legacy.managers.size : null;
        salesOsValue = candidate ? candidate.managers.size : null;
        if (managerId !== "all") continue;
      } else if (metric.metricId === "leads") {
        legacyValue = null;
        salesOsValue = candidate ? candidate.leads : null;
      } else {
        legacyValue = legacy ? legacy[metric.metricId] : null;
        salesOsValue = candidate ? candidate[metric.metricId] : null;
      }

      if ((metric.metricId === "active_deals" || metric.metricId === "active_pipeline_amount") && periodType === "week") {
        continue;
      }

      const classified = classifyMetricDelta({
        metricId: metric.metricId,
        legacyValue,
        salesOsValue,
        absoluteTolerance: metric.absoluteTolerance,
        relativeTolerancePct: metric.relativeTolerancePct,
        definitionStatus: metric.definitionStatus,
        blocksCutover: metric.blocksCutover
      });

      rows.push({
        period_type: periodType,
        period,
        manager_id: managerId,
        metric_id: metric.metricId,
        metric_name: metric.metricName,
        legacy_source: metric.legacySource,
        legacy_value: legacyValue == null ? "" : String(Number(legacyValue.toFixed(2))),
        sales_os_source: metric.salesOsSource,
        sales_os_value: salesOsValue == null ? "" : String(Number(salesOsValue.toFixed(2))),
        delta: classified.delta == null ? "" : String(Number(classified.delta.toFixed(2))),
        delta_pct: classified.deltaPct == null ? "" : String(Number(classified.deltaPct.toFixed(2))),
        absolute_tolerance: String(metric.absoluteTolerance),
        relative_tolerance_pct: String(metric.relativeTolerancePct),
        status: classified.status,
        difference_reason: classified.reason,
        definition_status: metric.definitionStatus,
        source_updated_at: input.checkedAt,
        checked_at: input.checkedAt
      });
    }
  }

  return rows;
}

export function buildCutoverReadiness(input: {
  reconRows: ReconRow[];
  checkedAt: string;
  schemaErrors7d?: number;
  failedSyncs7d?: number;
  sourceUpdatedAt?: string;
}): CutoverRow[] {
  const dayRows = input.reconRows.filter((row) => row.period_type === "day" && row.manager_id === "all");
  const byMetric = new Map<string, ReconRow[]>();
  for (const row of dayRows) {
    const list = byMetric.get(row.metric_id) || [];
    list.push(row);
    byMetric.set(row.metric_id, list);
  }

  const focus: Array<{ id: string; name: string; blocks: boolean }> = [
    { id: "deals", name: "Deals", blocks: true },
    { id: "payments", name: "Payments", blocks: true },
    { id: "paid_revenue", name: "Paid revenue", blocks: true },
    { id: "manager_count", name: "Manager count", blocks: true },
    { id: "contract_schema", name: "Contract schema", blocks: true },
    { id: "sync_health", name: "Sync health", blocks: true },
    { id: "active_deals", name: "Active deals", blocks: false },
    { id: "active_pipeline_amount", name: "Active pipeline amount", blocks: false },
    { id: "leads", name: "Leads", blocks: false },
    { id: "invoice_events", name: "Invoice events", blocks: false }
  ];

  const rows: CutoverRow[] = [];
  for (const item of focus) {
    if (item.id === "contract_schema") {
      const schemaErrors = input.schemaErrors7d ?? 0;
      const ready = schemaErrors === 0;
      rows.push({
        metric_id: item.id,
        metric_name: item.name,
        definition_ready: "true",
        blocks_cutover: "true",
        latest_status: ready ? "matched" : "schema_error",
        latest_delta: "",
        latest_delta_pct: "",
        matched_days_7d: ready ? String(CUTOVER_MATCHED_DAYS_REQUIRED) : "0",
        matched_days_14d: ready ? "14" : "0",
        failed_syncs_7d: String(input.failedSyncs7d ?? 0),
        schema_errors_7d: String(schemaErrors),
        latest_source_updated_at: input.sourceUpdatedAt || "",
        cutover_ready: ready ? "true" : "false",
        blocking_reason: ready ? "" : "schema errors in last 7 days",
        checked_at: input.checkedAt
      });
      continue;
    }

    if (item.id === "sync_health") {
      const failed = input.failedSyncs7d ?? 0;
      const ready = failed === 0;
      rows.push({
        metric_id: item.id,
        metric_name: item.name,
        definition_ready: "true",
        blocks_cutover: "true",
        latest_status: ready ? "matched" : "sync_failed",
        latest_delta: "",
        latest_delta_pct: "",
        matched_days_7d: ready ? String(CUTOVER_MATCHED_DAYS_REQUIRED) : "0",
        matched_days_14d: ready ? "14" : "0",
        failed_syncs_7d: String(failed),
        schema_errors_7d: String(input.schemaErrors7d ?? 0),
        latest_source_updated_at: input.sourceUpdatedAt || "",
        cutover_ready: ready ? "true" : "false",
        blocking_reason: ready ? "" : "failed syncs in last 7 days",
        checked_at: input.checkedAt
      });
      continue;
    }

    const list = (byMetric.get(item.id) || []).sort((a, b) => b.period.localeCompare(a.period));
    const latest = list[0];
    const last7 = list.slice(0, 7);
    const last14 = list.slice(0, 14);
    const okStatus = (status: string) => status === "matched" || status === "within_tolerance";
    const matched7 = last7.filter((row) => okStatus(row.status)).length;
    const matched14 = last14.filter((row) => okStatus(row.status)).length;
    const metricCfg = DUAL_RUN_METRICS.find((m) => m.metricId === item.id);
    const definitionReady = metricCfg ? metricCfg.definitionStatus === "aligned" || metricCfg.definitionStatus === "partially_aligned" : true;
    const blocks = item.blocks;
    let cutoverReady = false;
    let reason = "";

    if (!blocks) {
      cutoverReady = false;
      reason = "non-blocking metric; definition pending or not required";
    } else if (!definitionReady && item.id !== "manager_count") {
      cutoverReady = false;
      reason = `definition_status=${metricCfg?.definitionStatus}`;
    } else if (matched7 < CUTOVER_MATCHED_DAYS_REQUIRED) {
      cutoverReady = false;
      reason = `need ${CUTOVER_MATCHED_DAYS_REQUIRED} matched/within_tolerance days, have ${matched7}`;
    } else {
      cutoverReady = true;
    }

    rows.push({
      metric_id: item.id,
      metric_name: item.name,
      definition_ready: definitionReady ? "true" : "false",
      blocks_cutover: blocks ? "true" : "false",
      latest_status: latest?.status || "missing_sales_os",
      latest_delta: latest?.delta || "",
      latest_delta_pct: latest?.delta_pct || "",
      matched_days_7d: String(matched7),
      matched_days_14d: String(matched14),
      failed_syncs_7d: String(input.failedSyncs7d ?? 0),
      schema_errors_7d: String(input.schemaErrors7d ?? 0),
      latest_source_updated_at: input.sourceUpdatedAt || "",
      cutover_ready: cutoverReady ? "true" : "false",
      blocking_reason: cutoverReady ? "" : reason,
      checked_at: input.checkedAt
    });
  }

  return rows;
}

export async function runSalesOsReconciliation(options: {
  dryRun?: boolean;
  periods?: string[];
  motherSpreadsheetId?: string;
  salesOsDailyRows?: Array<Record<string, string>>;
  sourceUpdatedAt?: string;
} = {}) {
  const startedAt = new Date().toISOString();
  const dryRun = options.dryRun === true;
  const motherId = options.motherSpreadsheetId?.trim() || getMotherSpreadsheetId();
  const periods = options.periods?.length ? options.periods : ["2026-05", "2026-06", "2026-07"];
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!readGoogleServiceAccount()) {
    throw new Error("Google service account is not configured");
  }

  const [salesValues, ordersValues, candidateValues] = await Promise.all([
    readSheetValues({ spreadsheetId: motherId, range: `${quoteTab(OS_TABS.salesDaily)}!A1:N` }),
    readSheetValues({ spreadsheetId: motherId, range: `${quoteTab(OS_TABS.orders)}!A1:AJ` }),
    options.salesOsDailyRows
      ? Promise.resolve([] as string[][])
      : readSheetValues({ spreadsheetId: motherId, range: `${quoteTab(SALES_OS_DAILY_TAB)}!A1:ZZ` }).catch(() => [] as string[][])
  ]);

  const legacySales = salesValues.length
    ? salesValues.slice(1).map((line) => salesDailyRowFromSheetLine(salesValues[0], line)).filter((row): row is SalesDailyRow => Boolean(row))
    : [];
  const orders = ordersValues.length
    ? ordersValues.slice(1).map((line) => ordersRowFromSheetLine(ordersValues[0], line)).filter((row): row is OrdersRow => Boolean(row))
    : [];
  const salesOsDaily = options.salesOsDailyRows
    || readMap(candidateValues);

  if (!salesOsDaily.length) warnings.push("32_Sales_OS_Daily empty or missing");
  if (!legacySales.length) warnings.push("02_Sales_Daily empty");

  const reconRows = buildReconciliationRows({
    legacySales,
    salesOsDaily,
    orders,
    periods,
    checkedAt: startedAt
  });

  const cutoverRows = buildCutoverReadiness({
    reconRows,
    checkedAt: startedAt,
    schemaErrors7d: 0,
    failedSyncs7d: 0,
    sourceUpdatedAt: options.sourceUpdatedAt
  });

  let rowsWritten = 0;
  if (!dryRun) {
    await withSyncRun({
      syncName: "sales_os_reconciliation",
      source: "legacy+32_Sales_OS_Daily",
      target: SALES_RECONCILIATION_TAB,
      spreadsheetId: motherId,
      startedAt,
      schemaVersion: "sales_dual_run_v1",
      triggerType: "script"
    }, async () => {
      const a = await safeReplaceSheet({
        spreadsheetId: motherId,
        tabTitle: SALES_RECONCILIATION_TAB,
        expectedColumns: SALES_RECONCILIATION_COLUMNS,
        rows: reconRows.map((row) => SALES_RECONCILIATION_COLUMNS.map((column) => row[column])),
        clearRange: `${quoteTab(SALES_RECONCILIATION_TAB)}!A:ZZ`
      });
      return { rowsRead: reconRows.length, rowsWritten: a.rowsWritten };
    });

    await withSyncRun({
      syncName: "sales_os_cutover_readiness",
      source: SALES_RECONCILIATION_TAB,
      target: SALES_CUTOVER_READINESS_TAB,
      spreadsheetId: motherId,
      startedAt,
      schemaVersion: "sales_dual_run_v1",
      triggerType: "script"
    }, async () => {
      const b = await safeReplaceSheet({
        spreadsheetId: motherId,
        tabTitle: SALES_CUTOVER_READINESS_TAB,
        expectedColumns: SALES_CUTOVER_READINESS_COLUMNS,
        rows: cutoverRows.map((row) => SALES_CUTOVER_READINESS_COLUMNS.map((column) => row[column])),
        clearRange: `${quoteTab(SALES_CUTOVER_READINESS_TAB)}!A:ZZ`
      });
      rowsWritten = reconRows.length + b.rowsWritten;
      return { rowsRead: cutoverRows.length, rowsWritten: b.rowsWritten };
    });
  }

  const blocking = cutoverRows.filter((row) => row.blocks_cutover === "true" && row.cutover_ready !== "true");
  const monthly = reconRows.filter((row) => row.period_type === "month" && row.manager_id === "all");

  return {
    status: errors.length ? "failed" : "success",
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    dryRun,
    rows_written: dryRun ? 0 : rowsWritten,
    warnings,
    errors,
    reconciliation_summary: monthly.map((row) => ({
      period: row.period,
      metric_id: row.metric_id,
      legacy_value: row.legacy_value,
      sales_os_value: row.sales_os_value,
      delta: row.delta,
      delta_pct: row.delta_pct,
      status: row.status,
      definition_status: row.definition_status,
      reason: row.difference_reason
    })),
    cutover_readiness: cutoverRows,
    cutover_blocked_by: blocking.map((row) => row.metric_id),
    recon_rows: reconRows
  };
}
