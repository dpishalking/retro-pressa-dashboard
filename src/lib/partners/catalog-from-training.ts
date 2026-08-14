import { listProducts } from "@/lib/training/store";
import { readPassportDashboardSnapshot } from "@/lib/product-hub/passport-dashboard-store";
import type { PartnerCatalogProduct } from "@/types/partners";
import type { PassportDashboardEconomy, PassportDashboardProduct } from "@/types/product-passports";

/** Training module id → product-hub passport id(s). Multiple = price range across variants. */
const TRAINING_TO_HUB: Record<string, string | string[]> = {
  "personal-newspaper": "PRODUCT_ORIGINAL",
  "personal-magazine": "PRODUCT_LIFE_BOOK",
  "retro-newspaper": ["PRODUCT_CONGRATS_NEWSPAPER", "PRODUCT_CONGRATS_MAGAZINE"],
  "gift-edition": "PRODUCT_PERSONAL_NEWSPAPER",
  "glossy-magazine": "PRODUCT_PERSONAL_MAGAZINE",
  "family-edition": "PRODUCT_FAMILY_EDITION",
  "congratulatory-song": "PRODUCT_CONGRATS_SONG",
  stickers: "PRODUCT_STICKER",
  ozivi: "PRODUCT_ANIMATE"
};

const PRODUCTION_DAYS: Record<string, string> = {
  "personal-newspaper": "зависит от наличия",
  "personal-magazine": "индивидуально",
  "retro-newspaper": "несколько дней",
  "gift-edition": "1–2 дня",
  "glossy-magazine": "от 7–10 раб. дней",
  "family-edition": "индивидуально",
  "congratulatory-song": "1 день",
  stickers: "быстро",
  ozivi: "быстро"
};

type PriceOffer = { priceFrom: number; priceLabel?: string };

function parseMoneyToken(raw: string): number | null {
  const normalized = raw
    .trim()
    .toLowerCase()
    .replace(/\s/g, "")
    .replace("€", "")
    .replace("eur", "")
    .replace(",", ".");
  const match = normalized.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function formatEuroLabel(value: number): string {
  if (Number.isInteger(value)) return `${value} €`;
  return `${String(value).replace(".", ",")} €`;
}

function formatRangeLabel(from: number, to: number): string {
  const left = Number.isInteger(from) ? String(from) : String(from).replace(".", ",");
  const right = Number.isInteger(to) ? String(to) : String(to).replace(".", ",");
  return `${left}–${right} €`;
}

function offerFromEconomy(economy: PassportDashboardEconomy | undefined): PriceOffer | null {
  if (!economy) return null;

  const retail = economy.retail_price?.trim();
  if (retail) {
    const lower = retail.toLowerCase();
    if (lower.includes("–") || lower.includes("-")) {
      const parts = retail.split(/[–-]/).map((part) => parseMoneyToken(part));
      const a = parts[0];
      const b = parts[1];
      if (a != null && b != null) {
        return { priceFrom: Math.min(a, b), priceLabel: formatRangeLabel(a, b) };
      }
      if (a != null) return { priceFrom: a, priceLabel: `от ${formatEuroLabel(a)}` };
    }
    if (lower.startsWith("до")) {
      const max = parseMoneyToken(retail);
      if (max != null) {
        const model = economy.cogs_retail_model ? parseMoneyToken(economy.cogs_retail_model) : null;
        return {
          priceFrom: model ?? max,
          priceLabel: `до ${formatEuroLabel(max)}`
        };
      }
    }
    const exact = parseMoneyToken(retail);
    if (exact != null) {
      return {
        priceFrom: exact,
        priceLabel: Number.isInteger(exact) ? undefined : `от ${formatEuroLabel(exact)}`
      };
    }
  }

  const model = economy.cogs_retail_model ? parseMoneyToken(economy.cogs_retail_model) : null;
  if (model != null) {
    return { priceFrom: model, priceLabel: `от ${formatEuroLabel(model)}` };
  }

  return null;
}

function mergeOffers(offers: PriceOffer[]): PriceOffer | null {
  if (!offers.length) return null;
  if (offers.length === 1) return offers[0]!;

  const from = Math.min(...offers.map((offer) => offer.priceFrom));
  const to = Math.max(
    ...offers.map((offer) => {
      const labelNums = offer.priceLabel?.match(/(\d+(?:[.,]\d+)?)/g)?.map((token) => parseMoneyToken(token));
      if (labelNums?.length) return Math.max(...labelNums.filter((n): n is number => n != null));
      return offer.priceFrom;
    })
  );
  if (from === to) return { priceFrom: from };
  return { priceFrom: from, priceLabel: formatRangeLabel(from, to) };
}

function offerForTrainingProduct(
  trainingId: string,
  byHubId: Map<string, PassportDashboardProduct>
): PriceOffer {
  const hubIds = TRAINING_TO_HUB[trainingId];
  if (!hubIds) return { priceFrom: 0, priceLabel: "по запросу" };

  const ids = Array.isArray(hubIds) ? hubIds : [hubIds];
  const offers = ids
    .map((id) => offerFromEconomy(byHubId.get(id)?.economy))
    .filter((offer): offer is PriceOffer => Boolean(offer));

  return mergeOffers(offers) ?? { priceFrom: 0, priceLabel: "по запросу" };
}

function shortenAudience(value: string, max = 140): string {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= max) return compact;
  const cut = compact.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 80 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

export async function listPartnerCatalogFromTraining(): Promise<PartnerCatalogProduct[]> {
  const [products, snapshot] = await Promise.all([listProducts(), readPassportDashboardSnapshot()]);
  const byHubId = new Map((snapshot?.products ?? []).map((product) => [product.productId, product]));

  return products
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((product) => {
      const price = offerForTrainingProduct(product.id, byHubId);
      return {
        id: product.id,
        title: product.title,
        description: product.shortDescription,
        priceFrom: price.priceFrom,
        priceLabel: price.priceLabel,
        productionDays: PRODUCTION_DAYS[product.id] ?? "уточняйте у менеджера",
        audience: shortenAudience(product.targetAudience || "Для тех, кто ищет персональный подарок со смыслом."),
        image: product.coverImage,
        detailsHref: "https://retro-pressa.com"
      };
    });
}
