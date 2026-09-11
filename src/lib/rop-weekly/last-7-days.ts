/**
 * ROP snapshot for rolling last 7 days (Europe/Riga) — exact metric labels for leadership report.
 */

import {
  getRopWeeklySpreadsheetId,
  ropWeeklySpreadsheetUrl
} from "@/config/rop-weekly";
import {
  BITRIX_QUALIFIED_LEAD_STATUS_ID,
  EXCLUDED_LEAD_STATUS_IDS
} from "@/lib/bitrix/metric-definitions";
import { arrayResult, bitrixList, bitrixListAll } from "@/lib/bitrix/rest-client";
import { listPaidSmartInvoicesForPeriod } from "@/lib/bitrix/smart-invoices";
import { writeSheetTab } from "@/lib/google/sheets-client";
import { rigaTodayIso } from "@/lib/sales/manager-schedule";
import { pullSvodMonthPlans } from "@/lib/sales-os/svod-plans";

export const ROP_LAST7_TAB = "РОП · 7 дней";

const EXCLUDED = new Set<string>(EXCLUDED_LEAD_STATUS_IDS);
const INVOICE_CANCELLED = "DT31_2:D";

type SheetCell = string | number | boolean | null;
type SheetRow = SheetCell[];

type BitrixLead = {
  ID?: string;
  STATUS_ID?: string;
  DATE_CREATE?: string;
};

type BitrixInvoice = {
  id?: string | number;
  opportunity?: string | number;
  assignedById?: string | number;
  createdTime?: string;
  movedTime?: string;
  stageId?: string;
};

function money(value: number) {
  return Math.round(value * 100) / 100;
}

function asNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function pct(num: number, den: number) {
  if (!den) return 0;
  return Math.round((num / den) * 1000) / 10;
}

function formatSyncedAt() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Riga",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  })
    .format(new Date())
    .replace(",", "");
}

function rigaIso(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Riga",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function addDaysIso(day: string, delta: number) {
  const d = new Date(`${day}T12:00:00+03:00`);
  d.setUTCDate(d.getUTCDate() + delta);
  return rigaIso(d);
}

function daysInMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function dayOfMonth(day: string) {
  return Number(day.slice(8, 10));
}

async function countActivities(from: string, to: string) {
  const page = await bitrixList("crm.activity.list", {
    filter: {
      TYPE_ID: "6",
      PROVIDER_ID: "IMOPENLINES_SESSION",
      ">=CREATED": from,
      "<=CREATED": to
    },
    select: ["ID"],
    start: -1
  });
  const total = (page as { total?: number }).total;
  if (typeof total === "number") return total;
  return arrayResult(page.result).length;
}

async function countNewLeadsStock() {
  const page = await bitrixList("crm.lead.list", {
    filter: { STATUS_ID: "NEW" },
    select: ["ID"],
    start: -1
  });
  const total = (page as { total?: number }).total;
  if (typeof total === "number") return total;
  return arrayResult(page.result).length;
}

export type RopLast7Report = {
  periodFrom: string;
  periodTo: string;
  prevFrom: string;
  prevTo: string;
  month: string;
  syncedAt: string;
  metrics: Array<{ label: string; value: number | string; note?: string }>;
};

