/**
 * Bitrix Smart Invoice SPA (entityTypeId 31) — cash SSOT for «Оплачено».
 * Matches CRM Kanban filter: stage «Оплачено» + «Дата завершения» range, amounts in base EUR.
 */

import { bitrixListAll, bitrixResult } from "@/lib/bitrix/rest-client";
import type { BitrixSnapshotDeal } from "@/lib/bitrix/snapshot-store";
import {
  BITRIX_SMART_INVOICE_COMPLETION_DATE_FIELD,
  BITRIX_SMART_INVOICE_ENTITY_TYPE_ID,
  BITRIX_SMART_INVOICE_PAID_STAGE_ID
} from "@/lib/bitrix/metric-definitions";

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
  contactId?: number | string | null;
  companyId?: number | string | null;
  [key: string]: unknown;
};

type BitrixCurrency = {
  CURRENCY: string;
  AMOUNT: string | number;
  AMOUNT_CNT?: string | number;
  BASE?: string;
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
      BITRIX_SMART_INVOICE_COMPLETION_DATE_FIELD
    ],
    order: { id: "ASC" }
  });
}

/**
 * Paid SPA invoices with «Дата завершения» in [startDay, endDay] (inclusive, YYYY-MM-DD).
 * Amounts converted to Bitrix base currency (EUR).
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

  const out: BitrixSnapshotDeal[] = [];
  for (const item of items) {
    const completion = dayKey(item[BITRIX_SMART_INVOICE_COMPLETION_DATE_FIELD] as string | null | undefined);
    if (!completion || completion < startDay || completion > endDay) continue;

    const rawAmount = numberValue(item.opportunity);
    const currencyId = item.currencyId ? String(item.currencyId).trim() : null;
    const amountEur = Math.round(toBaseCurrencyAmount(rawAmount, currencyId, rates, baseCurrency) * 100) / 100;
    const assignedById = item.assignedById != null ? String(item.assignedById) : "unknown";

    out.push({
      id: `si31-${item.id}`,
      title: item.title?.trim() || (item.accountNumber ? `Счёт ${item.accountNumber}` : null),
      leadId: null,
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
      giftTypes: [],
      products: []
    });
  }

  return out;
}
