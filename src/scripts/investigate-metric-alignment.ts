/**
 * Metric alignment investigation — July 2026 (and optional months).
 * Compares legacy 03_Orders vs Sales OS / mother staging definitions.
 */
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { OS_SPREADSHEET_ID, OS_TABS } from "@/config/os-sheets";
import { SALES_OS_SHEETS, getSalesOsSpreadsheetId } from "@/config/sales-os";
import { SALES_FOUNDATION_TABS } from "@/config/sales-foundation";
import { ordersRowFromSheetLine, type OrdersRow } from "@/lib/os-sheets/orders-mapper";
import { readSheetValues } from "@/lib/google/sheets-client";
import { truthyFlag, periodOfIso, dayOfIso } from "@/lib/sales-os/build-model";

function quote(title: string) {
  return `'${title.replace(/'/g, "''")}'`;
}

function readMaps(values: string[][]): Array<Record<string, string>> {
  if (!values.length) return [];
  const [header, ...lines] = values;
  const keys = header.map((c) => String(c ?? "").trim());
  return lines.map((line) => {
    const row: Record<string, string> = {};
    keys.forEach((k, i) => {
      if (k) row[k] = String(line[i] ?? "").trim();
    });
    return row;
  }).filter((r) => Object.values(r).some(Boolean));
}

