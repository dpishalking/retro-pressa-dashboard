import { BITRIX_INVOICE_AMOUNT_FIELD } from "@/lib/bitrix/metric-definitions";

/**
 * Cash-in from a paid invoice: «Сумма для счета», otherwise OPPORTUNITY.
 * Never use deal close / WON stage as the money figure.
 */
export function paidInvoiceAmount(
  invoiceAmount?: number | string | null,
  opportunity?: number | string | null
): number {
  const invoice = Number(invoiceAmount);
  if (Number.isFinite(invoice) && invoice !== 0) return invoice;
  const opp = Number(opportunity);
  return Number.isFinite(opp) ? opp : 0;
}

export function paidInvoiceAmountFromRawDeal(deal: Record<string, unknown>): number {
  return paidInvoiceAmount(
    deal[BITRIX_INVOICE_AMOUNT_FIELD] as string | number | undefined,
    deal.OPPORTUNITY as string | number | undefined
  );
}

export const PAID_INVOICE_SOURCE =
  "Bitrix SPA Счета type/31: стадия Оплачено (DT31_2:P) + Дата завершения ufCrm_69C2C99FE5C54, сумма в EUR";
