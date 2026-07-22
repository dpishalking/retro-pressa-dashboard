import {
  DAILY_FACT_COLUMNS,
  DATA_QUALITY_COLUMNS,
  DEALS_COLUMNS,
  DIALOG_LINKS_COLUMNS,
  FUNNEL_FACT_COLUMNS,
  INVOICE_EVENTS_COLUMNS,
  LEADS_COLUMNS,
  MANAGERS_COLUMNS,
  PAYMENT_EVENTS_COLUMNS,
  PIPELINE_COLUMNS,
  README_COLUMNS,
  SETTINGS_COLUMNS,
  STAGE_HISTORY_COLUMNS,
  STAGE_MAP_COLUMNS,
  SALES_OS_CONTRACT_VERSION,
  getSalesOsSourceSpreadsheetId,
  getSalesOsSpreadsheetId
} from "@/config/sales-os";
import { SALES_FOUNDATION_TABS } from "@/config/sales-foundation";
import { SALES_EXPORT_COLUMNS, SALES_EXPORT_CONTRACT_VERSION } from "@/lib/sales-os/export-contract";
import { dayKeyFromIso } from "@/lib/os-sheets/sales-metric-defs";

export type RowMap = Record<string, string>;

export function rowsFromSheet(values: string[][]): RowMap[] {
  if (!values.length) return [];
  const [header, ...lines] = values;
  const keys = header.map((cell) => String(cell ?? "").trim());
  return lines
    .map((line) => {
      const row: RowMap = {};
      keys.forEach((key, index) => {
        if (!key) return;
        row[key] = String(line[index] ?? "").trim();
      });
      return row;
    })
    .filter((row) => Object.values(row).some(Boolean));
}

/** Calendar day from Bitrix timestamp prefix (e.g. 2026-07-13T01:00:00+03:00 → 2026-07-13). */
export function dayOfIso(iso: string): string {
  return dayKeyFromIso(iso);
}

export function periodOfIso(iso: string): string {
  const day = dayOfIso(iso);
  return day ? day.slice(0, 7) : "";
}

export function inPeriods(iso: string, periods: string[]): boolean {
  if (!periods.length) return true;
  const period = periodOfIso(iso);
  return periods.includes(period);
}

export function toMatrix(columns: readonly string[], rows: Array<Record<string, string | number>>): Array<Array<string | number>> {
  return rows.map((row) => columns.map((column) => row[column] ?? ""));
}

export function truthyFlag(value: string | null | undefined): boolean {
  const v = String(value ?? "").trim().toLowerCase();
  return v === "true" || v === "1" || v === "y" || v === "yes";
}

export function pct(num: number, den: number): string {
  if (!den) return "";
  return ((num / den) * 100).toFixed(2);
}

export type SalesOsModel = {
  readme: Array<Record<(typeof README_COLUMNS)[number], string>>;
  settings: Array<Record<(typeof SETTINGS_COLUMNS)[number], string>>;
  managers: Array<Record<(typeof MANAGERS_COLUMNS)[number], string>>;
  leads: Array<Record<(typeof LEADS_COLUMNS)[number], string>>;
  deals: Array<Record<(typeof DEALS_COLUMNS)[number], string>>;
  stageMap: Array<Record<(typeof STAGE_MAP_COLUMNS)[number], string>>;
  stageHistory: Array<Record<(typeof STAGE_HISTORY_COLUMNS)[number], string>>;
  invoiceEvents: Array<Record<(typeof INVOICE_EVENTS_COLUMNS)[number], string>>;
  paymentEvents: Array<Record<(typeof PAYMENT_EVENTS_COLUMNS)[number], string>>;
  pipeline: Array<Record<(typeof PIPELINE_COLUMNS)[number], string>>;
  dialogLinks: Array<Record<(typeof DIALOG_LINKS_COLUMNS)[number], string>>;
  dataQuality: Array<Record<(typeof DATA_QUALITY_COLUMNS)[number], string>>;
  dailyFact: Array<Record<(typeof DAILY_FACT_COLUMNS)[number], string>>;
  funnelFact: Array<Record<(typeof FUNNEL_FACT_COLUMNS)[number], string>>;
  exportRows: Array<Record<(typeof SALES_EXPORT_COLUMNS)[number], string>>;
};

