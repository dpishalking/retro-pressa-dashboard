/**
 * Resolve Bitrix SPA «Вид подарка» (1038) → gift type names for deals
 * that have UF_CRM_1784794322 links but empty crm.deal.productrows.
 */

import {
  BITRIX_DEAL_GIFT_LINKS_FIELD,
  BITRIX_GIFT_SPA_ENTITY_TYPE_ID,
  BITRIX_GIFT_SPA_TYPE_FIELD,
  BITRIX_GIFT_TYPE_ENUM
} from "@/lib/bitrix/metric-definitions";
import { bitrixBatch, bitrixResult, chunkIds } from "@/lib/bitrix/rest-client";
import type { BitrixSnapshotProductRow } from "@/lib/bitrix/snapshot-store";

export function parseDealGiftLinkIds(raw: unknown): string[] {
  if (raw == null || raw === false || raw === "" || raw === "0") return [];
  const list = Array.isArray(raw) ? raw : [raw];
  return list.map((item) => String(item).trim()).filter((id) => id && id !== "false" && id !== "0");
}

export function giftTypeNameFromEnumId(enumId: string | number | null | undefined): string | null {
  if (enumId == null || enumId === "") return null;
  const key = String(enumId);
  return BITRIX_GIFT_TYPE_ENUM[key] || null;
}

export async function resolveGiftTypeNamesByItemIds(itemIds: string[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(itemIds.filter(Boolean)));
  const out = new Map<string, string>();
  if (!unique.length) return out;

  for (const batch of chunkIds(unique, 20)) {
    const commands = Object.fromEntries(
      batch.map((id, index) => [
        `g${index}`,
        `crm.item.get?entityTypeId=${BITRIX_GIFT_SPA_ENTITY_TYPE_ID}&id=${encodeURIComponent(id)}`
      ])
    );
    try {
      const result = await bitrixBatch<{ item?: Record<string, unknown> } | Record<string, unknown>>(commands);
      for (let index = 0; index < batch.length; index += 1) {
        const payload = result[`g${index}`];
        const item = (payload && "item" in (payload as object) ? (payload as { item?: Record<string, unknown> }).item : payload) as
          | Record<string, unknown>
          | undefined;
        if (!item) continue;
        const enumId = item[BITRIX_GIFT_SPA_TYPE_FIELD];
        const name = giftTypeNameFromEnumId(enumId as string | number);
        if (name) out.set(batch[index], name);
      }
    } catch {
      // Fallback one-by-one for partial batches
      for (const id of batch) {
        try {
          const payload = await bitrixResult<{ item?: Record<string, unknown> } | Record<string, unknown>>("crm.item.get", {
            entityTypeId: BITRIX_GIFT_SPA_ENTITY_TYPE_ID,
            id
          });
          const item = (payload && typeof payload === "object" && "item" in payload
            ? (payload as { item?: Record<string, unknown> }).item
            : payload) as Record<string, unknown> | undefined;
          const name = giftTypeNameFromEnumId(item?.[BITRIX_GIFT_SPA_TYPE_FIELD] as string | number);
          if (name) out.set(id, name);
        } catch {
          // skip
        }
      }
    }
  }
  return out;
}

export function giftTypesFromDealField(
  raw: unknown,
  itemIdToType: Map<string, string>
): string[] {
  const ids = parseDealGiftLinkIds(raw);
  const names = ids.map((id) => itemIdToType.get(id)).filter((name): name is string => Boolean(name));
  return Array.from(new Set(names));
}

/** Stable Bitrix catalog ids for names we infer when productrows are empty. */
const KNOWN_PRODUCT_IDS_BY_NAME: Record<string, string> = {
  "поздравительная газета": "174",
  "apsveikuma avīze": "178",
  "apsveikuma avize": "178",
  "репродукция": "166",
  "репродукция газеты": "166",
  "песня": "496",
  "оригинальная газета": "288",
  "оригинальный журнал": "284"
};

export function knownBitrixProductId(name: string): string {
  return KNOWN_PRODUCT_IDS_BY_NAME[name.trim().toLowerCase().replace(/ё/g, "е")] || "";
}

/** Synthetic product rows from gift types when Bitrix catalog lines are missing. */
export function productRowsFromGiftTypes(giftTypes: string[]): BitrixSnapshotProductRow[] {
  return giftTypes.map((name) => ({
    productId: knownBitrixProductId(name),
    productName: name,
    quantity: 1,
    price: 0
  }));
}

