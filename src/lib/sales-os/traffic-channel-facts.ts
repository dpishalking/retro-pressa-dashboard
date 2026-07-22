import {
  EXCLUDED_LEAD_STATUS_IDS,
  PAID_LEAD_SOURCE_IDS
} from "@/lib/bitrix/metric-definitions";
import { dayOfIso } from "@/lib/sales-os/build-model";
import type { SvodDayLeads } from "@/lib/sales-os/svod-plans";
import { parseSheetNumber } from "@/lib/os-sheets/sales-metric-defs";

const paidSourceSet = new Set<string>(PAID_LEAD_SOURCE_IDS);
const excludedLeadStatus = new Set<string>(EXCLUDED_LEAD_STATUS_IDS);

export type TrafficChannel = "paid" | "organic";

export type TrafficChannelDayAgg = {
  leads: number;
  deals: number;
  invoices: number;
  sale: number;
  revenue: number;
};

export type TrafficDaySplit = {
  paid: TrafficChannelDayAgg;
  organic: TrafficChannelDayAgg;
};

function emptyAgg(): TrafficChannelDayAgg {
  return { leads: 0, deals: 0, invoices: 0, sale: 0, revenue: 0 };
}

export function isPaidLeadSourceId(sourceId: string | null | undefined): boolean {
  return paidSourceSet.has(String(sourceId || "").trim());
}

/** Paid ads UTM (facebook/cpc, paid_social, …) — complements Bitrix SOURCE_ID. */
export function isPaidUtm(utmSource?: string | null, utmMedium?: string | null): boolean {
  const source = String(utmSource || "")
    .trim()
    .toLowerCase();
  const medium = String(utmMedium || "")
    .trim()
    .toLowerCase();
  if (!source && !medium) return false;
  if (
    medium === "cpc" ||
    medium === "ppc" ||
    medium.includes("paid_social") ||
    medium.includes("social_paid") ||
    medium === "paid" ||
    /(^|[^a-z])paid([^a-z]|$)/.test(medium)
  ) {
    return true;
  }
  if (source === "paid_social" || source === "cpc" || source === "ppc") return true;
  if (["facebook", "fb", "instagram", "ig", "meta"].includes(source)) {
    return medium.includes("cpc") || medium.includes("paid") || medium.includes("social");
  }
  return false;
}

export function resolveTrafficChannel(input: {
  sourceId?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
}): TrafficChannel {
  if (isPaidLeadSourceId(input.sourceId)) return "paid";
  if (isPaidUtm(input.utmSource, input.utmMedium)) return "paid";
  return "organic";
}

export function channelOfSourceId(sourceId: string | null | undefined): TrafficChannel {
  return isPaidLeadSourceId(sourceId) ? "paid" : "organic";
}

type LeadLike = {
  lead_id?: string;
  created_at?: string;
  source_id?: string;
  status_id?: string;
  utm_source?: string;
  utm_medium?: string;
};

type DealLike = {
  deal_id?: string;
  lead_id?: string;
  created_at?: string;
  source_id?: string;
};

type InvoiceEventLike = {
  deal_id?: string;
  lead_id?: string;
  invoice_at?: string;
};

type PaymentEventLike = {
  deal_id?: string;
  lead_id?: string;
  paid_at?: string;
  amount?: string;
};

/**
 * Day × paid/organic funnel.
 * - Leads/deals: Bitrix create date + SOURCE_ID/UTM (SVOD leads overlay later)
 * - Invoices: vault `07_Invoice_Events` by invoice_at
 * - Sales/revenue: Bitrix WON mirrored in vault `08_Payment_Events` by paid_at
 */
