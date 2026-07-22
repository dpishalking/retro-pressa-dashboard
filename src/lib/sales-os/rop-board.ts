import {
  ROP_BOARD_COLUMNS,
  ROP_PLAN_SETTING_DEFAULTS,
  ROP_PLAN_SETTING_KEYS
} from "@/config/sales-os";
import { parseSheetNumber } from "@/lib/os-sheets/sales-metric-defs";
import {
  mariaHasPaidFact,
  mariaRowForDate,
  sumMariaMonth,
  type MariaDailyRow
} from "@/lib/sales-os/maria-daily";

export type RopBoardRow = Record<(typeof ROP_BOARD_COLUMNS)[number], string>;
export type SettingsRow = { key: string; value: string; notes: string; updated_at: string };
export type DailyFactLike = {
  date: string;
  manager_id: string;
  manager_name: string;
  deals_created?: string;
  payments?: string;
  revenue?: string;
  invoices?: string;
  invoice_amount?: string;
  active_pipeline_deals?: string;
  active_pipeline_amount?: string;
};
export type PipelineLike = {
  assigned_by_id?: string;
  assigned_by_name?: string;
  opportunity?: string;
};

export type TrafficLight = "GREEN" | "YELLOW" | "RED" | "NO_PLAN";

function row(
  section: string,
  item: string,
  value: string,
  status = "",
  hint = ""
): RopBoardRow {
  return { section, item, value, status, hint };
}

export function settingsMap(rows: Array<{ key?: string; value?: string }>): Record<string, string> {
  const map: Record<string, string> = {};
  for (const item of rows) {
    const key = String(item.key ?? "").trim();
    if (key) map[key] = String(item.value ?? "").trim();
  }
  return map;
}

/**
 * Merge system settings with preserved manual plan keys from the existing sheet.
 * Never overwrites a non-empty plan value already on the sheet.
 */
export function mergeSettingsWithRopPlan(input: {
  systemSettings: SettingsRow[];
  existingSettings: SettingsRow[];
  syncedAt: string;
  defaultPlanMonth?: string;
}): SettingsRow[] {
  const existing = settingsMap(input.existingSettings);
  const byKey = new Map<string, SettingsRow>();

  for (const item of input.systemSettings) {
    byKey.set(item.key, { ...item });
  }

  const defaults = {
    ...ROP_PLAN_SETTING_DEFAULTS,
    plan_month: input.defaultPlanMonth || ROP_PLAN_SETTING_DEFAULTS.plan_month
  };

  for (const key of ROP_PLAN_SETTING_KEYS) {
    const current = existing[key];
    const value = current != null && String(current).trim() !== "" ? String(current).trim() : defaults[key];
    const notes =
      key === "plan_paid_revenue_eur"
        ? "Manual monthly revenue plan EUR — edit value, sync keeps it"
        : key === "plan_payments_count"
          ? "Optional monthly payments plan — edit value, sync keeps it"
          : key === "plan_month"
            ? "YYYY-MM plan month for ROP board"
            : key === "rop_flueger_source"
              ? "maria = use 15_Maria_Daily for day invoices/payments when filled"
              : key.startsWith("traffic_light")
                ? "Pace deviation threshold % (negative = behind plan)"
                : "Active deals above this = overload risk";
    byKey.set(key, {
      key,
      value,
      notes,
      updated_at: input.syncedAt
    });
  }

  return [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key));
}

export function daysInMonth(month: string): number {
  const match = month.match(/^(\d{4})-(\d{2})$/);
  if (!match) return 30;
  const year = Number(match[1]);
  const mon = Number(match[2]);
  return new Date(Date.UTC(year, mon, 0)).getUTCDate();
}

