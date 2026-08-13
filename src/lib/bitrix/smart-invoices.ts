/**
 * Bitrix Smart Invoice SPA (entityTypeId 31) — cash SSOT for «Оплачено».
 * Matches CRM Kanban filter: stage «Оплачено» + «Дата завершения» range, amounts in base EUR.
 * Gift type comes from parent deal (parentId2) via SPA «Вид подарка» links — invoices themselves
 * do not store gift type.
 */

import {
  giftTypesFromDealField,
  hydrateDealProducts,
  parseDealGiftLinkIds,
  productRowsFromGiftTypes,
  resolveGiftTypeNamesByItemIds
} from "@/lib/bitrix/gift-type-resolver";
import {
  BITRIX_DEAL_GIFT_LINKS_FIELD,
  BITRIX_SMART_INVOICE_COMPLETION_DATE_FIELD,
  BITRIX_SMART_INVOICE_ENTITY_TYPE_ID,
  BITRIX_SMART_INVOICE_PAID_STAGE_ID
} from "@/lib/bitrix/metric-definitions";
import { bitrixBatch, bitrixListAll, bitrixResult, chunkIds } from "@/lib/bitrix/rest-client";
import type { BitrixSnapshotDeal } from "@/lib/bitrix/snapshot-store";

export type BitrixSmartInvoiceItem = {
  id: number | string;
  title?: string | null;
  opportunity?: number | string | null;
  currencyId?: string | null;
  assignedById?: number | string | null;
  accountNumber?: string | null;
  begindate?: string | null;
  createdTime?: string | null;
  movedTime?: string | null;
  stageId?: string | null;
  contactId?: string | number | null;
  companyId?: string | number | null;
  /** CRM deal linked to this invoice (SPA parent relation). */
  parentId2?: string | number | null;
  [key: string]: unknown;
};

type BitrixCurrency = {
  CURRENCY: string;
  AMOUNT: string | number;
  AMOUNT_CNT?: string | number;
  BASE?: string;
};

type ParentDealGiftInfo = {
  leadId: string | null;
  giftTypes: string[];
  title: string | null;
  productNames: string[];
};

function dayKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = String(value).match(/(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function numberValue(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function productNamesFromRows(rows: unknown): string[] {
  if (!Array.isArray(rows)) return [];
  const names: string[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const name = String((row as { PRODUCT_NAME?: unknown }).PRODUCT_NAME || "").trim();
    if (!name || name.toLowerCase() === "без продукта") continue;
    names.push(name);
  }
  return Array.from(new Set(names));
}

/** Map catalog product names to SPA gift-type labels when possible. */
function giftTypeFromProductName(name: string): string {
  const t = name.toLowerCase().replace(/ё/g, "е");
  if (t.includes("поздрав") && t.includes("журнал")) return "Поздравительный журнал";
  if (t.includes("поздрав") || t.includes("apsveikuma")) return "Поздравительная газета";
  if (t.includes("репродук")) return "Репродукция";
  if (t.includes("оригинальн") && t.includes("журнал")) return "Оригинал";
  if (t.includes("оригинал")) return "Оригинал";
  if (t.includes("дигитал") || t.includes("digital")) return "Дигитальная версия";
  if (t.includes("песн")) return "Песня";
  if (t.includes("наклей")) return "Наклейка";
  if (t.includes("оживи")) return "Оживи";
  if (t.includes("книг") && t.includes("жиз")) return "Книга жизни";
  if (t.includes("упаков")) return "Упаковка";
  if (t.includes("персонализ") && t.includes("журнал")) return "Персонализированный журнал";
  if (t.includes("персонализ") && t.includes("газет")) return "Персонализированная газета";
  return name;
}

/** Bitrix rate: AMOUNT = how many base-currency units for AMOUNT_CNT of this currency. */
export function toBaseCurrencyAmount(
  amount: number,
  currencyId: string | null | undefined,
  rates: Map<string, number>,
  baseCurrency = "EUR"
): number {
  const cur = (currencyId || baseCurrency).toUpperCase();
  if (cur === baseCurrency) return amount;
  const rate = rates.get(cur);
  if (rate == null || !Number.isFinite(rate)) return amount;
  return amount * rate;
}

export async function loadBitrixCurrencyRatesToBase(): Promise<{
  baseCurrency: string;
  rates: Map<string, number>;
}> {
  const list = await bitrixResult<BitrixCurrency[]>("crm.currency.list");
  const rates = new Map<string, number>();
  let baseCurrency = "EUR";
  for (const row of list || []) {
    const code = String(row.CURRENCY || "").toUpperCase();
    if (!code) continue;
    const cnt = Math.max(1, numberValue(row.AMOUNT_CNT ?? 1));
    const amt = numberValue(row.AMOUNT);
    rates.set(code, amt / cnt);
    if (row.BASE === "Y") baseCurrency = code;
  }
  rates.set(baseCurrency, 1);
  return { baseCurrency, rates };
}

export async function listSmartInvoicesByPaidStage(): Promise<BitrixSmartInvoiceItem[]> {
  return bitrixListAll<BitrixSmartInvoiceItem>("crm.item.list", {
    entityTypeId: BITRIX_SMART_INVOICE_ENTITY_TYPE_ID,
    filter: { stageId: BITRIX_SMART_INVOICE_PAID_STAGE_ID },
    select: [
      "id",
      "title",
      "opportunity",
      "currencyId",
      "assignedById",
      "accountNumber",
      "begindate",
      "createdTime",
      "movedTime",
      "stageId",
      "contactId",
      "companyId",
      "parentId2",
      BITRIX_SMART_INVOICE_COMPLETION_DATE_FIELD
    ],
    order: { id: "ASC" }
  });
}

async function loadParentDealGiftInfo(dealIds: string[]): Promise<Map<string, ParentDealGiftInfo>> {
  const unique = Array.from(new Set(dealIds.filter(Boolean)));
  const out = new Map<string, ParentDealGiftInfo>();
  if (!unique.length) return out;

  const giftItemIds = new Set<string>();
  const rawByDeal = new Map<
    string,
    { leadId: string | null; title: string | null; giftRaw: unknown; productNames: string[] }
  >();

  for (const batch of chunkIds(unique, 25)) {
    const commands = Object.fromEntries(
      batch.flatMap((id, index) => [
        [
          `d${index}`,
          `crm.deal.get?id=${encodeURIComponent(id)}&select[]=ID&select[]=TITLE&select[]=LEAD_ID&select[]=${BITRIX_DEAL_GIFT_LINKS_FIELD}`
        ],
        [`p${index}`, `crm.deal.productrows.get?id=${encodeURIComponent(id)}`]
      ])
    );
    const result = await bitrixBatch<Record<string, unknown> | unknown[]>(commands);
    for (let index = 0; index < batch.length; index += 1) {
      const deal = result[`d${index}`];
      const rows = result[`p${index}`];
      if (!deal || typeof deal !== "object" || Array.isArray(deal)) continue;
      const id = String(deal.ID ?? batch[index]);
      const giftRaw = deal[BITRIX_DEAL_GIFT_LINKS_FIELD];
      for (const giftId of parseDealGiftLinkIds(giftRaw)) giftItemIds.add(giftId);
      rawByDeal.set(id, {
        leadId: deal.LEAD_ID != null && String(deal.LEAD_ID) !== "0" ? String(deal.LEAD_ID) : null,
        title: deal.TITLE != null ? String(deal.TITLE) : null,
        giftRaw,
        productNames: productNamesFromRows(rows)
      });
    }
  }

  const giftItemToType = await resolveGiftTypeNamesByItemIds([...giftItemIds]);
  for (const [dealId, raw] of rawByDeal) {
    const fromSpa = giftTypesFromDealField(raw.giftRaw, giftItemToType);
    const fromProducts = raw.productNames.map(giftTypeFromProductName);
    out.set(dealId, {
      leadId: raw.leadId,
      title: raw.title,
      giftTypes: fromSpa.length ? fromSpa : Array.from(new Set(fromProducts)),
      productNames: raw.productNames
    });
  }
  return out;
}

/**
 * Paid SPA invoices with «Дата завершения» in [startDay, endDay] (inclusive, YYYY-MM-DD).
 * Amounts converted to Bitrix base currency (EUR).
 * Gift type / products: parent deal SPA «Вид подарка», else title inference.
 */
export async function listPaidSmartInvoicesForPeriod(
  startDay: string,
  endDay: string,
  userNames?: Map<string, string>
): Promise<BitrixSnapshotDeal[]> {
  const [{ baseCurrency, rates }, items] = await Promise.all([
    loadBitrixCurrencyRatesToBase(),
    listSmartInvoicesByPaidStage()
  ]);

  const periodItems = items.filter((item) => {
    const completion = dayKey(item[BITRIX_SMART_INVOICE_COMPLETION_DATE_FIELD] as string | null | undefined);
    return Boolean(completion && completion >= startDay && completion <= endDay);
  });

  const parentIds = periodItems
    .map((item) => (item.parentId2 != null ? String(item.parentId2) : ""))
    .filter(Boolean);
  const parentInfo = await loadParentDealGiftInfo(parentIds);

  const out: BitrixSnapshotDeal[] = [];
  for (const item of periodItems) {
    const completion = dayKey(item[BITRIX_SMART_INVOICE_COMPLETION_DATE_FIELD] as string | null | undefined)!;
    const rawAmount = numberValue(item.opportunity);
    const currencyId = item.currencyId ? String(item.currencyId).trim() : null;
    const amountEur = Math.round(toBaseCurrencyAmount(rawAmount, currencyId, rates, baseCurrency) * 100) / 100;
    const assignedById = item.assignedById != null ? String(item.assignedById) : "unknown";
    const parentId = item.parentId2 != null ? String(item.parentId2) : null;
    const parent = parentId ? parentInfo.get(parentId) : undefined;
    const invoiceTitle = item.title?.trim() || (item.accountNumber ? `Счёт ${item.accountNumber}` : null);
    const giftTypes = parent?.giftTypes?.length ? parent.giftTypes : [];

    const hydrated = hydrateDealProducts({
      id: `si31-${item.id}`,
      title: invoiceTitle || parent?.title || null,
      products: giftTypes.length ? productRowsFromGiftTypes(giftTypes) : [],
      giftTypes
    });

    out.push({
      id: `si31-${item.id}`,
      title: hydrated.title,
      leadId: parent?.leadId ?? null,
      contactId: item.contactId != null ? String(item.contactId) : null,
      dateCreate: item.createdTime ?? null,
      closeDate: completion,
      invoiceDate: dayKey(item.begindate) || completion,
      paymentDate: completion,
      opportunity: amountEur,
      currencyId: baseCurrency,
      invoiceAmount: amountEur,
      deliveryPrice: null,
      stageId: BITRIX_SMART_INVOICE_PAID_STAGE_ID,
      stageName: "Оплачено",
      stageSemanticId: "S",
      lastActivityAt: item.movedTime ?? null,
      sourceId: null,
      assignedById,
      managerName: userNames?.get(assignedById) ?? `ID ${assignedById}`,
      country: "",
      utmCampaign: null,
      landingPage: null,
      phone: null,
      email: null,
      giftTypes: hydrated.giftTypes || [],
      products: hydrated.products
    });
  }

  return out;
}
