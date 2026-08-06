import { generateId } from "@/lib/training/id";
import { normalizePromoCode } from "@/lib/partners/promo";
import type { Partner, PartnerAttribution, PartnerSale, PartnerSaleStatus } from "@/types/partners";

/** Minimal deal shape for future Bitrix sync (STAGE_SEMANTIC_ID=S = paid). */
export type PartnerBitrixDeal = {
  id: string;
  opportunity: number;
  productTitle?: string;
  stageSemanticId?: string;
  promoCode?: string;
  utmCampaign?: string;
  utmSource?: string;
  partnerUfId?: string;
  closedate?: string;
};

export type AccrueResult =
  | { ok: true; sale: PartnerSale; partnerId: string }
  | { ok: false; reason: "no_partner" | "not_paid" | "cancelled" | "already_owned" };

export function isPaidDeal(deal: PartnerBitrixDeal): boolean {
  return deal.stageSemanticId === "S";
}

/**
 * Attribution priority: promo code → referral UTM → manual UF.
 * One deal belongs to at most one partner.
 */
export function resolvePartnerForDeal(
  deal: PartnerBitrixDeal,
  partners: Partner[]
): { partner: Partner; attribution: PartnerAttribution } | null {
  const active = partners.filter((partner) => partner.status === "active");

  if (deal.promoCode) {
    const promo = normalizePromoCode(deal.promoCode);
    const byPromo = active.find((partner) => normalizePromoCode(partner.promoCode) === promo);
    if (byPromo) return { partner: byPromo, attribution: "promo" };
  }

  const campaign = (deal.utmCampaign ?? "").trim().toLowerCase();
  const source = (deal.utmSource ?? "").trim().toLowerCase();
  if (campaign || source === "partner" || source === "referral") {
    const slug = campaign.replace(/^r\//, "").replace(/^partner[-_]?/, "");
    const bySlug = active.find(
      (partner) =>
        partner.referralSlug === slug ||
        partner.referralSlug === campaign ||
        normalizePromoCode(partner.promoCode) === normalizePromoCode(campaign)
    );
    if (bySlug) return { partner: bySlug, attribution: "referral" };
  }

  if (deal.partnerUfId) {
    const byUf = active.find((partner) => partner.id === deal.partnerUfId || partner.userId === deal.partnerUfId);
    if (byUf) return { partner: byUf, attribution: "manual" };
  }

  return null;
}

export function accrueOnPaid(input: {
  deal: PartnerBitrixDeal;
  partners: Partner[];
  existingSales: PartnerSale[];
  now?: string;
}): AccrueResult {
  const { deal, partners, existingSales } = input;
  const now = input.now ?? new Date().toISOString();

  if (!isPaidDeal(deal)) {
    return { ok: false, reason: "not_paid" };
  }

  const owned = existingSales.find((sale) => sale.dealId === deal.id);
  if (owned) {
    if (owned.status === "cancelled") return { ok: false, reason: "cancelled" };
    return { ok: false, reason: "already_owned" };
  }

  const resolved = resolvePartnerForDeal(deal, partners);
  if (!resolved) return { ok: false, reason: "no_partner" };

  const commission = roundMoney(deal.opportunity * resolved.partner.commissionRate);
  const sale: PartnerSale = {
    id: generateId("sale"),
    partnerId: resolved.partner.id,
    dealId: deal.id,
    date: (deal.closedate ?? now).slice(0, 10),
    product: deal.productTitle?.trim() || "Заказ Retro Pressa",
    amount: deal.opportunity,
    status: "paid",
    commission,
    attribution: resolved.attribution,
    createdAt: now,
    updatedAt: now
  };

  return { ok: true, sale, partnerId: resolved.partner.id };
}

export function reverseOnRefund(input: {
  dealId: string;
  existingSales: PartnerSale[];
  now?: string;
}): PartnerSale | null {
  const now = input.now ?? new Date().toISOString();
  const sale = input.existingSales.find((item) => item.dealId === input.dealId);
  if (!sale || sale.status === "refunded" || sale.status === "cancelled") return null;

  return {
    ...sale,
    status: "refunded" satisfies PartnerSaleStatus,
    commission: 0,
    updatedAt: now
  };
}

export function markCancelled(input: {
  dealId: string;
  existingSales: PartnerSale[];
  now?: string;
}): PartnerSale | null {
  const now = input.now ?? new Date().toISOString();
  const sale = input.existingSales.find((item) => item.dealId === input.dealId);
  if (!sale || sale.status === "cancelled") return null;
  return {
    ...sale,
    status: "cancelled",
    commission: 0,
    updatedAt: now
  };
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Phase 2: pull paid deals from Bitrix and accrue commissions.
 * Not wired in v1 — needs CRM UF / promo field mapping + webhook or sync job.
 */
export async function syncPartnerAccrualsFromBitrix(): Promise<{
  ok: false;
  reason: "not_implemented";
  message: string;
}> {
  return {
    ok: false,
    reason: "not_implemented",
    message:
      "Bitrix partner accrual sync is not implemented yet. Map promo/partner UF on deals, then wire SELECT_DEAL + webhook/ONCRMDEALUPDATE."
  };
}