/**
 * When productrows and SPA «Вид подарка» are empty, managers still write the product into TITLE.
 * Cyrillic word-boundaries are unreliable with \\b — use explicit separators.
 */
const NEWSPAPER_TITLE_MARKERS = [
  "газет",
  "правд",
  "извести",
  "avīz",
  "aviz",
  "diena",
  "знамя",
  "звязда",
  "труд",
  "заре",
  "заря ",
  "коммунизм",
  "коммун",
  "советск",
  "комсомол",
  "литературн",
  "крокодил",
  "крестьянк",
  "работниц",
  "огонек",
  "berliner",
  "moscow news",
  "светлы шлях",
  "горняк",
  "полесск"
];

export function inferProductFromDealTitle(title: string | null | undefined): string | null {
  const raw = (title || "").trim();
  if (!raw) return null;
  const t = raw.toLowerCase().replace(/ё/g, "е");

  if ((t.includes("поздр") || t.includes("apsveikuma") || t.includes("congrat") || t.includes("gift_paper")) && t.includes("журнал")) {
    return "Поздравительный журнал";
  }
  if (
    t.includes("поздр") ||
    t.includes("apsveikuma") ||
    t.includes("congrat") ||
    t.includes("gift_paper")
  ) {
    return "Поздравительная газета";
  }
  if (t.includes("репродук") || t.includes("reproduk") || /(^|[^а-яa-z0-9])реп([^а-яa-z0-9]|$)/i.test(t)) {
    return "Репродукция";
  }
  if (t.includes("оригинал") || t.includes("original")) return "Оригинал";
  if (t.includes("дигитал") || t.includes("digital")) return "Дигитальная версия";
  if (t.includes("песн") || t.includes("song")) return "Песня";
  if (t.includes("наклей") || t.includes("sticker")) return "Наклейка";
  if (t.includes("оживи") || t.includes("оживлен")) return "Оживи";
  if (t.includes("книг") && t.includes("жиз")) return "Книга жизни";
  if (t.includes("семейн")) return "Семейное издание";
  if (t.includes("персонализ") && t.includes("журнал")) return "Персонализированный журнал";
  if (t.includes("персонализ") && (t.includes("газет") || t.includes("aviz") || t.includes("avīz"))) {
    return "Персонализированная газета";
  }
  if (
    (/доставк/i.test(t) || /доплат/i.test(t) || /на месте/i.test(t)) &&
    !NEWSPAPER_TITLE_MARKERS.some((marker) => t.includes(marker)) &&
    !t.includes("поздр") &&
    !t.includes("реп")
  ) {
    return "Доставка";
  }
  if (NEWSPAPER_TITLE_MARKERS.some((marker) => t.includes(marker))) {
    return "Оригинал";
  }
  return null;
}

/** Labels that mean “no catalog product” — never show as a real product line. */
export function isMissingProductLabel(name: string | null | undefined): boolean {
  const n = (name || "").trim().toLowerCase();
  return !n || n === "без продукта" || n === "не заполнен в crm" || n === "crm_missing_product" || n === "no_product" || n === "unknown";
}

/** Resolve display product for a deal: catalog rows → gift SPA → title inference. */
export function resolveDealProductName(deal: {
  products?: Array<{ productName?: string; productId?: string }>;
  giftTypes?: string[];
  title?: string | null;
}): string | null {
  const line = deal.products?.find((item) => item.productName || item.productId);
  if (line?.productName) return line.productName;
  if (line?.productId) return line.productId;
  const gift = deal.giftTypes?.find((item) => item.trim());
  if (gift) return gift;
  return inferProductFromDealTitle(deal.title);
}

/** Fill empty productrows from gift SPA / title so analytics never invents a fake «Без продукта» bucket. */
export function hydrateDealProducts<T extends {
  products: BitrixSnapshotProductRow[];
  giftTypes?: string[];
  title?: string | null;
}>(deal: T): T {
  if (deal.products?.some((item) => item.productName || item.productId)) return deal;
  const name = resolveDealProductName(deal);
  if (!name) return deal;
  return {
    ...deal,
    giftTypes: deal.giftTypes?.length ? deal.giftTypes : [name],
    products: productRowsFromGiftTypes([name])
  };
}

export function readDealGiftLinksField(deal: Record<string, unknown>): unknown {
  return deal[BITRIX_DEAL_GIFT_LINKS_FIELD];
}