export async function buildRopLast7DaysReport(input?: {
  endDay?: string;
}): Promise<RopLast7Report> {
  const periodTo = input?.endDay?.trim() || rigaTodayIso();
  const periodFrom = addDaysIso(periodTo, -6);
  const prevTo = addDaysIso(periodFrom, -1);
  const prevFrom = addDaysIso(prevTo, -6);
  const month = periodTo.slice(0, 7);
  const monthStart = `${month}-01`;
  const syncedAt = formatSyncedAt();

  const from = `${periodFrom}T00:00:00+03:00`;
  const to = `${periodTo}T23:59:59+03:00`;

  const [
    leadsRaw,
    invoicesCreated,
    invoicesMoved,
    cancelled,
    payments,
    paymentsPrev,
    paymentsMonth,
    dialogs,
    leadTail,
    monthPlan
  ] = await Promise.all([
    bitrixListAll<BitrixLead>("crm.lead.list", {
      filter: { ">=DATE_CREATE": from, "<=DATE_CREATE": to },
      select: ["ID", "STATUS_ID", "DATE_CREATE"],
      order: { ID: "ASC" }
    }),
    bitrixListAll<BitrixInvoice>("crm.item.list", {
      entityTypeId: 31,
      filter: { ">=createdTime": from, "<=createdTime": to },
      select: ["id", "opportunity", "assignedById", "createdTime", "movedTime", "stageId"],
      order: { id: "ASC" }
    }).catch(() => [] as BitrixInvoice[]),
    bitrixListAll<BitrixInvoice>("crm.item.list", {
      entityTypeId: 31,
      filter: { ">=movedTime": from, "<=movedTime": to },
      select: ["id", "opportunity", "assignedById", "createdTime", "movedTime", "stageId"],
      order: { id: "ASC" }
    }).catch(() => [] as BitrixInvoice[]),
    bitrixListAll<BitrixInvoice>("crm.item.list", {
      entityTypeId: 31,
      filter: {
        stageId: INVOICE_CANCELLED,
        ">=movedTime": from,
        "<=movedTime": to
      },
      select: ["id", "opportunity", "movedTime"],
      order: { id: "ASC" }
    }).catch(() => [] as BitrixInvoice[]),
    listPaidSmartInvoicesForPeriod(periodFrom, periodTo),
    listPaidSmartInvoicesForPeriod(prevFrom, prevTo),
    listPaidSmartInvoicesForPeriod(monthStart, periodTo),
    countActivities(from, to),
    countNewLeadsStock(),
    pullSvodMonthPlans({ month }).catch(() => null)
  ]);

  const leads = leadsRaw.filter((lead) => !EXCLUDED.has(String(lead.STATUS_ID || "")));
  const leadsTaken = leads.filter((lead) => String(lead.STATUS_ID || "") !== "NEW").length;
  const quals = leads.filter(
    (lead) => String(lead.STATUS_ID || "") === BITRIX_QUALIFIED_LEAD_STATUS_ID
  ).length;

  const invoicesById = new Map<string, BitrixInvoice>();
  for (const row of [...invoicesCreated, ...invoicesMoved]) {
    if (row.id == null) continue;
    // issued = not cancelled-only noise; keep all created/moved except pure cancelled stage if desired
    invoicesById.set(String(row.id), row);
  }
  // Exclude invoices that are currently cancelled from "issued" count if they only appear as D
  const invoices = [...invoicesById.values()].filter((row) => String(row.stageId || "") !== INVOICE_CANCELLED);
  const invoiceSum = invoices.reduce((sum, row) => sum + asNumber(row.opportunity), 0);
  const cancelledSum = cancelled.reduce((sum, row) => sum + asNumber(row.opportunity), 0);

  const revenue7 = payments.reduce((sum, row) => sum + asNumber(row.opportunity), 0);
  const revenuePrev = paymentsPrev.reduce((sum, row) => sum + asNumber(row.opportunity), 0);
  const revenueMonth = paymentsMonth.reduce((sum, row) => sum + asNumber(row.opportunity), 0);
  const salesCount7 = payments.length;
  const salesCountMonth = paymentsMonth.length;
  const avgCheck7 = salesCount7 ? money(revenue7 / salesCount7) : 0;
  const avgCheckMonth = salesCountMonth ? money(revenueMonth / salesCountMonth) : 0;

  const growthPct = revenuePrev > 0 ? money((revenue7 / revenuePrev - 1) * 100) : null;
  const monthPlanRevenue = monthPlan?.revenue ?? null;
  const dim = daysInMonth(month);
  const elapsed = dayOfMonth(periodTo);
  const weekPlan = monthPlanRevenue != null ? money((monthPlanRevenue / dim) * 7) : null;
  const weekPlanPct = weekPlan && weekPlan > 0 ? money((revenue7 / weekPlan) * 100) : null;
  const monthForecast = elapsed > 0 ? money((revenueMonth / elapsed) * dim) : null;
  const monthForecastPct =
    monthPlanRevenue && monthPlanRevenue > 0 && monthForecast != null
      ? money((monthForecast / monthPlanRevenue) * 100)
      : null;

  // Period totals only (not lead cohorts): count everything that happened in the window.
  const metrics: RopLast7Report["metrics"] = [
    {
      label: "Выручка общ за месяц",
      value: money(revenueMonth),
      note: `тотал оплат ${monthStart}…${periodTo} (не когорта лидов)`
    },
    {
      label: "Количество продаж",
      value: salesCountMonth,
      note: `тотал оплат за месяц ${monthStart}…${periodTo}`
    },
    {
      label: "Средний чек",
      value: avgCheckMonth,
      note: "выручка месяца / оплаты месяца"
    },
    {
      label: "Выручка предыдущей недели",
      value: money(revenuePrev),
      note: `тотал оплат ${prevFrom}…${prevTo}`
    },
    {
      label: "Рост/падение к предыдущей неделе",
      value: growthPct == null ? "н/д" : growthPct,
      note:
        growthPct == null
          ? "нет базы"
          : `% к тоталу предыдущих 7д (факт ${money(revenue7)} € vs ${money(revenuePrev)} €)`
    },
    {
      label: "Выполнение плана недели",
      value: weekPlanPct == null ? "н/д" : weekPlanPct,
      note:
        weekPlan == null
          ? "нет плана месяца в СВОД"
          : `план недели ≈ ${weekPlan} € (месяц/дни×7); тотал оплат 7д ${money(revenue7)} €`
    },
    {
      label: "Прогноз выполнения месячного плана",
      value: monthForecastPct == null ? "н/д" : monthForecastPct,
      note:
        monthPlanRevenue == null
          ? "нет плана месяца в СВОД"
          : `run-rate от тотала месяца: прогноз ${monthForecast} € / план ${monthPlanRevenue} €`
    },
    {
      label: "Лидов пришло",
      value: leads.length,
      note: `тотал созданных ${periodFrom}…${periodTo}`
    },
    {
      label: "Лидов взято",
      value: leadsTaken,
      note: "из пришедших за период уже не NEW"
    },
    {
      label: "Квалов",
      value: quals,
      note: "CONVERTED среди пришедших за период"
    },
    {
      label: "Счетов (шт)",
      value: invoices.length,
      note: "тотал выставленных/сдвинутых за период"
    },
    { label: "Счетов (евро)", value: money(invoiceSum) },
    {
      label: "Аннулированных счетов (шт)",
      value: cancelled.length,
      note: "тотал ушедших в «Не оплачено» за период"
    },
    { label: "Аннулированных (евро)", value: money(cancelledSum) },
    {
      label: "Оплат (шт)",
      value: salesCount7,
      note: `тотал оплат ${periodFrom}…${periodTo}`
    },
    {
      label: "Оплат (евро)",
      value: money(revenue7),
      note: `тотал оплат ${periodFrom}…${periodTo}`
    },
    {
      label: "Общая конверсия лид → продажа",
      value: pct(salesCount7, leads.length),
      note: "тотал оплат 7д / тотал лидов 7д (не когорта)"
    },
    {
      label: "Конверсия диалог → продажа",
      value: pct(salesCount7, dialogs),
      note: `тотал оплат 7д / тотал сессий ОЛ 7д (${dialogs})`
    },
    {
      label: "Конверсия счет → оплата",
      value: pct(salesCount7, invoices.length),
      note: "тотал оплат 7д / тотал счетов 7д"
    },
    {
      label: "Хвост лидов",
      value: leadTail,
      note: "текущий сток NEW"
    }
  ];

  return {
    periodFrom,
    periodTo,
    prevFrom,
    prevTo,
    month,
    syncedAt,
    metrics
  };
}

