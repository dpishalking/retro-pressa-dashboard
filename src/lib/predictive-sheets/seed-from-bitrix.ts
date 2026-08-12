import {
  BITRIX_INVOICE_DATE_FIELD,
  BITRIX_INVOICE_STAGE_ID,
  BITRIX_SALES_CATEGORY_ID
} from "@/lib/bitrix/metric-definitions";
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

type BitrixDeal = {
  ID?: string;
  OPPORTUNITY?: string;
  CLOSEDATE?: string;
  DATE_CREATE?: string;
  [key: string]: string | undefined;
};

type StageHistory = { OWNER_ID?: string | number; CREATED_TIME?: string };

function webhookUrl(): string {
  const url = process.env.BITRIX_WEBHOOK_URL?.trim();
  if (!url) throw new Error("BITRIX_WEBHOOK_URL is not configured");
  return url.endsWith("/") ? url : `${url}/`;
}

function monthBounds(month: string): { startDate: string; endDate: string } {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return {
    startDate: `${month}-01`,
    endDate: `${month}-${String(last).padStart(2, "0")}`
  };
}

function emptyWeeks(): WeeklyFacts {
  return [null, null, null, null, null];
}

function addWeek(weeks: WeeklyFacts, isoDate: string, month: string) {
  const week = mondayWeekIndex(isoDate.slice(0, 10), month);
  if (week == null) return;
  weeks[week - 1] = (weeks[week - 1] ?? 0) + 1;
}

async function bitrixList<T>(method: string, body: Record<string, unknown>): Promise<T[]> {
  const out: T[] = [];
  let start = 0;
  for (;;) {
    const res = await fetch(`${webhookUrl()}${method}.json`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...body, start }),
      cache: "no-store"
    });
    const data = (await res.json()) as {
      result?: T[] | { items?: T[] };
      next?: number;
      error?: string;
      error_description?: string;
    };
    if (data.error) {
      throw new Error(`Bitrix ${method}: ${data.error_description || data.error}`);
    }
    const rows = Array.isArray(data.result)
      ? data.result
      : Array.isArray((data.result as { items?: T[] } | undefined)?.items)
        ? ((data.result as { items: T[] }).items)
        : [];
    out.push(...rows);
    if (data.next == null) break;
    start = data.next;
  }
  return out;
}

async function listDeals(filter: Record<string, string | number>, select: string[]): Promise<BitrixDeal[]> {
  return bitrixList<BitrixDeal>("crm.deal.list", {
    order: { ID: "ASC" },
    filter,
    select
  });
}

/** Live Bitrix counts for the sales funnel (воронка Продажа, CATEGORY_ID=0). */
export async function loadBitrixMonthFacts(month: string): Promise<BitrixMonthFacts> {
  const { startDate, endDate } = monthBounds(month);

  const [won, invoicedByDate, invoiceStages] = await Promise.all([
    listDeals(
      {
        ">=CLOSEDATE": startDate,
        "<=CLOSEDATE": endDate,
        STAGE_SEMANTIC_ID: "S",
        CATEGORY_ID: BITRIX_SALES_CATEGORY_ID
      },
      ["ID", "OPPORTUNITY", "CLOSEDATE"]
    ),
    listDeals(
      {
        [`>=${BITRIX_INVOICE_DATE_FIELD}`]: startDate,
        [`<=${BITRIX_INVOICE_DATE_FIELD}`]: endDate,
        CATEGORY_ID: BITRIX_SALES_CATEGORY_ID
      },
      ["ID", BITRIX_INVOICE_DATE_FIELD]
    ),
    bitrixList<StageHistory>("crm.stagehistory.list", {
      entityTypeId: 2,
      order: { CREATED_TIME: "ASC" },
      filter: {
        ">=CREATED_TIME": startDate,
        "<=CREATED_TIME": `${endDate} 23:59:59`,
        "=CATEGORY_ID": BITRIX_SALES_CATEGORY_ID,
        "=STAGE_ID": BITRIX_INVOICE_STAGE_ID
      },
      select: ["OWNER_ID", "CREATED_TIME", "STAGE_ID", "CATEGORY_ID"]
    })
  ]);

  const revenueByWeek = emptyWeeks();
  const paymentsByWeek = emptyWeeks();
  let revenue = 0;
  for (const deal of won) {
    const amount = Number(deal.OPPORTUNITY) || 0;
    revenue += amount;
    const close = String(deal.CLOSEDATE || "");
    if (!close) continue;
    const week = mondayWeekIndex(close.slice(0, 10), month);
    if (week == null) continue;
    const idx = week - 1;
    revenueByWeek[idx] = (revenueByWeek[idx] ?? 0) + amount;
    paymentsByWeek[idx] = (paymentsByWeek[idx] ?? 0) + 1;
  }

  const invoiceIds = new Set<string>();
  const invoicesByWeek = emptyWeeks();
  for (const deal of invoicedByDate) {
    const id = String(deal.ID || "");
    if (!id || invoiceIds.has(id)) continue;
    invoiceIds.add(id);
    addWeek(invoicesByWeek, String(deal[BITRIX_INVOICE_DATE_FIELD] || ""), month);
  }
  for (const row of invoiceStages) {
    const id = String(row.OWNER_ID || "");
    if (!id || invoiceIds.has(id)) continue;
    invoiceIds.add(id);
    addWeek(invoicesByWeek, String(row.CREATED_TIME || ""), month);
  }

  return {
    month,
    revenue: Number(revenue.toFixed(2)),
    payments: won.length,
    invoices: invoiceIds.size,
    revenueByWeek,
    paymentsByWeek,
    invoicesByWeek,
    source: "Bitrix CATEGORY_ID=0: WON CLOSEDATE + счета (дата «Выставлен счет» / стадия 1)"
  };
}

export function weekFact(weeks: WeeklyFacts, week1to5: number): number | null {
  return weeks[week1to5 - 1] ?? null;
}