export function dayOfMonth(isoDate: string): number {
  const day = isoDate.slice(8, 10);
  const n = Number(day);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export function expectedPaceAmount(plan: number, month: string, today: string): number {
  if (plan <= 0) return 0;
  const days = daysInMonth(month);
  const day = Math.min(dayOfMonth(today), days);
  return (plan * day) / days;
}

export function paceDeviationPct(fact: number, expected: number): number | null {
  if (expected <= 0) return null;
  return ((fact - expected) / expected) * 100;
}

export function classifyTrafficLight(input: {
  deviationPct: number | null;
  yellowPct: number;
  redPct: number;
  hasPlan: boolean;
}): TrafficLight {
  if (!input.hasPlan || input.deviationPct == null) return "NO_PLAN";
  if (input.deviationPct <= input.redPct) return "RED";
  if (input.deviationPct <= input.yellowPct) return "YELLOW";
  return "GREEN";
}

function sumMonth(
  daily: DailyFactLike[],
  month: string,
  field: "deals_created" | "payments" | "revenue"
): number {
  let total = 0;
  for (const item of daily) {
    if (!String(item.date || "").startsWith(month)) continue;
    total += parseSheetNumber(item[field]);
  }
  return total;
}

function yesterdayKey(today: string): string {
  const ts = Date.parse(`${today}T12:00:00Z`);
  if (!Number.isFinite(ts)) return today;
  return new Date(ts - 86400000).toISOString().slice(0, 10);
}

export function buildRopBoard(input: {
  settings: Array<{ key?: string; value?: string }>;
  dailyFact: DailyFactLike[];
  pipeline: PipelineLike[];
  mariaDaily?: MariaDailyRow[];
  mariaSnapshot?: Array<{ key?: string; value?: string }>;
  today?: string;
  syncedAt?: string;
}): RopBoardRow[] {
  const today = (input.today || new Date().toISOString().slice(0, 10)).slice(0, 10);
  const syncedAt = input.syncedAt || new Date().toISOString();
  const cfg = settingsMap(input.settings);
  const snap = settingsMap(input.mariaSnapshot || []);
  const flueger = (cfg.rop_flueger_source || "maria").trim().toLowerCase();
  const useMaria = flueger !== "system";
  const mariaRows = input.mariaDaily || [];

  const planMonth = (cfg.plan_month || today.slice(0, 7)).trim();
  const planRevenueFromSettings = parseSheetNumber(cfg.plan_paid_revenue_eur);
  const planRevenueFromMaria = parseSheetNumber(snap.plan_revenue || snap.plan_runrate_revenue);
  const planRevenue = planRevenueFromSettings || planRevenueFromMaria;
  const planPayments = parseSheetNumber(cfg.plan_payments_count) || parseSheetNumber(snap.plan_sales);
  const yellowPct = parseSheetNumber(cfg.traffic_light_yellow_pct || "-5");
  const redPct = parseSheetNumber(cfg.traffic_light_red_pct || "-15");
  const overloadThreshold = parseSheetNumber(cfg.overload_active_deals_threshold || "40") || 40;

  const systemRevenue = sumMonth(input.dailyFact, planMonth, "revenue");
  const systemPayments = sumMonth(input.dailyFact, planMonth, "payments");
  const factDeals = sumMonth(input.dailyFact, planMonth, "deals_created");
  const mariaMonth = sumMariaMonth(mariaRows, planMonth);
  const snapRevenue = parseSheetNumber(snap.month_revenue);
  const snapSales = parseSheetNumber(snap.month_sales_count);

  // Month pace priority: Maria truth sheet month → sum of Maria daily → system.
  let factRevenue = systemRevenue;
  let factPayments = systemPayments;
  let factSource = "SYSTEM";
  if (useMaria && snapRevenue > 0) {
    factRevenue = snapRevenue;
    factPayments = snapSales || factPayments;
    factSource = "MARIA_SHEET";
  } else if (useMaria && mariaMonth.daysWithPaid > 0) {
    factRevenue = mariaMonth.paidAmount;
    factPayments = mariaMonth.paidCount;
    factSource = "MARIA";
  }

  const expectedRevenue = expectedPaceAmount(planRevenue, planMonth, today);
  const deviation = paceDeviationPct(factRevenue, expectedRevenue);
  const light = classifyTrafficLight({
    deviationPct: deviation,
    yellowPct,
    redPct,
    hasPlan: planRevenue > 0
  });

  const yday = yesterdayKey(today);
  let yDeals = 0;
  let ySystemPayments = 0;
  let ySystemRevenue = 0;
  let ySystemInvoices = 0;
  let ySystemInvoiceAmount = 0;
  for (const item of input.dailyFact) {
    if (item.date !== yday) continue;
    yDeals += parseSheetNumber(item.deals_created);
    ySystemPayments += parseSheetNumber(item.payments);
    ySystemRevenue += parseSheetNumber(item.revenue);
    ySystemInvoices += parseSheetNumber(item.invoices);
    ySystemInvoiceAmount += parseSheetNumber(item.invoice_amount);
  }

  const mariaY = useMaria ? mariaRowForDate(mariaRows, yday) : null;
  const snapDate = String(snap.report_date || "").trim();
  const snapMatchesYesterday = snapDate === yday;
  const yesterdayFromMaria = Boolean(
    mariaHasPaidFact(mariaY)
    || (mariaY && String(mariaY.invoices_count || "").trim() !== "")
    || (snapMatchesYesterday && parseSheetNumber(snap.yesterday_invoices_count) > 0)
  );

  const yInvoices = snapMatchesYesterday && parseSheetNumber(snap.yesterday_invoices_count) > 0
    ? parseSheetNumber(snap.yesterday_invoices_count)
    : yesterdayFromMaria && mariaY
      ? parseSheetNumber(mariaY.invoices_count)
      : ySystemInvoices;
  const yInvoiceAmount = snapMatchesYesterday && String(snap.yesterday_invoices_amount || "").trim() !== ""
    ? parseSheetNumber(snap.yesterday_invoices_amount)
    : yesterdayFromMaria && mariaY
      ? parseSheetNumber(mariaY.invoices_amount)
      : ySystemInvoiceAmount;
  const yPayments = yesterdayFromMaria && mariaY && mariaHasPaidFact(mariaY)
    ? parseSheetNumber(mariaY.paid_total_count)
    : ySystemPayments;
  const yRevenue = yesterdayFromMaria && mariaY && mariaHasPaidFact(mariaY)
    ? parseSheetNumber(mariaY.paid_total_amount)
    : ySystemRevenue;
  const yPaidSameDayCount = yesterdayFromMaria && mariaY ? parseSheetNumber(mariaY.paid_same_day_count) : 0;
  const yPaidSameDayAmount = yesterdayFromMaria && mariaY ? parseSheetNumber(mariaY.paid_same_day_amount) : 0;
  const yStatus = yesterdayFromMaria ? (snapMatchesYesterday ? "MARIA_SHEET" : "MARIA") : "SYSTEM";

  const pipelineCount = input.pipeline.length;
  const pipelineAmount = input.pipeline.reduce((sum, item) => sum + parseSheetNumber(item.opportunity), 0);

  type Mgr = {
    id: string;
    name: string;
    deals: number;
    payments: number;
    revenue: number;
    active: number;
    activeAmount: number;
  };
  const managers = new Map<string, Mgr>();
  const bump = (id: string, name: string) => {
    let item = managers.get(id);
    if (!item) {
      item = { id, name: name || `ID ${id}`, deals: 0, payments: 0, revenue: 0, active: 0, activeAmount: 0 };
      managers.set(id, item);
    }
    if (name) item.name = name;
    return item;
  };

  for (const item of input.dailyFact) {
    if (!String(item.date || "").startsWith(planMonth)) continue;
    if (!item.manager_id) continue;
    const mgr = bump(item.manager_id, item.manager_name || "");
    mgr.deals += parseSheetNumber(item.deals_created);
    mgr.payments += parseSheetNumber(item.payments);
    mgr.revenue += parseSheetNumber(item.revenue);
  }

  for (const item of input.pipeline) {
    const id = String(item.assigned_by_id || "").trim();
    if (!id) continue;
    const mgr = bump(id, item.assigned_by_name || "");
    mgr.active += 1;
    mgr.activeAmount += parseSheetNumber(item.opportunity);
  }

  const managerList = [...managers.values()].sort((a, b) => b.revenue - a.revenue || a.name.localeCompare(b.name, "ru"));

  const actions: string[] = [];
  if (!yesterdayFromMaria && useMaria) {
    actions.push(`Обнови «Отчет день/месяц» (дата вчера ${yday}) или строку в 15_Maria_Daily`);
  }
  if (light === "NO_PLAN") {
    actions.push("План выручки: ПЛАН в таблице Марии или plan_paid_revenue_eur в 01_Settings");
  } else if (light === "RED") {
    actions.push(`Отстаём от темпа выручки (${deviation?.toFixed(1)}%). Сегодня фокус на закрытие`);
  } else if (light === "YELLOW") {
    actions.push(`Темп выручки желтый (${deviation?.toFixed(1)}%). Проверь оплаты на сегодня`);
  } else if (actions.length === 0) {
    actions.push("Темп выручки в норме. Удерживай закрытие");
  }

  const overloaded = managerList.filter((m) => m.active >= overloadThreshold).sort((a, b) => b.active - a.active);
  if (overloaded[0] && actions.length < 3) {
    actions.push(`${overloaded[0].name}: перегруз (${overloaded[0].active} активных) — сними часть портфеля`);
  }

  const idleWithPortfolio = managerList.filter((m) => m.active >= 5 && m.payments === 0);
  if (idleWithPortfolio[0] && actions.length < 3) {
    actions.push(`${idleWithPortfolio[0].name}: есть активные, но нет оплат в месяце — разбор до обеда`);
  }
  if (yesterdayFromMaria && yPayments === 0 && yInvoices > 0 && actions.length < 3) {
    actions.push("Вчера счета были, оплат по Марии 0 — добей выставленное");
  }
  while (actions.length < 3) {
    actions.push("Сверь 16_Maria_Snapshot с планом и поставь 3 сделки на контроль");
  }

  const out: RopBoardRow[] = [];
  out.push(row("header", "board_title", "ROP Board — утренний пульт", "", "Смотри только этот лист каждое утро"));
  out.push(row("header", "as_of_date", today, "", ""));
  out.push(row("header", "plan_month", planMonth, "", "Месяц плана из 01_Settings"));
  out.push(row("header", "flueger", useMaria ? "maria_truth_sheet" : "system", useMaria ? "MARIA" : "SYSTEM", "Эталон: Отчет показатели RETRO PRESSA"));
  out.push(row("header", "synced_at", syncedAt, "", ""));

  out.push(row(
    "plan_pace",
    "plan_revenue_eur",
    planRevenue ? String(planRevenue) : "",
    light === "NO_PLAN" ? "NO_PLAN" : (planRevenueFromSettings ? "SETTINGS" : "MARIA_SHEET"),
    planRevenueFromSettings ? "01_Settings" : "ПЛАН Выручка из таблицы Марии"
  ));
  out.push(row("plan_pace", "fact_revenue_eur", String(Number(factRevenue.toFixed(2))), factSource, factSource === "MARIA_SHEET" ? "Выручка (мес) из Отчет день/месяц" : factSource === "MARIA" ? "Сумма paid_total из 15_Maria_Daily" : "Системный WON"));
  out.push(row("plan_pace", "expected_pace_eur", expectedRevenue ? String(Number(expectedRevenue.toFixed(2))) : "", "", "Линейный темп на сегодня"));
  out.push(row(
    "plan_pace",
    "deviation_pct",
    deviation == null ? "" : String(Number(deviation.toFixed(1))),
    light,
    "Факт относительно темпа, %"
  ));
  out.push(row("plan_pace", "traffic_light", light, light, "GREEN ≥ yellow; YELLOW; RED ≤ red threshold"));
  out.push(row("plan_pace", "plan_payments", planPayments ? String(planPayments) : "", "", "План продаж (шт)"));
  out.push(row("plan_pace", "fact_payments", String(factPayments), factSource, factSource === "MARIA_SHEET" ? "Продаж (мес)" : ""));
  out.push(row("plan_pace", "fact_deals", String(factDeals), "SYSTEM", "Новые сделки месяца (система)"));
  if (snap.month_invoices_count) {
    out.push(row("plan_pace", "maria_month_invoices", `${snap.month_invoices_count} / ${snap.month_invoices_amount || ""}`, "MARIA_SHEET", "Счета месяца из таблицы Марии"));
  }

  out.push(row("yesterday", "date", yday, yStatus, yesterdayFromMaria ? "Факт Марии" : "Нет строки Марии — системный fallback"));
  out.push(row("yesterday", "deals", String(yDeals), "SYSTEM", "Новые сделки (система)"));
  out.push(row("yesterday", "invoices_count", String(yInvoices), yStatus, "Выставлено счетов"));
  out.push(row("yesterday", "invoices_amount", String(Number(yInvoiceAmount.toFixed(2))), yStatus, "€"));
  out.push(row("yesterday", "paid_same_day_count", yesterdayFromMaria ? String(yPaidSameDayCount) : "", yStatus, "Из выставленных вчера — оплачены вчера"));
  out.push(row("yesterday", "paid_same_day_amount", yesterdayFromMaria ? String(Number(yPaidSameDayAmount.toFixed(2))) : "", yStatus, "€"));
  out.push(row("yesterday", "paid_total_count", String(yPayments), yStatus, "Всего оплачено вчера"));
  out.push(row("yesterday", "paid_total_amount", String(Number(yRevenue.toFixed(2))), yStatus, "€ — главный денежный факт дня"));
  if (yesterdayFromMaria) {
    out.push(row(
      "yesterday",
      "system_compare",
      `system_pay=${ySystemPayments}/${Number(ySystemRevenue.toFixed(2))}; system_inv=${ySystemInvoices}/${Number(ySystemInvoiceAmount.toFixed(2))}`,
      "INFO",
      "Система для сверки, не для управления"
    ));
  }

  out.push(row("pipeline", "active_deals", String(pipelineCount), "", "Сделки в работе сейчас"));
  out.push(row("pipeline", "active_amount_eur", String(Number(pipelineAmount.toFixed(2))), "", ""));

  for (const mgr of managerList.slice(0, 40)) {
    let status = "ok";
    let hint = "";
    if (mgr.active >= overloadThreshold) {
      status = "risk_overload";
      hint = "Слишком много активных";
    } else if (mgr.active >= 5 && mgr.payments === 0) {
      status = "risk_idle";
      hint = "Портфель есть, оплат в месяце нет";
    } else if (mgr.deals + mgr.payments === 0 && mgr.active === 0) {
      continue;
    }
    out.push(row(
      "managers",
      `${mgr.name} (${mgr.id})`,
      `rev=${Number(mgr.revenue.toFixed(2))}; pay=${mgr.payments}; deals=${mgr.deals}; active=${mgr.active}`,
      status,
      hint || `portfolio_eur=${Number(mgr.activeAmount.toFixed(2))}`
    ));
  }

  actions.slice(0, 3).forEach((text, index) => {
    out.push(row("actions", `action_${index + 1}`, text, light === "RED" && index === 0 ? "RED" : "", "Сделай сегодня"));
  });

  return out;
}