function num(v: string) {
  const n = Number(String(v ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function inMonth(iso: string, month: string) {
  const d = dayOfIso(iso) || iso.slice(0, 10);
  return d.startsWith(month);
}

async function main() {
  const month = process.argv.find((a) => /^\d{4}-\d{2}$/.test(a)) || "2026-07";
  const mother = OS_SPREADSHEET_ID;
  const salesOs = getSalesOsSpreadsheetId();

  const [ordersRaw, sfDealsRaw, sfPipelineRaw, osDealsRaw, osPaymentsRaw, osExportRaw] = await Promise.all([
    readSheetValues({ spreadsheetId: mother, range: `${quote(OS_TABS.orders)}!A1:AJ` }),
    readSheetValues({ spreadsheetId: mother, range: `${quote(SALES_FOUNDATION_TABS.dealsRaw)}!A1:AZ` }),
    readSheetValues({ spreadsheetId: mother, range: `${quote(SALES_FOUNDATION_TABS.pipeline)}!A1:AZ` }),
    readSheetValues({ spreadsheetId: salesOs, range: `${quote(SALES_OS_SHEETS.deals)}!A1:AZ` }),
    readSheetValues({ spreadsheetId: salesOs, range: `${quote(SALES_OS_SHEETS.paymentEvents)}!A1:AZ` }),
    readSheetValues({ spreadsheetId: salesOs, range: `${quote(SALES_OS_SHEETS.export)}!A1:AZ` })
  ]);

  const orders = ordersRaw.length
    ? ordersRaw.slice(1).map((l) => ordersRowFromSheetLine(ordersRaw[0], l)).filter((r): r is OrdersRow => Boolean(r))
    : [];
  const sfDeals = readMaps(sfDealsRaw);
  const pipeline = readMaps(sfPipelineRaw);
  const osDeals = readMaps(osDealsRaw);
  const osPayments = readMaps(osPaymentsRaw);

  // --- Deals created in month ---
  const legacyDeals = orders.filter((o) => inMonth(o.created_at, month));
  const salesOsDeals = osDeals.filter((d) => d.period === month || inMonth(d.created_at, month));
  const sfDealsMonth = sfDeals.filter((d) => inMonth(d.created_at, month));

  const legacyDealIds = new Set(legacyDeals.map((o) => o.deal_id || o.order_id));
  const salesOsDealIds = new Set(salesOsDeals.map((d) => d.deal_id));
  const onlyLegacyDeals = [...legacyDealIds].filter((id) => !salesOsDealIds.has(id));
  const onlySalesOsDeals = [...salesOsDealIds].filter((id) => !legacyDealIds.has(id));

  const dealDiff = {
    only_legacy: onlyLegacyDeals.map((id) => {
      const o = legacyDeals.find((x) => (x.deal_id || x.order_id) === id)!;
      return {
        deal_id: id,
        created_at: o.created_at,
        closed_at: o.paid_at,
        stage: o.stage_id,
        stage_semantic: o.stage_semantic,
        manager: o.manager_id,
        amount: o.amount || o.opportunity,
        payment_status: o.payment_status,
        reason_of_difference: "present in 03_Orders created_at month, absent from Sales OS 04_Deals"
      };
    }),
    only_sales_os: onlySalesOsDeals.map((id) => {
      const d = salesOsDeals.find((x) => x.deal_id === id)!;
      return {
        deal_id: id,
        created_at: d.created_at,
        closed_at: d.closed_at,
        stage: d.stage_id,
        stage_semantic: d.stage_semantic,
        manager: d.assigned_by_id,
        amount: d.opportunity,
        reason_of_difference: "present in Sales OS 04_Deals, absent from 03_Orders for same created month"
      };
    })
  };

  // --- Payments (paid in month) ---
  const legacyPayments = orders.filter((o) => o.payment_status === "paid" && inMonth(o.paid_at, month));
  const salesOsPays = osPayments.filter((p) => p.period === month || inMonth(p.paid_at, month));
  const legacyPayIds = new Set(legacyPayments.map((o) => o.deal_id || o.order_id));
  const salesOsPayIds = new Set(salesOsPays.map((p) => p.deal_id));
  const onlyLegacyPay = [...legacyPayIds].filter((id) => !salesOsPayIds.has(id));
  const onlySalesOsPay = [...salesOsPayIds].filter((id) => !legacyPayIds.has(id));

  const paymentDiff = {
    only_legacy: onlyLegacyPay.map((id) => {
      const o = legacyPayments.find((x) => (x.deal_id || x.order_id) === id)!;
      return {
        deal_id: id,
        created_at: o.created_at,
        closed_at: o.paid_at,
        stage: o.stage_id,
        stage_semantic: o.stage_semantic,
        manager: o.manager_id,
        amount: o.amount,
        opportunity: o.opportunity,
        reason_of_difference: "Orders paid (semantic S + paid_at in month) missing from Sales OS payment events"
      };
    }),
    only_sales_os: onlySalesOsPay.map((id) => {
      const p = salesOsPays.find((x) => x.deal_id === id)!;
      const o = orders.find((x) => (x.deal_id || x.order_id) === id);
      return {
        deal_id: id,
        created_at: o?.created_at || "",
        closed_at: p.paid_at,
        stage: o?.stage_id || "",
        stage_semantic: o?.stage_semantic || "",
        manager: p.manager_id,
        amount: p.amount,
        orders_payment_status: o?.payment_status || "NOT_IN_ORDERS",
        orders_paid_at: o?.paid_at || "",
        reason_of_difference: !o
          ? "in Sales OS payments but deal not in 03_Orders"
          : o.payment_status !== "paid"
            ? `Orders status=${o.payment_status} but Sales OS treats as won payment`
            : `Orders paid_at=${o.paid_at} outside month while closed_at in month`
      };
    })
  };

  const legacyRevenue = legacyPayments.reduce((s, o) => s + num(o.amount), 0);
  const salesOsRevenue = salesOsPays.reduce((s, p) => s + num(p.amount), 0);

  // Amount mismatches on intersection
  const bothPay = [...legacyPayIds].filter((id) => salesOsPayIds.has(id));
  const amountMismatches = bothPay.map((id) => {
    const o = legacyPayments.find((x) => (x.deal_id || x.order_id) === id)!;
    const p = salesOsPays.find((x) => x.deal_id === id)!;
    const la = num(o.amount);
    const sa = num(p.amount);
    return {
      deal_id: id,
      legacy_amount: la,
      sales_os_amount: sa,
      delta: Number((sa - la).toFixed(2)),
      legacy_field: "Orders.amount (opportunity when paid)",
      sales_os_field: "payment event amount (opportunity)",
      reason_of_difference: Math.abs(sa - la) > 0.01 ? "amount field differs" : "match"
    };
  }).filter((r) => Math.abs(r.delta) > 0.01);

  // --- Pipeline ---
  const legacyOpen = orders.filter((o) => {
    const s = o.payment_status || "";
    return s !== "paid" && s !== "lost";
  });
  const legacyOpenIds = new Set(legacyOpen.map((o) => o.deal_id || o.order_id));
  const pipelineIds = new Set(pipeline.map((p) => p.deal_id));
  const onlyLegacyPipe = [...legacyOpenIds].filter((id) => !pipelineIds.has(id));
  const onlyPipe = [...pipelineIds].filter((id) => !legacyOpenIds.has(id));

  const pipeDiff = {
    legacy_open_count: legacyOpenIds.size,
    sales_os_pipeline_count: pipelineIds.size,
    only_legacy_open: onlyLegacyPipe.slice(0, 50).map((id) => {
      const o = legacyOpen.find((x) => (x.deal_id || x.order_id) === id)!;
      return {
        deal_id: id,
        stage_semantic: o.stage_semantic,
        payment_status: o.payment_status,
        manager: o.manager_id,
        opportunity: o.opportunity,
        reason_of_difference: o.payment_status === "invoiced"
          ? "Orders treats invoiced (not S/F) as open; pipeline sheet may require STAGE_SEMANTIC=P only"
          : "open in Orders but not in 65_Bitrix_Pipeline"
      };
    }),
    only_pipeline: onlyPipe.slice(0, 50).map((id) => {
      const p = pipeline.find((x) => x.deal_id === id)!;
      const o = orders.find((x) => (x.deal_id || x.order_id) === id);
      return {
        deal_id: id,
        stage_id: p.stage_id,
        stage_semantic: "P",
        manager: p.assigned_by_id,
        opportunity: p.opportunity,
        orders_payment_status: o?.payment_status || "NOT_IN_ORDERS",
        orders_stage_semantic: o?.stage_semantic || "",
        reason_of_difference: !o
          ? "in pipeline staging but missing from Orders"
          : `Orders payment_status=${o.payment_status} stage_semantic=${o.stage_semantic}`
      };
    }),
    status_breakdown_legacy_open: Object.fromEntries(
      [...legacyOpen.reduce((m, o) => {
        const k = o.payment_status || "unknown";
        m.set(k, (m.get(k) || 0) + 1);
        return m;
      }, new Map<string, number>())]
    )
  };

  // --- Managers ---
  const legacyManagers = new Set(
    orders.filter((o) => inMonth(o.created_at, month) || (o.payment_status === "paid" && inMonth(o.paid_at, month)))
      .map((o) => o.manager_id)
      .filter(Boolean)
  );
  const salesOsManagers = new Set(
    [...salesOsDeals, ...salesOsPays].map((r) => ("assigned_by_id" in r ? r.assigned_by_id : r.manager_id)).filter(Boolean)
  );
  // Also from export day×manager for month
  const exportRows = readMaps(osExportRaw).filter((r) => String(r.date || "").startsWith(month));
  const exportManagers = new Set(exportRows.map((r) => r.manager_id).filter(Boolean));

  const report = {
    month,
    generated_at: new Date().toISOString(),
    counts: {
      deals: {
        legacy_orders_created: legacyDealIds.size,
        sales_os_04_deals: salesOsDealIds.size,
        sf_61_deals: sfDealsMonth.length,
        only_legacy: onlyLegacyDeals.length,
        only_sales_os: onlySalesOsDeals.length,
        delta_sales_os_minus_legacy: salesOsDealIds.size - legacyDealIds.size
      },
      payments: {
        legacy_paid: legacyPayIds.size,
        sales_os_payment_events: salesOsPayIds.size,
        only_legacy: onlyLegacyPay.length,
        only_sales_os: onlySalesOsPay.length,
        legacy_revenue: Number(legacyRevenue.toFixed(2)),
        sales_os_revenue: Number(salesOsRevenue.toFixed(2)),
        revenue_delta: Number((salesOsRevenue - legacyRevenue).toFixed(2)),
        amount_mismatches_on_intersection: amountMismatches.length
      },
      pipeline: {
        legacy_open_not_paid_lost: legacyOpenIds.size,
        sales_os_65_pipeline: pipelineIds.size,
        only_legacy: onlyLegacyPipe.length,
        only_pipeline: onlyPipe.length
      },
      managers: {
        legacy_with_created_or_paid_activity: legacyManagers.size,
        sales_os_deals_or_payments: salesOsManagers.size,
        sales_os_export_daily: exportManagers.size,
        only_legacy: [...legacyManagers].filter((id) => !exportManagers.has(id)),
        only_export: [...exportManagers].filter((id) => !legacyManagers.has(id))
      }
    },
    dealDiff,
    paymentDiff,
    amountMismatches: amountMismatches.slice(0, 40),
    pipeDiff,
    notes: [
      "Legacy deals = 03_Orders rows with created_at in month",
      "Sales OS deals = 04_Deals / staging 61 with created_at in month",
      "Legacy payments = Orders payment_status=paid and paid_at in month; amount=Orders.amount",
      "Sales OS payments = won + closed_at in month; amount=opportunity from payment event",
      "Legacy pipeline = Orders not paid and not lost (includes invoiced/unpaid)",
      "Sales OS pipeline = STAGE_SEMANTIC_ID=P only from Bitrix list"
    ]
  };

  const outDir = path.join(process.cwd(), "data", "metric-alignment");
  await mkdir(outDir, { recursive: true });
  const outFile = path.join(outDir, `investigation-${month}.json`);
  await writeFile(outFile, JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify({
    outFile,
    counts: report.counts,
    sample_only_legacy_deals: dealDiff.only_legacy.slice(0, 5),
    sample_only_sales_os_deals: dealDiff.only_sales_os.slice(0, 5),
    sample_only_legacy_pay: paymentDiff.only_legacy.slice(0, 5),
    sample_only_sales_os_pay: paymentDiff.only_sales_os.slice(0, 5),
    sample_amount_mismatches: amountMismatches.slice(0, 5),
    pipe_status_breakdown: pipeDiff.status_breakdown_legacy_open,
    managers: report.counts.managers
  }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
