/**
 * Traffic ↔ Sales Attribution Enrichment.
 * Safe joins only: lead_id (high), unique contact_id / customer_key (medium).
 * phone_hash / email_hash: Join Quality only — never auto-attribute channel revenue.
 * Name matching forbidden. Ambiguous keys → unattributed.
 */

import {
  ATTRIBUTION_ENRICHMENT_BASELINE,
  ATTRIBUTION_GAPS_COLUMNS,
  JOIN_QUALITY_COLUMNS,
  REVENUE_ATTRIBUTION_COLUMNS
} from "@/config/traffic-management";
import {
  TRAFFIC_EXPORT_V3_COLUMNS,
  TRAFFIC_EXPORT_V3_CONTRACT_VERSION
} from "@/lib/traffic-os/export-contract";
import { resolveLeadIdentity } from "@/lib/traffic-os/taxonomy";
import {
  campaignKey,
  dayOfIso,
  num,
  periodOfDay,
  toMatrix,
  type RowMap
} from "@/lib/traffic-os/utils";

export type TrafficIdentity = {
  lead_id: string;
  traffic_type: string;
  channel: string;
  landing_id: string;
  campaign_id: string;
  lead_created_at: string;
  contact_id: string;
  customer_key: string;
};

export type AttributionMethod =
  | "lead_id"
  | "deal_lead_id"
  | "contact_id"
  | "customer_key"
  | "unknown"
  | "manual";

function pct(n: number, d: number): number | "" {
  if (!(d > 0)) return "";
  return Number(((n / d) * 100).toFixed(2));
}

/** Build unique indexes; ambiguous keys excluded from attribution maps. */
export function buildUniqueLeadIndexes(salesLeads: RowMap[]) {
  const byLead = new Map<string, RowMap>();
  const contactToLeads = new Map<string, string[]>();
  const customerToLeads = new Map<string, string[]>();

  for (const lead of salesLeads) {
    const leadId = String(lead.lead_id || "").trim();
    if (!leadId) continue;
    byLead.set(leadId, lead);
    const contactId = String(lead.contact_id || "").trim();
    if (contactId) {
      const list = contactToLeads.get(contactId) || [];
      list.push(leadId);
      contactToLeads.set(contactId, list);
    }
    const customerKey = String(lead.customer_key || "").trim();
    if (customerKey) {
      const list = customerToLeads.get(customerKey) || [];
      list.push(leadId);
      customerToLeads.set(customerKey, list);
    }
  }

  const uniqueContact = new Map<string, string>();
  let ambiguousContacts = 0;
  for (const [contactId, leads] of contactToLeads) {
    const uniq = [...new Set(leads)];
    if (uniq.length === 1) uniqueContact.set(contactId, uniq[0]);
    else ambiguousContacts += 1;
  }

  const uniqueCustomer = new Map<string, string>();
  let ambiguousCustomers = 0;
  for (const [customerKey, leads] of customerToLeads) {
    const uniq = [...new Set(leads)];
    if (uniq.length === 1) uniqueCustomer.set(customerKey, uniq[0]);
    else ambiguousCustomers += 1;
  }

  return {
    byLead,
    uniqueContact,
    uniqueCustomer,
    ambiguousContacts,
    ambiguousCustomers,
    contactLeadRows: [...contactToLeads.values()].reduce((s, v) => s + v.length, 0),
    customerLeadRows: [...customerToLeads.values()].reduce((s, v) => s + v.length, 0)
  };
}

export function identityFromLead(
  lead: RowMap,
  attributionByLead?: Map<string, Record<string, string | number>>
): TrafficIdentity {
  const leadId = String(lead.lead_id || "").trim();
  const fromAttr = attributionByLead?.get(leadId);
  if (fromAttr) {
    return {
      lead_id: leadId,
      traffic_type: String(fromAttr.traffic_type || "unknown"),
      channel: String(fromAttr.channel || "Unknown"),
      landing_id: String(fromAttr.landing_id || "landing:unknown"),
      campaign_id: String(fromAttr.campaign_key || "campaign:unknown"),
      lead_created_at: String(fromAttr.created_at || fromAttr.date || lead.created_at || ""),
      contact_id: String(lead.contact_id || ""),
      customer_key: String(lead.customer_key || "")
    };
  }
  const resolved = resolveLeadIdentity({
    sourceId: String(lead.source_id || ""),
    utmSource: String(lead.utm_source || ""),
    utmMedium: String(lead.utm_medium || "")
  });
  return {
    lead_id: leadId,
    traffic_type: resolved.traffic_type,
    channel: resolved.channel,
    landing_id: "landing:unknown",
    campaign_id: campaignKey({
      utm_source: lead.utm_source,
      utm_medium: lead.utm_medium,
      utm_campaign: lead.utm_campaign
    }),
    lead_created_at: String(lead.created_at || ""),
    contact_id: String(lead.contact_id || ""),
    customer_key: String(lead.customer_key || "")
  };
}

