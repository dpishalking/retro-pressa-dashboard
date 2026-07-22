import { DEALS_RAW_COLUMNS, SALES_CATEGORY_ID, SELECT_DEAL, SF_FIELDS } from "@/config/sales-foundation";
import { bitrixBatch, bitrixListAll, chunkIds } from "@/lib/bitrix/rest-client";
import {
  asNumberString,
  asString,
  loadUserNames,
  periodToRange,
  resolveSfCustomerKey
} from "@/lib/bitrix/sales-foundation/customer-key";
import { BITRIX_INVOICE_FLAG_YES } from "@/lib/bitrix/metric-definitions";

export type DealRawRow = Record<(typeof DEALS_RAW_COLUMNS)[number], string>;

type BitrixDeal = Record<string, unknown>;
type ProductRow = { PRODUCT_ID?: string | number; PRODUCT_NAME?: string };

export async function fetchDealsRaw(periods: string[], syncedAt: string): Promise<{ rows: DealRawRow[]; warnings: string[] }> {
  const warnings: string[] = [];
  const byId = new Map<string, DealRawRow>();

  for (const period of periods) {
    const { startIso, endIso } = periodToRange(period);
    const deals = await bitrixListAll<BitrixDeal>("crm.deal.list", {
      filter: {
        CATEGORY_ID: SALES_CATEGORY_ID,
        ">=DATE_CREATE": startIso.slice(0, 19),
        "<=DATE_CREATE": endIso.slice(0, 19)
      },
      select: [...SELECT_DEAL],
      order: { DATE_CREATE: "ASC" }
    });

    const productMap = await loadProductRows(deals.map((deal) => asString(deal.ID)));
    const userNames = await loadUserNames(deals.map((deal) => asString(deal.ASSIGNED_BY_ID)));

    for (const deal of deals) {
      const dealId = asString(deal.ID);
      if (!dealId) continue;
      const products = productMap.get(dealId) || [];
      const primary = products[0];
      const semantic = asString(deal.STAGE_SEMANTIC_ID);
      const identity = resolveSfCustomerKey({
        contactId: asString(deal.CONTACT_ID),
        leadId: asString(deal.LEAD_ID),
        dealId
      });
      const invoiceFlagRaw = asString(deal[SF_FIELDS.invoiceFlag]);

      byId.set(dealId, {
        deal_id: dealId,
        lead_id: asString(deal.LEAD_ID),
        contact_id: asString(deal.CONTACT_ID),
        company_id: asString(deal.COMPANY_ID),
        created_at: asString(deal.DATE_CREATE),
        modified_at: asString(deal.DATE_MODIFY),
        closed_at: asString(deal.CLOSEDATE),
        stage_id: asString(deal.STAGE_ID),
        stage_semantic: semantic,
        category_id: asString(deal.CATEGORY_ID) || String(SALES_CATEGORY_ID),
        is_open: semantic === "P" ? "true" : (semantic === "S" || semantic === "F" ? "false" : (asString(deal.CLOSED) === "N" ? "true" : (asString(deal.CLOSED) === "Y" ? "false" : ""))),
        is_won: semantic === "S" ? "true" : "false",
        is_lost: semantic === "F" ? "true" : "false",
        assigned_by_id: asString(deal.ASSIGNED_BY_ID),
        assigned_by_name: userNames.get(asString(deal.ASSIGNED_BY_ID)) || "",
        source_id: asString(deal.SOURCE_ID),
        currency: asString(deal.CURRENCY_ID) || "EUR",
        opportunity: asNumberString(deal.OPPORTUNITY),
        invoice_amount: asNumberString(deal[SF_FIELDS.invoiceAmount]),
        invoice_at: asString(deal[SF_FIELDS.invoiceDate]),
        invoice_flag: invoiceFlagRaw === BITRIX_INVOICE_FLAG_YES || invoiceFlagRaw === "Y" ? "true" : (invoiceFlagRaw ? "false" : ""),
        country_raw: asString(deal[SF_FIELDS.dealCountry]),
        country_id: "",
        primary_product_id: primary?.PRODUCT_ID != null ? String(primary.PRODUCT_ID) : "",
        primary_product_name: asString(primary?.PRODUCT_NAME),
        product_rows_count: products.length ? String(products.length) : "",
        customer_key: identity.customer_key,
        customer_key_type: identity.customer_key_type,
        last_activity_at: asString(deal.LAST_ACTIVITY_TIME),
        next_activity_at: asString(deal.NEXT_ACTIVITY_TIME),
        raw_updated_at: asString(deal.DATE_MODIFY) || asString(deal.DATE_CREATE),
        sync_updated_at: syncedAt
      });
    }
  }

  if (!byId.size) warnings.push("No deals returned for requested periods");
  return { rows: [...byId.values()].sort((a, b) => a.deal_id.localeCompare(b.deal_id, "en", { numeric: true })), warnings };
}

async function loadProductRows(dealIds: string[]) {
  const map = new Map<string, ProductRow[]>();
  const unique = [...new Set(dealIds.filter(Boolean))];
  for (const chunk of chunkIds(unique, 50)) {
    const cmd: Record<string, string> = {};
    chunk.forEach((id, index) => {
      cmd[`p${index}`] = `crm.deal.productrows.get?id=${encodeURIComponent(id)}`;
    });
    const result = await bitrixBatch<ProductRow[]>(cmd);
    chunk.forEach((id, index) => {
      const rows = result[`p${index}`];
      map.set(id, Array.isArray(rows) ? rows : []);
    });
  }
  return map;
}

export function dealsToSheetRows(rows: DealRawRow[]): Array<Array<string | number>> {
  return rows.map((row) => DEALS_RAW_COLUMNS.map((column) => row[column] ?? ""));
}