export function aggregateTrafficChannelDaily(input: {
  month?: string;
  leads: LeadLike[];
  deals: DealLike[];
  invoiceEvents?: InvoiceEventLike[];
  paymentEvents?: PaymentEventLike[];
}): Map<string, TrafficDaySplit> {
  const out = new Map<string, TrafficDaySplit>();
  const ensure = (date: string): TrafficDaySplit => {
    let row = out.get(date);
    if (!row) {
      row = { paid: emptyAgg(), organic: emptyAgg() };
      out.set(date, row);
    }
    return row;
  };

  const leadById = new Map<string, LeadLike>();
  for (const lead of input.leads) {
    if (lead.lead_id) leadById.set(lead.lead_id, lead);
  }
  const dealById = new Map<string, DealLike>();
  for (const deal of input.deals) {
    if (deal.deal_id) dealById.set(deal.deal_id, deal);
  }

  const channelFor = (dealId?: string, leadId?: string): TrafficChannel => {
    const deal = dealId ? dealById.get(dealId) : undefined;
    const lead = leadById.get(leadId || deal?.lead_id || "");
    return resolveTrafficChannel({
      sourceId: deal?.source_id || lead?.source_id,
      utmSource: lead?.utm_source,
      utmMedium: lead?.utm_medium
    });
  };

  for (const lead of input.leads) {
    const date = dayOfIso(lead.created_at || "");
    if (!date) continue;
    if (input.month && !date.startsWith(input.month)) continue;
    if (excludedLeadStatus.has(String(lead.status_id || "").trim())) continue;
    const ch = resolveTrafficChannel({
      sourceId: lead.source_id,
      utmSource: lead.utm_source,
      utmMedium: lead.utm_medium
    });
    ensure(date)[ch].leads += 1;
  }

  for (const deal of input.deals) {
    const date = dayOfIso(deal.created_at || "");
    if (!date) continue;
    if (input.month && !date.startsWith(input.month)) continue;
    ensure(date)[channelFor(deal.deal_id, deal.lead_id)].deals += 1;
  }

  const invoiceEvents = input.invoiceEvents;
  const paymentEvents = input.paymentEvents;

  if (invoiceEvents) {
    for (const inv of invoiceEvents) {
      const date = dayOfIso(inv.invoice_at || "");
      if (!date) continue;
      if (input.month && !date.startsWith(input.month)) continue;
      ensure(date)[channelFor(inv.deal_id, inv.lead_id)].invoices += 1;
    }
  } else {
    // Legacy fallback: deals.invoice_at (under-counts older deals).
    for (const deal of input.deals) {
      const date = dayOfIso((deal as { invoice_at?: string }).invoice_at || "");
      if (!date) continue;
      if (input.month && !date.startsWith(input.month)) continue;
      ensure(date)[channelFor(deal.deal_id, deal.lead_id)].invoices += 1;
    }
  }

  if (paymentEvents) {
    for (const pay of paymentEvents) {
      const date = dayOfIso(pay.paid_at || "");
      if (!date) continue;
      if (input.month && !date.startsWith(input.month)) continue;
      const agg = ensure(date)[channelFor(pay.deal_id, pay.lead_id)];
      agg.sale += 1;
      agg.revenue += parseSheetNumber(pay.amount);
    }
  } else {
    for (const deal of input.deals) {
      const d = deal as {
        closed_at?: string;
        is_won?: string;
        stage_semantic?: string;
        opportunity?: string;
      };
      const won =
        String(d.is_won || "").toLowerCase() === "true" ||
        String(d.is_won || "") === "1" ||
        d.stage_semantic === "S";
      const date = dayOfIso(d.closed_at || "");
      if (!won || !date) continue;
      if (input.month && !date.startsWith(input.month)) continue;
      const agg = ensure(date)[channelFor(deal.deal_id, deal.lead_id)];
      agg.sale += 1;
      agg.revenue += parseSheetNumber(d.opportunity);
    }
  }

  return out;
}

/** Prefer СВОД day/Органика leads; keep vault/Bitrix money metrics. */
export function mergeSvodLeadsIntoTrafficFacts(
  bitrixByDate: Map<string, TrafficDaySplit>,
  svodLeads: Map<string, SvodDayLeads> | null | undefined
): Map<string, TrafficDaySplit> {
  const dates = new Set<string>([...bitrixByDate.keys(), ...(svodLeads?.keys() || [])]);
  const out = new Map<string, TrafficDaySplit>();
  for (const date of [...dates].sort()) {
    const base = bitrixByDate.get(date) || { paid: emptyAgg(), organic: emptyAgg() };
    const paid = { ...base.paid };
    const organic = { ...base.organic };
    const svod = svodLeads?.get(date);
    if (svod) {
      paid.leads = svod.paid;
      organic.leads = svod.organic;
    }
    out.set(date, { paid, organic });
  }
  return out;
}