export function resolvePaymentAttribution(input: {
  payment: RowMap;
  deal?: RowMap;
  indexes: ReturnType<typeof buildUniqueLeadIndexes>;
  attributionByLead: Map<string, Record<string, string | number>>;
  periods: string[];
}): {
  method: AttributionMethod;
  confidence: "high" | "medium" | "low" | "unknown";
  identity: TrafficIdentity | null;
  cross_period: boolean;
  gap_reason: string;
} {
  const { payment, deal, indexes, attributionByLead, periods } = input;
  const paidAt = dayOfIso(String(payment.paid_at || ""));
  const payPeriod = periodOfDay(paidAt);

  const tryLead = (leadId: string, method: AttributionMethod) => {
    const lead = indexes.byLead.get(leadId);
    if (!lead) {
      return {
        method: "unknown" as const,
        confidence: "unknown" as const,
        identity: null,
        cross_period: false,
        gap_reason: "missing_lead"
      };
    }
    const identity = identityFromLead(lead, attributionByLead);
    const leadDay = dayOfIso(identity.lead_created_at);
    const leadPeriod = periodOfDay(leadDay);
    const cross =
      Boolean(payPeriod) &&
      Boolean(leadPeriod) &&
      (!periods.includes(leadPeriod) || leadPeriod !== payPeriod);
    return {
      method,
      confidence: method === "lead_id" || method === "deal_lead_id" ? ("high" as const) : ("medium" as const),
      identity,
      cross_period: cross,
      gap_reason: ""
    };
  };

  const paymentLeadId = String(payment.lead_id || "").trim();
  if (paymentLeadId) return tryLead(paymentLeadId, "lead_id");

  const dealLeadId = String(deal?.lead_id || "").trim();
  if (dealLeadId) return tryLead(dealLeadId, "deal_lead_id");

  const contactId = String(payment.contact_id || deal?.contact_id || "").trim();
  if (contactId) {
    const leadId = indexes.uniqueContact.get(contactId);
    if (leadId) return tryLead(leadId, "contact_id");
    if ([...indexes.uniqueContact.keys()].length >= 0) {
      // ambiguous or missing
      const all = [...indexes.byLead.values()].filter((l) => String(l.contact_id) === contactId);
      if (all.length > 1) {
        return {
          method: "unknown",
          confidence: "unknown",
          identity: null,
          cross_period: false,
          gap_reason: "ambiguous_contact"
        };
      }
      if (all.length === 0) {
        return {
          method: "unknown",
          confidence: "unknown",
          identity: null,
          cross_period: false,
          gap_reason: "missing_contact"
        };
      }
    }
  }

  const customerKey = String(payment.customer_key || deal?.customer_key || "").trim();
  if (customerKey) {
    const leadId = indexes.uniqueCustomer.get(customerKey);
    if (leadId) return tryLead(leadId, "customer_key");
    return {
      method: "unknown",
      confidence: "unknown",
      identity: null,
      cross_period: false,
      gap_reason: "ambiguous_customer"
    };
  }

  if (!String(payment.deal_id || "").trim()) {
    return {
      method: "unknown",
      confidence: "unknown",
      identity: null,
      cross_period: false,
      gap_reason: "unlinked_payment"
    };
  }

  return {
    method: "unknown",
    confidence: "unknown",
    identity: null,
    cross_period: false,
    gap_reason: "orphan_deal"
  };
}

export function classifyDealGap(
  deal: RowMap,
  indexes: ReturnType<typeof buildUniqueLeadIndexes>
): string {
  const leadId = String(deal.lead_id || "").trim();
  if (!leadId) return "orphan_deal";
  if (!indexes.byLead.has(leadId)) return "missing_lead";
  return "";
}

