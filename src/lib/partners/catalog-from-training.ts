import { listProducts } from "@/lib/training/store";
import type { PartnerCatalogProduct } from "@/types/partners";

/** Partner-facing price/lead-time hints (training catalog has no structured price fields). */
const PARTNER_OFFER_HINTS: Record<
  string,
  { priceFrom?: number; priceLabel?: string; productionDays: string }
> = {
  "personal-newspaper": { priceLabel: "по запросу", productionDays: "зависит от наличия" },
  "personal-magazine": { priceLabel: "по запросу", productionDays: "индивидуально" },
  "retro-newspaper": { priceLabel: "по запросу", productionDays: "несколько дней" },
  "gift-edition": { priceLabel: "по запросу", productionDays: "1–2 дня" },
  "glossy-magazine": { priceFrom: 240, productionDays: "индивидуально" },
  "family-edition": { priceLabel: "по запросу", productionDays: "индивидуально" },
  "congratulatory-song": { priceFrom: 20, productionDays: "1 день" },
  stickers: { priceLabel: "от 3,5 €", productionDays: "быстро" },
  ozivi: { priceFrom: 4, productionDays: "быстро" }
};

function shortenAudience(value: string, max = 140): string {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= max) return compact;
  const cut = compact.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 80 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

export async function listPartnerCatalogFromTraining(): Promise<PartnerCatalogProduct[]> {
  const products = await listProducts();
  return products
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((product) => {
      const hint = PARTNER_OFFER_HINTS[product.id];
      return {
        id: product.id,
        title: product.title,
        description: product.shortDescription,
        priceFrom: hint?.priceFrom ?? 0,
        priceLabel: hint?.priceLabel,
        productionDays: hint?.productionDays ?? "уточняйте у менеджера",
        audience: shortenAudience(product.targetAudience || "Для тех, кто ищет персональный подарок со смыслом."),
        image: product.coverImage,
        detailsHref: "https://retro-pressa.com"
      };
    });
}