export async function syncRopLast7DaysReport(input?: {
  spreadsheetId?: string;
  endDay?: string;
  dryRun?: boolean;
}) {
  const spreadsheetId = input?.spreadsheetId?.trim() || getRopWeeklySpreadsheetId();
  const report = await buildRopLast7DaysReport({ endDay: input?.endDay });
  const rows: SheetRow[] = [
    [`РОП · ПОСЛЕДНИЕ 7 ДНЕЙ · ${report.periodFrom} … ${report.periodTo}`],
    [
      `Обновлено: ${report.syncedAt} (Europe/Riga)  ·  тоталы периода (не когорта)  ·  Bitrix + план СВОД`
    ],
    [],
    ["Метрика", "Значение", "Комментарий"]
  ];
  for (const metric of report.metrics) {
    rows.push([metric.label, metric.value, metric.note || ""]);
  }

  if (!input?.dryRun) {
    await writeSheetTab({
      spreadsheetId,
      tabTitle: ROP_LAST7_TAB,
      rows,
      clearRange: `'${ROP_LAST7_TAB.replace(/'/g, "''")}'!A:Z`,
      valueInputOption: "USER_ENTERED"
    });
  }

  return {
    ok: true as const,
    spreadsheetId,
    spreadsheetUrl: ropWeeklySpreadsheetUrl(),
    tabTitle: ROP_LAST7_TAB,
    dryRun: input?.dryRun === true,
    report
  };
}