export function buildTrafficSalesAttributionLayer(input: {
  periods: string[];
  syncedAt: string;
  salesLeads: RowMap[];
  salesDeals: RowMap[];
  salesPayments: RowMap[];
  salesInvoices: RowMap[];
  attributions: Array<Record<string, string | number>>;
  foundationContacts?: RowMap[];
}) {
  const { periods, syncedAt, salesLeads, salesDeals, salesPayments, salesInvoices, attributions } =
    input;
  const indexes = buildUniqueLeadIndexes(salesLeads);
  const attributionByLead = new Map(
    attributions.map((row) => [String(row.lead_id), row] as const)
  );
  const dealsById = new Map(
    salesDeals.map((d) => [String(d.deal_id || "").trim(), d] as const).filter(([id]) => id)
  );

  const inPayPeriod = (row: RowMap) => {
    const d = dayOfIso(String(row.paid_at || ""));
    return d && periods.includes(periodOfDay(d));
  };
  const inDealPeriod = (row: RowMap) => {
    const d = dayOfIso(String(row.created_at || ""));
    return d && periods.includes(periodOfDay(d));
  };
  const inInvoicePeriod = (row: RowMap) => {
    const d = dayOfIso(String(row.invoice_at || ""));
    return d && periods.includes(periodOfDay(d));
  };

  const periodPayments = salesPayments.filter(inPayPeriod);
  const periodDeals = salesDeals.filter(inDealPeriod);
  const periodInvoices = salesInvoices.filter(inInvoicePeriod);

  // --- 24 Revenue Attribution (payment grain) ---
  const revenueRows: Array<Record<string, string | number>> = [];
  const methodCounts = new Map<string, { count: number; revenue: number }>();
  const gapCounts = new Map<string, { count: number; revenue: number }>();

  let directRevenue = 0;
  let contactRevenue = 0;
  let customerRevenue = 0;
  let unknownRevenue = 0;
  let crossPeriodRevenue = 0;
  let attributedPaymentCount = 0;

  for (const payment of periodPayments) {
    const dealId = String(payment.deal_id || "").trim();
    const deal = dealId ? dealsById.get(dealId) : undefined;
    const resolved = resolvePaymentAttribution({
      payment,
      deal,
      indexes,
      attributionByLead,
      periods
    });
    const amount = num(payment.amount);
    const paidAt = dayOfIso(String(payment.paid_at || ""));
    const method = resolved.method;
    const gap = resolved.gap_reason || (method === "unknown" ? "unknown_revenue" : "");

    if (method === "lead_id" || method === "deal_lead_id") {
      directRevenue += amount;
      attributedPaymentCount += 1;
    } else if (method === "contact_id") {
      contactRevenue += amount;
      attributedPaymentCount += 1;
    } else if (method === "customer_key") {
      customerRevenue += amount;
      attributedPaymentCount += 1;
    } else {
      unknownRevenue += amount;
    }
    if (resolved.cross_period) crossPeriodRevenue += amount;

    const mKey = method;
    const mc = methodCounts.get(mKey) || { count: 0, revenue: 0 };
    mc.count += 1;
    mc.revenue += amount;
    methodCounts.set(mKey, mc);

    if (gap) {
      const gc = gapCounts.get(gap) || { count: 0, revenue: 0 };
      gc.count += 1;
      gc.revenue += amount;
      gapCounts.set(gap, gc);
    }

    revenueRows.push({
      payment_id: String(payment.event_id || `${dealId}|${paidAt}`),
      paid_at: paidAt,
      period: periodOfDay(paidAt),
      deal_id: dealId,
      lead_id: resolved.identity?.lead_id || "",
      contact_id: String(payment.contact_id || deal?.contact_id || ""),
      customer_key: String(payment.customer_key || deal?.customer_key || ""),
      traffic_type: resolved.identity?.traffic_type || "unknown",
      channel: resolved.identity?.channel || "Unknown",
      landing_id: resolved.identity?.landing_id || "landing:unknown",
      campaign_id: resolved.identity?.campaign_id || "campaign:unknown",
      attribution_method: method,
      confidence: resolved.confidence,
      cross_period: resolved.cross_period ? "true" : "false",
      paid_revenue: Number(amount.toFixed(2)),
      gap_reason: gap,
      source_updated_at: syncedAt,
      sync_updated_at: syncedAt
    });
  }

  const totalSalesRevenue = periodPayments.reduce((s, r) => s + num(r.amount), 0);
  const attributedRevenue = directRevenue + contactRevenue + customerRevenue;

  // --- Deal orphans ---
  let orphanDeals = 0;
  let missingLeadDeals = 0;
  for (const deal of periodDeals) {
    const gap = classifyDealGap(deal, indexes);
    if (gap === "orphan_deal") orphanDeals += 1;
    if (gap === "missing_lead") missingLeadDeals += 1;
    if (gap) {
      const gc = gapCounts.get(gap) || { count: 0, revenue: 0 };
      gc.count += 1;
      gapCounts.set(gap, gc);
    }
  }

  // Lead cohort enrichment: all deals per lead (for linkage %)
  const dealsByLead = new Map<string, RowMap[]>();
  for (const deal of salesDeals) {
    const leadId = String(deal.lead_id || "").trim();
    if (!leadId) continue;
    const list = dealsByLead.get(leadId) || [];
    list.push(deal);
    dealsByLead.set(leadId, list);
  }
  const paymentsByDeal = new Map<string, { count: number; revenue: number }>();
  for (const pay of salesPayments) {
    const dealId = String(pay.deal_id || "").trim();
    if (!dealId) continue;
    const cur = paymentsByDeal.get(dealId) || { count: 0, revenue: 0 };
    cur.count += 1;
    cur.revenue += num(pay.amount);
    paymentsByDeal.set(dealId, cur);
  }

  let enrichedDealLinkedLeads = 0;
  let enrichedPaymentLinkedLeads = 0;
  let enrichedRevenueLinkedLeads = 0;
  for (const attr of attributions) {
    const leadId = String(attr.lead_id);
    const deals = dealsByLead.get(leadId) || [];
    if (deals.length) enrichedDealLinkedLeads += 1;
    let payCount = 0;
    let payRev = 0;
    for (const deal of deals) {
      const id = String(deal.deal_id || "").trim();
      const pay = paymentsByDeal.get(id);
      if (pay) {
        payCount += pay.count;
        payRev += pay.revenue;
      }
    }
    if (payCount > 0) enrichedPaymentLinkedLeads += 1;
    if (payRev > 0) enrichedRevenueLinkedLeads += 1;
  }
  const totalLeads = attributions.length || 1;

  // --- Phone/email join quality only (no revenue attribution) ---
  const contacts = input.foundationContacts || [];
  const phoneToContacts = new Map<string, string[]>();
  const emailToContacts = new Map<string, string[]>();
  for (const c of contacts) {
    const cid = String(c.contact_id || "").trim();
    const ph = String(c.phone_hash || "").trim();
    const em = String(c.email_hash || "").trim();
    if (ph && cid) {
      const list = phoneToContacts.get(ph) || [];
      list.push(cid);
      phoneToContacts.set(ph, list);
    }
    if (em && cid) {
      const list = emailToContacts.get(em) || [];
      list.push(cid);
      emailToContacts.set(em, list);
    }
  }
  let uniquePhone = 0;
  let ambiguousPhone = 0;
  for (const [, ids] of phoneToContacts) {
    if ([...new Set(ids)].length === 1) uniquePhone += 1;
    else ambiguousPhone += 1;
  }
  let uniqueEmail = 0;
  let ambiguousEmail = 0;
  for (const [, ids] of emailToContacts) {
    if ([...new Set(ids)].length === 1) uniqueEmail += 1;
    else ambiguousEmail += 1;
  }

  // --- 23 Join Quality ---
  const joinQuality: Array<Record<string, string | number>> = [
    {
      join_rule: "lead_id",
      join_type: "exact",
      rows: periodPayments.length,
      matched_rows: methodCounts.get("lead_id")?.count || 0,
      coverage_pct: pct(methodCounts.get("lead_id")?.count || 0, periodPayments.length),
      confidence: "high",
      status: "usable",
      false_match_risk: "none",
      comment: "Payment.lead_id → Sales lead → traffic identity",
      source_updated_at: syncedAt,
      sync_updated_at: syncedAt
    },
    {
      join_rule: "deal_lead_id",
      join_type: "exact",
      rows: periodPayments.length,
      matched_rows: methodCounts.get("deal_lead_id")?.count || 0,
      coverage_pct: pct(methodCounts.get("deal_lead_id")?.count || 0, periodPayments.length),
      confidence: "high",
      status: "usable",
      false_match_risk: "none",
      comment: "Payment.deal_id → Deal.lead_id",
      source_updated_at: syncedAt,
      sync_updated_at: syncedAt
    },
    {
      join_rule: "contact_id",
      join_type: "unique_only",
      rows: indexes.contactLeadRows,
      matched_rows: indexes.uniqueContact.size,
      coverage_pct: pct(indexes.uniqueContact.size, Math.max(indexes.contactLeadRows, 1)),
      confidence: "medium",
      status: indexes.ambiguousContacts ? "limited" : "usable",
      false_match_risk: "low_if_unique",
      comment: `Unique contact→lead only. Ambiguous contacts excluded: ${indexes.ambiguousContacts}`,
      source_updated_at: syncedAt,
      sync_updated_at: syncedAt
    },
    {
      join_rule: "customer_key",
      join_type: "unique_only",
      rows: indexes.customerLeadRows,
      matched_rows: indexes.uniqueCustomer.size,
      coverage_pct: pct(indexes.uniqueCustomer.size, Math.max(indexes.customerLeadRows, 1)),
      confidence: "medium",
      status: indexes.ambiguousCustomers ? "limited" : "usable",
      false_match_risk: "low_if_unique",
      comment: `Unique customer_key→lead only. Ambiguous excluded: ${indexes.ambiguousCustomers}`,
      source_updated_at: syncedAt,
      sync_updated_at: syncedAt
    },
    {
      join_rule: "phone_hash",
      join_type: "registry_only",
      rows: phoneToContacts.size,
      matched_rows: uniquePhone,
      coverage_pct: pct(uniquePhone, Math.max(phoneToContacts.size, 1)),
      confidence: "low",
      status: "not_used_for_revenue",
      false_match_risk: "high_shared_phones",
      comment: "Join Quality only — never auto-attributes channel revenue. Ambiguous: " + ambiguousPhone,
      source_updated_at: syncedAt,
      sync_updated_at: syncedAt
    },
    {
      join_rule: "email_hash",
      join_type: "registry_only",
      rows: emailToContacts.size,
      matched_rows: uniqueEmail,
      coverage_pct: pct(uniqueEmail, Math.max(emailToContacts.size, 1)),
      confidence: "low",
      status: "not_used_for_revenue",
      false_match_risk: "high_shared_emails",
      comment: "Join Quality only — never auto-attributes channel revenue. Ambiguous: " + ambiguousEmail,
      source_updated_at: syncedAt,
      sync_updated_at: syncedAt
    },
    {
      join_rule: "unmatched",
      join_type: "gap",
      rows: periodPayments.length,
      matched_rows: methodCounts.get("unknown")?.count || 0,
      coverage_pct: pct(methodCounts.get("unknown")?.count || 0, periodPayments.length),
      confidence: "unknown",
      status: "gap",
      false_match_risk: "n/a",
      comment: "Payments left unattributed (honest)",
      source_updated_at: syncedAt,
      sync_updated_at: syncedAt
    },
    {
      join_rule: "manual",
      join_type: "manual",
      rows: 0,
      matched_rows: 0,
      coverage_pct: 0,
      confidence: "manual",
      status: "unused",
      false_match_risk: "owner_approved_only",
      comment: "Reserved for explicit manual overrides — none in v1 auto path",
      source_updated_at: syncedAt,
      sync_updated_at: syncedAt
    }
  ];

  // --- 25 Attribution Gaps ---
  const gapPriority: Record<string, number> = {
    orphan_deal: 1,
    missing_lead: 2,
    ambiguous_contact: 3,
    ambiguous_customer: 4,
    unlinked_payment: 5,
    missing_contact: 6,
    unknown_revenue: 7,
    other: 9
  };
  const gapFix: Record<string, string> = {
    orphan_deal: "проверить CRM связь lead↔deal в Bitrix",
    missing_lead: "обновить Sales OS leads extract; проверить удалённые лиды",
    ambiguous_contact: "оставить unattributed; не джойнить автоматически",
    ambiguous_customer: "оставить unattributed; проверить customer_key duplicates",
    unlinked_payment: "проверить deal_id на payment event",
    missing_contact: "добавить CONTACT_ID в CRM",
    unknown_revenue: "оставить unattributed до появления evidence",
    other: "разобрать вручную"
  };

  const attributionGaps = [...gapCounts.entries()]
    .map(([reason, v]) => ({
      reason,
      count: v.count,
      revenue: Number(v.revenue.toFixed(2)),
      share_pct: pct(v.revenue, totalSalesRevenue) || pct(v.count, periodPayments.length + periodDeals.length),
      priority: gapPriority[reason] ?? 9,
      recommended_fix: gapFix[reason] || gapFix.other,
      source_updated_at: syncedAt,
      sync_updated_at: syncedAt
    }))
    .sort((a, b) => Number(a.priority) - Number(b.priority) || Number(b.revenue) - Number(a.revenue));

  // --- Extended sales coverage rows ---
  const salesCoverageExtra: Array<Record<string, string | number>> = [
    {
      period: periods.join(","),
      metric_id: "payments_via_lead_id",
      traffic_os_value: methodCounts.get("lead_id")?.count || 0,
      sales_os_value: periodPayments.length,
      covered_value: methodCounts.get("lead_id")?.count || 0,
      uncovered_value: periodPayments.length - (methodCounts.get("lead_id")?.count || 0),
      coverage_pct: pct(methodCounts.get("lead_id")?.count || 0, periodPayments.length),
      status: "partial_coverage",
      difference_reason: "direct_lead_id_path",
      definition_status: "confirmed",
      source_updated_at: syncedAt,
      checked_at: syncedAt
    },
    {
      period: periods.join(","),
      metric_id: "payments_via_contact_id",
      traffic_os_value: methodCounts.get("contact_id")?.count || 0,
      sales_os_value: periodPayments.length,
      covered_value: methodCounts.get("contact_id")?.count || 0,
      uncovered_value: "",
      coverage_pct: pct(methodCounts.get("contact_id")?.count || 0, periodPayments.length),
      status: "partial_coverage",
      difference_reason: "unique_contact_only",
      definition_status: "confirmed",
      source_updated_at: syncedAt,
      checked_at: syncedAt
    },
    {
      period: periods.join(","),
      metric_id: "payments_via_customer_key",
      traffic_os_value: methodCounts.get("customer_key")?.count || 0,
      sales_os_value: periodPayments.length,
      covered_value: methodCounts.get("customer_key")?.count || 0,
      uncovered_value: "",
      coverage_pct: pct(methodCounts.get("customer_key")?.count || 0, periodPayments.length),
      status: "partial_coverage",
      difference_reason: "unique_customer_key_only",
      definition_status: "confirmed",
      source_updated_at: syncedAt,
      checked_at: syncedAt
    },
    {
      period: periods.join(","),
      metric_id: "revenue_direct_attribution",
      traffic_os_value: Number(directRevenue.toFixed(2)),
      sales_os_value: Number(totalSalesRevenue.toFixed(2)),
      covered_value: Number(directRevenue.toFixed(2)),
      uncovered_value: Number((totalSalesRevenue - directRevenue).toFixed(2)),
      coverage_pct: pct(directRevenue, totalSalesRevenue),
      status: "partial_coverage",
      difference_reason: "lead_id_or_deal_lead_id",
      definition_status: "confirmed",
      source_updated_at: syncedAt,
      checked_at: syncedAt
    },
    {
      period: periods.join(","),
      metric_id: "revenue_contact_attribution",
      traffic_os_value: Number(contactRevenue.toFixed(2)),
      sales_os_value: Number(totalSalesRevenue.toFixed(2)),
      covered_value: Number(contactRevenue.toFixed(2)),
      uncovered_value: "",
      coverage_pct: pct(contactRevenue, totalSalesRevenue),
      status: "partial_coverage",
      difference_reason: "unique_contact_id",
      definition_status: "confirmed",
      source_updated_at: syncedAt,
      checked_at: syncedAt
    },
    {
      period: periods.join(","),
      metric_id: "revenue_customer_attribution",
      traffic_os_value: Number(customerRevenue.toFixed(2)),
      sales_os_value: Number(totalSalesRevenue.toFixed(2)),
      covered_value: Number(customerRevenue.toFixed(2)),
      uncovered_value: "",
      coverage_pct: pct(customerRevenue, totalSalesRevenue),
      status: "partial_coverage",
      difference_reason: "unique_customer_key",
      definition_status: "confirmed",
      source_updated_at: syncedAt,
      checked_at: syncedAt
    },
    {
      period: periods.join(","),
      metric_id: "revenue_unknown",
      traffic_os_value: Number(unknownRevenue.toFixed(2)),
      sales_os_value: Number(totalSalesRevenue.toFixed(2)),
      covered_value: 0,
      uncovered_value: Number(unknownRevenue.toFixed(2)),
      coverage_pct: pct(unknownRevenue, totalSalesRevenue),
      status: "orphan_sales_event",
      difference_reason: "unattributed_honest",
      definition_status: "confirmed",
      source_updated_at: syncedAt,
      checked_at: syncedAt
    },
    {
      period: periods.join(","),
      metric_id: "deals_orphan",
      traffic_os_value: orphanDeals,
      sales_os_value: periodDeals.length,
      covered_value: periodDeals.length - orphanDeals - missingLeadDeals,
      uncovered_value: orphanDeals + missingLeadDeals,
      coverage_pct: pct(periodDeals.length - orphanDeals - missingLeadDeals, periodDeals.length),
      status: orphanDeals ? "orphan_sales_event" : "matched",
      difference_reason: "orphan_deal_without_lead",
      definition_status: "confirmed",
      source_updated_at: syncedAt,
      checked_at: syncedAt
    },
    {
      period: periods.join(","),
      metric_id: "cross_period_revenue",
      traffic_os_value: Number(crossPeriodRevenue.toFixed(2)),
      sales_os_value: Number(totalSalesRevenue.toFixed(2)),
      covered_value: Number(crossPeriodRevenue.toFixed(2)),
      uncovered_value: "",
      coverage_pct: pct(crossPeriodRevenue, totalSalesRevenue),
      status: "partial_coverage",
      difference_reason: "lead_created_outside_payment_period",
      definition_status: "confirmed",
      source_updated_at: syncedAt,
      checked_at: syncedAt
    }
  ];

  // --- Export v3: payment calendar grain rollup ---
  type ExpAgg = {
    date: string;
    traffic_type: string;
    channel: string;
    landing_id: string;
    campaign_id: string;
    leads: Set<string>;
    deals: Set<string>;
    payments: number;
    revenue: number;
    unknown_payments: number;
    direct_revenue: number;
    contact_revenue: number;
    customer_revenue: number;
    cross_period_revenue: number;
  };
  const exportMap = new Map<string, ExpAgg>();
  for (const row of revenueRows) {
    const date = String(row.paid_at);
    const key = `${date}|${row.traffic_type}|${row.channel}|${row.landing_id}|${row.campaign_id}`;
    const cur =
      exportMap.get(key) ||
      ({
        date,
        traffic_type: String(row.traffic_type),
        channel: String(row.channel),
        landing_id: String(row.landing_id),
        campaign_id: String(row.campaign_id),
        leads: new Set<string>(),
        deals: new Set<string>(),
        payments: 0,
        revenue: 0,
        unknown_payments: 0,
        direct_revenue: 0,
        contact_revenue: 0,
        customer_revenue: 0,
        cross_period_revenue: 0
      } as ExpAgg);
    if (String(row.lead_id)) cur.leads.add(String(row.lead_id));
    if (String(row.deal_id)) cur.deals.add(String(row.deal_id));
    cur.payments += 1;
    cur.revenue += num(row.paid_revenue);
    if (String(row.attribution_method) === "unknown") cur.unknown_payments += 1;
    if (String(row.attribution_method) === "lead_id" || String(row.attribution_method) === "deal_lead_id") {
      cur.direct_revenue += num(row.paid_revenue);
    }
    if (String(row.attribution_method) === "contact_id") cur.contact_revenue += num(row.paid_revenue);
    if (String(row.attribution_method) === "customer_key") cur.customer_revenue += num(row.paid_revenue);
    if (String(row.cross_period) === "true") cur.cross_period_revenue += num(row.paid_revenue);
    exportMap.set(key, cur);
  }

  const exportRowsV3 = [...exportMap.values()]
    .map((agg) => ({
      date: agg.date,
      traffic_type: agg.traffic_type,
      channel_id: `channel:${agg.channel.toLowerCase().replace(/\s+/g, "_")}`,
      landing_id: agg.landing_id,
      campaign_id: agg.campaign_id,
      leads: agg.leads.size,
      deals: agg.deals.size,
      invoice_events: "",
      payments: agg.payments,
      attributed_paid_revenue: Number(agg.revenue.toFixed(2)),
      direct_attributed_revenue: Number(agg.direct_revenue.toFixed(2)),
      contact_attributed_revenue: Number(agg.contact_revenue.toFixed(2)),
      customer_attributed_revenue: Number(agg.customer_revenue.toFixed(2)),
      cross_period_revenue: Number(agg.cross_period_revenue.toFixed(2)),
      average_check: agg.payments ? Number((agg.revenue / agg.payments).toFixed(2)) : "",
      lead_to_deal_cr: "",
      deal_to_invoice_cr: "",
      invoice_to_payment_cr: "",
      lead_to_payment_cr: "",
      unknown_leads: agg.unknown_payments,
      attribution_coverage_pct: pct(agg.payments - agg.unknown_payments, agg.payments),
      payment_linkage_pct: "",
      revenue_linkage_pct: "",
      confidence: agg.direct_revenue >= agg.revenue * 0.9 ? "high" : agg.unknown_payments ? "low" : "medium",
      data_quality_score: Number(
        (attributedRevenue / Math.max(totalSalesRevenue, 1)).toFixed(4)
      ),
      source_updated_at: syncedAt,
      sync_updated_at: syncedAt,
      contract_version: TRAFFIC_EXPORT_V3_CONTRACT_VERSION
    }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.traffic_type.localeCompare(b.traffic_type));

  const after = {
    deal_linkage_pct: Number(((enrichedDealLinkedLeads / totalLeads) * 100).toFixed(2)),
    payment_linkage_pct: Number(((enrichedPaymentLinkedLeads / totalLeads) * 100).toFixed(2)),
    revenue_linkage_pct: Number(((enrichedRevenueLinkedLeads / totalLeads) * 100).toFixed(2)),
    revenue_amount_coverage_pct: Number(pct(attributedRevenue, totalSalesRevenue) || 0),
    unknown_revenue_pct: Number(pct(unknownRevenue, totalSalesRevenue) || 0),
    orphan_deals: orphanDeals,
    orphan_payments: methodCounts.get("unknown")?.count || 0,
    attributed_revenue: Number(attributedRevenue.toFixed(2)),
    direct_revenue: Number(directRevenue.toFixed(2)),
    contact_revenue: Number(contactRevenue.toFixed(2)),
    customer_revenue: Number(customerRevenue.toFixed(2)),
    unknown_revenue: Number(unknownRevenue.toFixed(2)),
    cross_period_revenue: Number(crossPeriodRevenue.toFixed(2)),
    total_sales_revenue: Number(totalSalesRevenue.toFixed(2)),
    attributed_payment_events: attributedPaymentCount,
    payment_events: periodPayments.length,
    false_matches: 0
  };

  const enrichmentCoverage = {
    before: ATTRIBUTION_ENRICHMENT_BASELINE,
    after
  };

  return {
    joinQuality,
    revenueAttribution: revenueRows,
    attributionGaps,
    salesCoverageExtra,
    exportRowsV3,
    enrichmentCoverage,
    enrichedLeadLinkage: {
      deal_linked: enrichedDealLinkedLeads,
      payment_linked: enrichedPaymentLinkedLeads,
      revenue_linked: enrichedRevenueLinkedLeads,
      total_leads: attributions.length
    },
    allDealsPaymentsByLead: (() => {
      const map = new Map<string, { invoice_events: number; payments: number; paid_revenue: number; deal_id: string; deal_created_at: string }>();
      for (const attr of attributions) {
        const leadId = String(attr.lead_id);
        const deals = (dealsByLead.get(leadId) || [])
          .slice()
          .sort((a, b) => String(a.created_at || "").localeCompare(String(b.created_at || "")));
        const primary = deals[0];
        let invoiceEvents = 0;
        let payments = 0;
        let paidRevenue = 0;
        for (const deal of deals) {
          const id = String(deal.deal_id || "").trim();
          // invoices counted elsewhere; keep payment enrichment
          const pay = paymentsByDeal.get(id);
          if (pay) {
            payments += pay.count;
            paidRevenue += pay.revenue;
          }
        }
        // invoice count from invoices by deal
        map.set(leadId, {
          invoice_events: invoiceEvents,
          payments,
          paid_revenue: Number(paidRevenue.toFixed(2)),
          deal_id: primary ? String(primary.deal_id || "") : "",
          deal_created_at: primary ? String(primary.created_at || "") : ""
        });
      }
      // fill invoices
      const invByDeal = new Map<string, number>();
      for (const inv of salesInvoices) {
        const id = String(inv.deal_id || "").trim();
        if (!id) continue;
        invByDeal.set(id, (invByDeal.get(id) || 0) + 1);
      }
      for (const [leadId, cur] of map) {
        let invoices = 0;
        for (const deal of dealsByLead.get(leadId) || []) {
          invoices += invByDeal.get(String(deal.deal_id || "").trim()) || 0;
        }
        cur.invoice_events = invoices;
      }
      return map;
    })(),
    matrices: {
      joinQuality: toMatrix(JOIN_QUALITY_COLUMNS, joinQuality),
      revenueAttribution: toMatrix(REVENUE_ATTRIBUTION_COLUMNS, revenueRows),
      attributionGaps: toMatrix(ATTRIBUTION_GAPS_COLUMNS, attributionGaps),
      exportRowsV3: toMatrix(TRAFFIC_EXPORT_V3_COLUMNS, exportRowsV3)
    },
    stats: {
      joinQuality: joinQuality.length,
      revenueAttribution: revenueRows.length,
      attributionGaps: attributionGaps.length,
      exportRowsV3: exportRowsV3.length
    }
  };
}

export type TrafficSalesAttributionModel = ReturnType<typeof buildTrafficSalesAttributionLayer>;
