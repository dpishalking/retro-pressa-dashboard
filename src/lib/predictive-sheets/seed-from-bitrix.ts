import {
  BITRIX_INVOICE_DATE_FIELD,
  BITRIX_INVOICE_STAGE_ID,
  BITRIX_SALES_CATEGORY_ID,
  EXCLUDED_LEAD_STATUS_IDS
} from "@/lib/bitrix/metric-definitions";
import { PAID_INVOICE_SOURCE } from "@/lib/bitrix/paid-revenue";
import { bitrixListAll } from "@/lib/bitrix/rest-client";
import { listPaidSmartInvoicesForPeriod } from "@/lib/bitrix/smart-invoices";
import { PM_SALES_MANAGERS } from "@/lib/predictive-sheets/managers";
import { mondayWeekIndex } from "@/lib/predictive-sheets/weeks";

export type WeeklyFacts = [number | null, number | null, number | null, number | null, number | null];

export type BitrixMonthFacts = {
  month: string;
  revenue: number;
  payments: number;
  invoices: number;
  revenueByWeek: WeeklyFacts;
  paymentsByWeek: WeeklyFacts;
  invoicesByWeek: WeeklyFacts;
  source: string;
};

export type BitrixManagerFacts = BitrixMonthFacts & {
  assignedById: string;
  managerName: string;
  leads: number;
  leadsByWeek: WeeklyFacts;
};

export type BitrixSalesFacts = {
  company: BitrixMonthFacts;
  byManager: Record<string, BitrixManagerFacts>;
};

type BitrixDeal = {
  ID?: string;
  OPPORTUNITY?: string;
  CLOSEDATE?: string;
  DATE_CREATE?: string;
  ASSIGNED_BY_ID?: string;
  [key: string]: string | undefined;
};

type BitrixLead = {
  ID?: string;
  DATE_CREATE?: string;
  ASSIGNED_BY_ID?: string;
  STATUS_ID?: string;
};

type StageHistory = { OWNER_ID?: string | number; CREATED_TIME?: string };

const EXCLUDED_LEAD_STATUS = new Set<string>(EXCLUDED_LEAD_STATUS_IDS);
const BITRIX_SOURCE = `${PAID_INVOICE_SOURCE}; счета (дата «Выставлен счет» / стадия 1)`;

function monthBounds(month: string, throughDate?: string): { startDate: string; endDate: string } {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const monthEnd = `${month}-${String(last).padStart(2, "0")}`;
  const cap = throughDate?.slice(0, 10);
  const endDate = cap && cap.startsWith(month) && cap < monthEnd ? cap : monthEnd;
  return {
    startDate: `${month}-01`,
    endDate
  };
}

function emptyWeeks(): WeeklyFacts {
  return [null, null, null, null, null];
}

function addWeek(weeks: WeeklyFacts, isoDate: string, month: string, amount = 1) {
  const week = mondayWeekIndex(isoDate.slice(0, 10), month);
  if (week == null) return;
  weeks[week - 1] = (weeks[week - 1] ?? 0) + amount;
}

function emptyManagerFacts(month: string, assignedById: string, managerName: string): BitrixManagerFacts {
  return {
    month,
    assignedById,
    managerName,
    revenue: 0,
    payments: 0,
    invoices: 0,
    leads: 0,
    revenueByWeek: emptyWeeks(),
    paymentsByWeek: emptyWeeks(),
    invoicesByWeek: emptyWeeks(),
    leadsByWeek: emptyWeeks(),
    source: `${BITRIX_SOURCE}; ASSIGNED_BY_ID=${assignedById}`
  };
}

async function listDeals(
  filter: Record<string, string | number | string[]>,
  select: string[]
): Promise<BitrixDeal[]> {
  return bitrixListAll<BitrixDeal>("crm.deal.list", {
    order: { ID: "ASC" },
    filter,
    select
  });
}

async function listDealAssignees(ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const deals = await listDeals({ "@ID": batch }, ["ID", "ASSIGNED_BY_ID"]);
    for (const deal of deals) {
      const id = String(deal.ID || "");
      if (id) map.set(id, String(deal.ASSIGNED_BY_ID || ""));
    }
  }
  return map;
}