export function sumTrafficChannel(
  byDate: Map<string, TrafficDaySplit>,
  channel: TrafficChannel,
  month?: string
): TrafficChannelDayAgg {
  const total = emptyAgg();
  for (const [date, split] of byDate) {
    if (month && !date.startsWith(month)) continue;
    const row = split[channel];
    total.leads += row.leads;
    total.deals += row.deals;
    total.invoices += row.invoices;
    total.sale += row.sale;
    total.revenue += row.revenue;
  }
  return total;
}

export type TrafficDiagnosisLine = {
  channel: "paid" | "organic" | "both";
  title: string;
  body: string;
};

/** Short ROP-facing notes comparing Paid vs Organic (no marketing metrics). */
export function buildTrafficDiagnosis(input: {
  paid: TrafficChannelDayAgg;
  organic: TrafficChannelDayAgg;
  paidPlanLeads?: number | null;
  organicPlanLeads?: number | null;
}): TrafficDiagnosisLine[] {
  const lines: TrafficDiagnosisLine[] = [];
  const { paid, organic } = input;
  const cr = (sale: number, leads: number) => (leads > 0 ? sale / leads : null);
  const aov = (revenue: number, sale: number) => (sale > 0 ? revenue / sale : null);

  const paidCr = cr(paid.sale, paid.leads);
  const orgCr = cr(organic.sale, organic.leads);
  const paidAov = aov(paid.revenue, paid.sale);
  const orgAov = aov(organic.revenue, organic.sale);
  const totalLeads = paid.leads + organic.leads;
  const totalRev = paid.revenue + organic.revenue;

  if (paidCr != null && orgCr != null && orgCr > 0) {
    const delta = (paidCr - orgCr) / orgCr;
    if (delta <= -0.15) {
      lines.push({
        channel: "paid",
        title: "Paid",
        body: `Конверсия Lead→Sale на ${Math.round(Math.abs(delta) * 100)}% ниже органики. Лидов много — узкое место в обработке платного потока.`
      });
    } else if (delta >= 0.15) {
      lines.push({
        channel: "organic",
        title: "Organic",
        body: `Конверсия ниже платного на ${Math.round(delta * 100)}%. Имеет смысл разобрать квалификацию органики.`
      });
    }
  }

  if (paidAov != null && orgAov != null && paidAov > 0 && orgAov / paidAov >= 1.25) {
    lines.push({
      channel: "organic",
      title: "Organic",
      body: `Средний чек выше платного (~${(orgAov / paidAov).toFixed(1)}×). Источник недоиспользован, если лидов мало относительно плана.`
    });
  }

  if (totalLeads > 0 && totalRev > 0) {
    const leadShare = paid.leads / totalLeads;
    const revShare = paid.revenue / totalRev;
    if (leadShare - revShare >= 0.12) {
      lines.push({
        channel: "paid",
        title: "Paid",
        body: `Доля лидов ${Math.round(leadShare * 100)}%, доля выручки ${Math.round(revShare * 100)}%. Платный трафик тянет объём, но меньше денег на лид.`
      });
    } else if (revShare - leadShare >= 0.12) {
      lines.push({
        channel: "paid",
        title: "Paid",
        body: `Доля выручки ${Math.round(revShare * 100)}% при ${Math.round(leadShare * 100)}% лидов — платный поток тянет план по деньгам.`
      });
    }
  }

  if (
    paid.deals > 0 &&
    paid.invoices > 0 &&
    paid.invoices / paid.deals < 0.35 &&
    organic.deals > 0 &&
    organic.invoices / organic.deals > paid.invoices / paid.deals + 0.1
  ) {
    lines.push({
      channel: "paid",
      title: "Paid",
      body: "Много сделок, мало счетов vs органика — слабая квалификация / дожим до счёта на платном."
    });
  }

  if (!lines.length) {
    lines.push({
      channel: "both",
      title: "Paid / Organic",
      body: "Сильных перекосов по CR/AOV/долям нет. Смотрите выполнение плана по каждому блоку выше."
    });
  }

  return lines.slice(0, 6);
}