export function buildSalesOsModel(input: {
  periods: string[];
  syncedAt: string;
  leadsRaw: RowMap[];
  dealsRaw: RowMap[];
  stagesRaw: RowMap[];
  stageHistoryRaw: RowMap[];
  pipelineRaw: RowMap[];
  dialogLinksRaw: RowMap[];
  dataQualityRaw: RowMap[];
}): SalesOsModel {
  const { periods, syncedAt } = input;

  const leads = input.leadsRaw
    .filter((row) => inPeriods(row.created_at || "", periods))
    .map((row) => ({
      lead_id: row.lead_id || "",
      created_at: row.created_at || "",
      modified_at: row.modified_at || "",
      status_id: row.status_id || "",
      status_semantic: row.status_semantic || "",
      source_id: row.source_id || "",
      assigned_by_id: row.assigned_by_id || "",
      assigned_by_name: row.assigned_by_name || "",
      contact_id: row.contact_id || "",
      customer_key: row.customer_key || "",
      customer_key_type: row.customer_key_type || "",
      utm_source: row.utm_source || "",
      utm_medium: row.utm_medium || "",
      utm_campaign: row.utm_campaign || "",
      utm_content: row.utm_content || "",
      utm_term: row.utm_term || "",
      country_raw: row.country_raw || "",
      form_name: row.form_name || "",
      phone_present: row.phone_present || "",
      email_present: row.email_present || "",
      is_lost: row.is_lost || "",
      period: periodOfIso(row.created_at || ""),
      sync_updated_at: syncedAt
    }))
    .filter((row) => row.lead_id);

  const deals = input.dealsRaw
    .filter((row) => inPeriods(row.created_at || "", periods))
    .map((row) => ({
      deal_id: row.deal_id || "",
      lead_id: row.lead_id || "",
      contact_id: row.contact_id || "",
      created_at: row.created_at || "",
      modified_at: row.modified_at || "",
      closed_at: row.closed_at || "",
      stage_id: row.stage_id || "",
      stage_semantic: row.stage_semantic || "",
      category_id: row.category_id || "",
      is_open: row.is_open || "",
      is_won: row.is_won || "",
      is_lost: row.is_lost || "",
      assigned_by_id: row.assigned_by_id || "",
      assigned_by_name: row.assigned_by_name || "",
      source_id: row.source_id || "",
      currency: row.currency || "EUR",
      opportunity: row.opportunity || "",
      invoice_amount: row.invoice_amount || "",
      invoice_at: row.invoice_at || "",
      invoice_flag: row.invoice_flag || "",
      country_raw: row.country_raw || "",
      primary_product_id: row.primary_product_id || "",
      primary_product_name: row.primary_product_name || "",
      product_rows_count: row.product_rows_count || "",
      customer_key: row.customer_key || "",
      customer_key_type: row.customer_key_type || "",
      period: periodOfIso(row.created_at || ""),
      sync_updated_at: syncedAt
    }))
    .filter((row) => row.deal_id);

  const stageMap = input.stagesRaw.map((row) => ({
    stage_id: row.stage_id || "",
    category_id: row.category_id || "",
    stage_name: row.stage_name || "",
    sort: row.sort || "",
    semantic: row.semantic || "",
    is_final: row.is_final || "",
    is_success: row.is_success || "",
    is_failure: row.is_failure || "",
    business_stage_id: row.business_stage_id || "",
    business_stage_name: row.business_stage_name || "",
    is_active: row.is_active || "true",
    sync_updated_at: syncedAt
  })).filter((row) => row.stage_id);

  const stageHistory = input.stageHistoryRaw
    .filter((row) => inPeriods(row.entered_at || "", periods))
    .map((row) => ({
      event_id: row.event_id || "",
      deal_id: row.deal_id || "",
      category_id: row.category_id || "",
      stage_id: row.stage_id || "",
      stage_name: row.stage_name || "",
      stage_semantic: row.stage_semantic || "",
      entered_at: row.entered_at || "",
      left_at: row.left_at || "",
      duration_minutes: row.duration_minutes || "",
      is_current_stage: row.is_current_stage || "",
      period: periodOfIso(row.entered_at || ""),
      sync_updated_at: syncedAt
    }))
    .filter((row) => row.event_id);

  const invoiceEvents = input.dealsRaw
    .filter((row) => Boolean(row.invoice_at) && inPeriods(row.invoice_at, periods))
    .map((row) => ({
      event_id: `invoice|${row.deal_id}|${row.invoice_at}`,
      deal_id: row.deal_id || "",
      lead_id: row.lead_id || "",
      contact_id: row.contact_id || "",
      manager_id: row.assigned_by_id || "",
      manager_name: row.assigned_by_name || "",
      invoice_at: row.invoice_at || "",
      invoice_amount: row.invoice_amount || "",
      currency: row.currency || "EUR",
      invoice_flag: row.invoice_flag || "",
      customer_key: row.customer_key || "",
      period: periodOfIso(row.invoice_at || ""),
      sync_updated_at: syncedAt
    }))
    .filter((row) => row.deal_id);

  const paymentEvents = input.dealsRaw
    .filter((row) => (truthyFlag(row.is_won) || row.stage_semantic === "S") && Boolean(row.closed_at) && inPeriods(row.closed_at, periods))
    .map((row) => ({
      event_id: `payment|${row.deal_id}|${row.closed_at}`,
      deal_id: row.deal_id || "",
      lead_id: row.lead_id || "",
      contact_id: row.contact_id || "",
      manager_id: row.assigned_by_id || "",
      manager_name: row.assigned_by_name || "",
      paid_at: row.closed_at || "",
      amount: row.opportunity || "",
      currency: row.currency || "EUR",
      customer_key: row.customer_key || "",
      period: periodOfIso(row.closed_at || ""),
      sync_updated_at: syncedAt
    }))
    .filter((row) => row.deal_id);

  const pipeline = input.pipelineRaw.map((row) => ({
    snapshot_date: row.snapshot_date || "",
    deal_id: row.deal_id || "",
    created_at: row.created_at || "",
    days_open: row.days_open || "",
    stage_id: row.stage_id || "",
    stage_name: row.stage_name || "",
    days_in_stage: row.days_in_stage || "",
    assigned_by_id: row.assigned_by_id || "",
    assigned_by_name: row.assigned_by_name || "",
    lead_id: row.lead_id || "",
    contact_id: row.contact_id || "",
    customer_key: row.customer_key || "",
    primary_product_id: row.primary_product_id || "",
    primary_product_name: row.primary_product_name || "",
    opportunity: row.opportunity || "",
    currency: row.currency || "EUR",
    last_activity_at: row.last_activity_at || "",
    next_activity_at: row.next_activity_at || "",
    days_since_last_activity: row.days_since_last_activity || "",
    is_overdue: row.is_overdue || "",
    is_without_next_activity: row.is_without_next_activity || "",
    stage_probability: "",
    weighted_amount: "",
    sync_updated_at: syncedAt
  })).filter((row) => row.deal_id);

  const dialogLinks = input.dialogLinksRaw.map((row) => ({
    dialog_id: row.dialog_id || "",
    session_id: row.session_id || "",
    chat_id: row.chat_id || "",
    lead_id: row.lead_id || "",
    deal_id: row.deal_id || "",
    contact_id: row.contact_id || "",
    manager_id: row.manager_id || "",
    manager_name: row.manager_name || "",
    first_message_at: row.first_message_at || "",
    last_message_at: row.last_message_at || "",
    messages_count: row.messages_count || "",
    client_messages_count: row.client_messages_count || "",
    manager_messages_count: row.manager_messages_count || "",
    customer_key: row.customer_key || "",
    crm_link_status: row.crm_link_status || "",
    sync_updated_at: syncedAt
  })).filter((row) => row.dialog_id || row.session_id);

  const dataQuality = input.dataQualityRaw
    .filter((row) => !periods.length || periods.includes(row.period) || row.period === "all")
    .map((row) => ({
      period: row.period || "",
      entity_type: row.entity_type || "",
      field_id: row.field_id || "",
      field_name: row.field_name || "",
      records_total: row.records_total || "",
      records_filled: row.records_filled || "",
      fill_rate_pct: row.fill_rate_pct || "",
      quality_status: row.quality_status || "",
      source_sheet: row.source_sheet || "",
      notes: row.notes || "",
      sync_updated_at: syncedAt
    }));

  const managersMap = new Map<string, string>();
  for (const row of [...leads, ...deals, ...pipeline, ...dialogLinks]) {
    const id = "assigned_by_id" in row ? row.assigned_by_id : ("manager_id" in row ? row.manager_id : "");
    const name = "assigned_by_name" in row ? row.assigned_by_name : ("manager_name" in row ? row.manager_name : "");
    if (id) managersMap.set(id, name || managersMap.get(id) || `ID ${id}`);
  }
  const managers = [...managersMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], "en", { numeric: true }))
    .map(([manager_id, manager_name]) => ({
      manager_id,
      manager_name,
      is_active: "true",
      source: "bitrix_staging",
      sync_updated_at: syncedAt
    }));

  type Agg = {
    date: string;
    manager_id: string;
    manager_name: string;
    leads: number;
    deals_created: number;
    invoices: number;
    invoice_amount: number;
    payments: number;
    revenue: number;
    active_pipeline_deals: number;
    active_pipeline_amount: number;
    dialogs: number;
    stale_deals: number;
    deals_without_next_activity: number;
  };
  const daily = new Map<string, Agg>();
  const bump = (date: string, managerId: string, managerName: string) => {
    const key = `${date}|${managerId}`;
    let row = daily.get(key);
    if (!row) {
      row = {
        date,
        manager_id: managerId,
        manager_name: managerName,
        leads: 0,
        deals_created: 0,
        invoices: 0,
        invoice_amount: 0,
        payments: 0,
        revenue: 0,
        active_pipeline_deals: 0,
        active_pipeline_amount: 0,
        dialogs: 0,
        stale_deals: 0,
        deals_without_next_activity: 0
      };
      daily.set(key, row);
    }
    return row;
  };

  for (const row of leads) {
    const date = dayOfIso(row.created_at);
    if (!date || !row.assigned_by_id) continue;
    bump(date, row.assigned_by_id, row.assigned_by_name).leads += 1;
  }
  for (const row of deals) {
    const date = dayOfIso(row.created_at);
    if (!date || !row.assigned_by_id) continue;
    bump(date, row.assigned_by_id, row.assigned_by_name).deals_created += 1;
  }
  for (const row of invoiceEvents) {
    const date = dayOfIso(row.invoice_at);
    if (!date || !row.manager_id) continue;
    const agg = bump(date, row.manager_id, row.manager_name);
    agg.invoices += 1;
    agg.invoice_amount += Number(row.invoice_amount) || 0;
  }
  for (const row of paymentEvents) {
    const date = dayOfIso(row.paid_at);
    if (!date || !row.manager_id) continue;
    const agg = bump(date, row.manager_id, row.manager_name);
    agg.payments += 1;
    agg.revenue += Number(row.amount) || 0;
  }
  for (const row of pipeline) {
    const date = row.snapshot_date || syncedAt.slice(0, 10);
    if (!row.assigned_by_id) continue;
    const agg = bump(date, row.assigned_by_id, row.assigned_by_name);
    agg.active_pipeline_deals += 1;
    agg.active_pipeline_amount += Number(row.opportunity) || 0;
    if (truthyFlag(row.is_without_next_activity)) agg.deals_without_next_activity += 1;
    const daysSince = Number(row.days_since_last_activity);
    if (Number.isFinite(daysSince) && daysSince >= 7) agg.stale_deals += 1;
  }
  for (const row of dialogLinks) {
    const date = dayOfIso(row.first_message_at || row.last_message_at);
    if (!date || !row.manager_id) continue;
    bump(date, row.manager_id, row.manager_name).dialogs += 1;
  }

  const dailyFact = [...daily.values()]
    .sort((a, b) => a.date.localeCompare(b.date) || a.manager_id.localeCompare(b.manager_id, "en", { numeric: true }))
    .map((row) => ({
      date: row.date,
      manager_id: row.manager_id,
      manager_name: row.manager_name,
      leads: String(row.leads),
      deals_created: String(row.deals_created),
      invoices: String(row.invoices),
      invoice_amount: row.invoice_amount ? String(row.invoice_amount) : "0",
      payments: String(row.payments),
      revenue: row.revenue ? String(row.revenue) : "0",
      active_pipeline_deals: String(row.active_pipeline_deals),
      active_pipeline_amount: row.active_pipeline_amount ? String(row.active_pipeline_amount) : "0",
      dialogs: String(row.dialogs),
      stale_deals: String(row.stale_deals),
      deals_without_next_activity: String(row.deals_without_next_activity),
      sync_updated_at: syncedAt
    }));

  type Funnel = {
    period: string;
    manager_id: string;
    manager_name: string;
    leads: number;
    deals: number;
    invoices: number;
    payments: number;
    revenue: number;
  };
  const funnel = new Map<string, Funnel>();
  const bumpFunnel = (period: string, managerId: string, managerName: string) => {
    const key = `${period}|${managerId}`;
    let row = funnel.get(key);
    if (!row) {
      row = { period, manager_id: managerId, manager_name: managerName, leads: 0, deals: 0, invoices: 0, payments: 0, revenue: 0 };
      funnel.set(key, row);
    }
    return row;
  };
  for (const row of leads) {
    if (!row.period || !row.assigned_by_id) continue;
    bumpFunnel(row.period, row.assigned_by_id, row.assigned_by_name).leads += 1;
  }
  for (const row of deals) {
    if (!row.period || !row.assigned_by_id) continue;
    bumpFunnel(row.period, row.assigned_by_id, row.assigned_by_name).deals += 1;
  }
  for (const row of invoiceEvents) {
    if (!row.period || !row.manager_id) continue;
    bumpFunnel(row.period, row.manager_id, row.manager_name).invoices += 1;
  }
  for (const row of paymentEvents) {
    if (!row.period || !row.manager_id) continue;
    const f = bumpFunnel(row.period, row.manager_id, row.manager_name);
    f.payments += 1;
    f.revenue += Number(row.amount) || 0;
  }

  const funnelFact = [...funnel.values()]
    .sort((a, b) => a.period.localeCompare(b.period) || a.manager_id.localeCompare(b.manager_id, "en", { numeric: true }))
    .map((row) => ({
      period: row.period,
      manager_id: row.manager_id,
      manager_name: row.manager_name,
      leads: String(row.leads),
      deals: String(row.deals),
      invoices: String(row.invoices),
      payments: String(row.payments),
      lead_to_deal_pct: pct(row.deals, row.leads),
      deal_to_invoice_pct: pct(row.invoices, row.deals),
      invoice_to_payment_pct: pct(row.payments, row.invoices),
      revenue: String(row.revenue),
      avg_payment: row.payments ? (row.revenue / row.payments).toFixed(2) : "",
      sync_updated_at: syncedAt
    }));

  const exportRows = dailyFact.map((row) => {
    const leads = Number(row.leads) || 0;
    const deals = Number(row.deals_created) || 0;
    const invoices = Number(row.invoices) || 0;
    const payments = Number(row.payments) || 0;
    const revenue = Number(row.revenue) || 0;
    return {
      date: row.date,
      manager_id: row.manager_id,
      leads: row.leads,
      deals: row.deals_created,
      invoice_events: row.invoices,
      payments: row.payments,
      paid_revenue: row.revenue,
      active_deals: row.active_pipeline_deals,
      active_pipeline_amount: row.active_pipeline_amount,
      stale_deals: row.stale_deals,
      deals_without_next_activity: row.deals_without_next_activity,
      lead_to_deal_cr: pct(deals, leads),
      deal_to_invoice_cr: pct(invoices, deals),
      invoice_to_payment_cr: pct(payments, invoices),
      deal_to_payment_cr: pct(payments, deals),
      average_check: payments ? (revenue / payments).toFixed(2) : "",
      data_quality_score: "",
      source_updated_at: syncedAt,
      sync_updated_at: syncedAt,
      contract_version: SALES_EXPORT_CONTRACT_VERSION
    };
  });

  const readme = [
    { section: "title", content: "Retro Pressa — Sales OS" },
    { section: "contract", content: SALES_OS_CONTRACT_VERSION },
    { section: "source", content: `Mother staging ${Object.values(SALES_FOUNDATION_TABS).join(", ")}` },
    { section: "source_spreadsheet_id", content: getSalesOsSourceSpreadsheetId() },
    { section: "sales_os_spreadsheet_id", content: getSalesOsSpreadsheetId() },
    { section: "mother_reads", content: "Only 99_EXPORT" },
    { section: "periods", content: periods.join(", ") },
    { section: "rop_board", content: "Open 14_ROP_Board every morning — plan vs fact traffic light" },
    { section: "maria_flueger", content: "Truth workbook Отчет день/месяц → 15_Maria_Daily + 16_Maria_Snapshot; ROP Board prefers Maria" },
    { section: "predictive_front", content: "Предиктивка продажи in ROP alerts workbook — Lag/Lead plan vs fact; sync writes fact days only" },
    { section: "updated_at", content: syncedAt }
  ];

  const settings = [
    { key: "contract_version", value: SALES_OS_CONTRACT_VERSION, notes: "99_EXPORT contract", updated_at: syncedAt },
    { key: "source_spreadsheet_id", value: getSalesOsSourceSpreadsheetId(), notes: "mother", updated_at: syncedAt },
    { key: "sales_os_spreadsheet_id", value: getSalesOsSpreadsheetId(), notes: "this workbook", updated_at: syncedAt },
    { key: "periods", value: periods.join(","), notes: "loaded periods", updated_at: syncedAt },
    { key: "weighted_pipeline_enabled", value: "false", notes: "no invented probabilities", updated_at: syncedAt },
    { key: "currency_default", value: "EUR", notes: "Current amounts assumed EUR", updated_at: syncedAt }
  ];

  return {
    readme,
    settings,
    managers,
    leads,
    deals,
    stageMap,
    stageHistory,
    invoiceEvents,
    paymentEvents,
    pipeline,
    dialogLinks,
    dataQuality,
    dailyFact,
    funnelFact,
    exportRows
  };
}