/** Live Bitrix counts for the sales funnel (воронка Продажа, CATEGORY_ID=0), plus per-manager split. */
export async function loadBitrixSalesFacts(month: string, throughDate?: string): Promise<BitrixSalesFacts> {
  const { startDate, endDate } = monthBounds(month, throughDate);
  const managers = new Map(
    PM_SALES_MANAGERS.map((m) => [m.bitrixId, emptyManagerFacts(month, m.bitrixId, m.fullName)])
  );

  const [paid, invoicedByDate, invoiceStages, leads] = await Promise.all([
    listPaidSmartInvoicesForPeriod(startDate, endDate),
    listDeals(
      {
        [`>=${BITRIX_INVOICE_DATE_FIELD}`]: startDate,
        [`<=${BITRIX_INVOICE_DATE_FIELD}`]: endDate,
        CATEGORY_ID: BITRIX_SALES_CATEGORY_ID
      },
      ["ID", BITRIX_INVOICE_DATE_FIELD, "ASSIGNED_BY_ID"]
    ),
    bitrixListAll<StageHistory>("crm.stagehistory.list", {
      entityTypeId: 2,
      order: { CREATED_TIME: "ASC" },
      filter: {
        ">=CREATED_TIME": startDate,
        "<=CREATED_TIME": `${endDate} 23:59:59`,
        "=CATEGORY_ID": BITRIX_SALES_CATEGORY_ID,
        "=STAGE_ID": BITRIX_INVOICE_STAGE_ID
      },
      select: ["OWNER_ID", "CREATED_TIME", "STAGE_ID", "CATEGORY_ID"]
    }),
    bitrixListAll<BitrixLead>("crm.lead.list", {
      order: { ID: "ASC" },
      filter: {
        ">=DATE_CREATE": startDate,
        "<=DATE_CREATE": `${endDate} 23:59:59`
      },
      select: ["ID", "DATE_CREATE", "ASSIGNED_BY_ID", "STATUS_ID"]
    })
  ]);

  const revenueByWeek = emptyWeeks();
  const paymentsByWeek = emptyWeeks();
  let revenue = 0;
  for (const invoice of paid) {
    const amount = Number(invoice.opportunity) || 0;
    revenue += amount;
    const completedAt = invoice.paymentDate || invoice.closeDate || "";
    if (completedAt) {
      addWeek(revenueByWeek, completedAt, month, amount);
      addWeek(paymentsByWeek, completedAt, month, 1);
    }
    const bucket = managers.get(String(invoice.assignedById || ""));
    if (!bucket) continue;
    bucket.revenue += amount;
    bucket.payments += 1;
    if (completedAt) {
      addWeek(bucket.revenueByWeek, completedAt, month, amount);
      addWeek(bucket.paymentsByWeek, completedAt, month, 1);
    }
  }

  const invoiceIds = new Set<string>();
  const invoicesByWeek = emptyWeeks();
  const invoiceAssignee = new Map<string, string>();
  const invoiceDate = new Map<string, string>();

  for (const deal of invoicedByDate) {
    const id = String(deal.ID || "");
    if (!id || invoiceIds.has(id)) continue;
    invoiceIds.add(id);
    const when = String(deal[BITRIX_INVOICE_DATE_FIELD] || "");
    invoiceDate.set(id, when);
    invoiceAssignee.set(id, String(deal.ASSIGNED_BY_ID || ""));
    addWeek(invoicesByWeek, when, month);
  }
  for (const row of invoiceStages) {
    const id = String(row.OWNER_ID || "");
    if (!id || invoiceIds.has(id)) continue;
    invoiceIds.add(id);
    const when = String(row.CREATED_TIME || "");
    invoiceDate.set(id, when);
    addWeek(invoicesByWeek, when, month);
  }

  const missingAssignee = [...invoiceIds].filter((id) => !invoiceAssignee.has(id));
  if (missingAssignee.length) {
    const fetched = await listDealAssignees(missingAssignee);
    for (const [id, assigned] of fetched) invoiceAssignee.set(id, assigned);
  }

  for (const id of invoiceIds) {
    const bucket = managers.get(invoiceAssignee.get(id) || "");
    if (!bucket) continue;
    bucket.invoices += 1;
    addWeek(bucket.invoicesByWeek, invoiceDate.get(id) || "", month);
  }

  for (const lead of leads) {
    if (EXCLUDED_LEAD_STATUS.has(String(lead.STATUS_ID || ""))) continue;
    const bucket = managers.get(String(lead.ASSIGNED_BY_ID || ""));
    if (!bucket) continue;
    bucket.leads += 1;
    addWeek(bucket.leadsByWeek, String(lead.DATE_CREATE || ""), month);
  }

  for (const bucket of managers.values()) {
    bucket.revenue = Number(bucket.revenue.toFixed(2));
  }

  return {
    company: {
      month,
      revenue: Number(revenue.toFixed(2)),
      payments: paid.length,
      invoices: invoiceIds.size,
      revenueByWeek,
      paymentsByWeek,
      invoicesByWeek,
      source: BITRIX_SOURCE
    },
    byManager: Object.fromEntries(managers)
  };
}

/** Live Bitrix counts for the sales funnel (воронка Продажа, CATEGORY_ID=0). */
export async function loadBitrixMonthFacts(month: string, throughDate?: string): Promise<BitrixMonthFacts> {
  const { company } = await loadBitrixSalesFacts(month, throughDate);
  return company;
}

export function weekFact(weeks: WeeklyFacts, week1to5: number): number | null {
  return weeks[week1to5 - 1] ?? null;
}
