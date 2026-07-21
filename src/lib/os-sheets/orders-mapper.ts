import { PAID_LEAD_SOURCE_IDS } from "@/lib/bitrix/metric-definitions";
import type { BitrixSnapshot, BitrixSnapshotDeal, BitrixSnapshotLead } from "@/lib/bitrix/snapshot-store";
import { ORDERS_COLUMNS, ORDERS_MANUAL_COLUMNS, ORDERS_NUMERIC_COLUMNS, type OrdersColumn } from "@/config/os-sheets";

const paidSourceSet = new Set<string>(PAID_LEAD_SOURCE_IDS);
const manualColumnSet = new Set<string>(ORDERS_MANUAL_COLUMNS);
const numericColumnSet = new Set<string>(ORDERS_NUMERIC_COLUMNS);

export type OrdersRow = Record<OrdersColumn, string>;
export type OrdersSheetCell = string | number;

export function bitrixDealUrl(dealId: string): string {
  const webhook = process.env.BITRIX_WEBHOOK_URL?.trim();
  if (!webhook || !dealId) return "";
  try {
    return `${new URL(webhook).origin}/crm/deal/details/${dealId}/`;
  } catch {
    return "";
  }
}

export function emptyOrdersRow(): OrdersRow {
  return Object.fromEntries(ORDERS_COLUMNS.map((column) => [column, ""])) as OrdersRow;
}

export function ordersRowFromSheetLine(header: string[], line: string[]): OrdersRow | null {
  const row = emptyOrdersRow();
  header.forEach((rawKey, index) => {
    const key = rawKey.trim() as OrdersColumn;
    if (!ORDERS_COLUMNS.includes(key)) return;
    row[key] = String(line[index] ?? "").trim();
  });
  return row.order_id ? row : null;
}

export function ordersRowToSheetLine(row: OrdersRow): OrdersSheetCell[] {
  return ORDERS_COLUMNS.map((column) => {
    const raw = row[column] ?? "";
    if (!numericColumnSet.has(column)) return raw;
    if (!raw.trim()) return "";
    const normalized = raw.replace(/\s/g, "").replace(",", ".");
    const value = Number(normalized);
    return Number.isFinite(value) ? value : raw;
  });
}

function hasManualValues(row: OrdersRow) {
  return ORDERS_MANUAL_COLUMNS.some((column) => Boolean(row[column]?.trim()));
}

function sourceChannel(sourceId: string | null | undefined) {
  if (!sourceId) return "unknown";
  return paidSourceSet.has(sourceId) ? "paid_social" : "organic_other";
}

function paymentStatus(deal: BitrixSnapshotDeal): string {
  if (deal.stageSemanticId === "S") return "paid";
  if (deal.stageSemanticId === "F") return "lost";
  if (deal.invoiceDate || deal.invoiceAmount > 0) return "invoiced";
  return "unpaid";
}

function orderStatus(deal: BitrixSnapshotDeal): string {
  const payment = paymentStatus(deal);
  if (payment === "paid") return "paid";
  if (payment === "lost") return "lost";
  if (payment === "invoiced") return "invoiced";
  return "in_progress";
}

function primaryProduct(deal: BitrixSnapshotDeal) {
  const product = deal.products.find((item) => item.productName || item.productId);
  return {
    sku: product?.productId || "",
    name: product?.productName || ""
  };
}

function leadForDeal(deal: BitrixSnapshotDeal, leads: Map<string, BitrixSnapshotLead>) {
  if (!deal.leadId) return null;
  return leads.get(deal.leadId) ?? null;
}

export function mapDealToOrdersRow(
  deal: BitrixSnapshotDeal,
  lead: BitrixSnapshotLead | null,
  syncedAt: string
): OrdersRow {
  const product = primaryProduct(deal);
  const payment = paymentStatus(deal);
  const amount = payment === "paid"
    ? deal.opportunity
    : (deal.invoiceAmount > 0 ? deal.invoiceAmount : deal.opportunity);

  const row = emptyOrdersRow();
  row.order_id = deal.id;
  row.created_at = deal.dateCreate ?? "";
  row.lead_id = deal.leadId ?? "";
  row.deal_id = deal.id;
  row.bitrix_url = bitrixDealUrl(deal.id);
  row.customer_key = "";
  row.manager_id = deal.assignedById;
  row.manager_name = deal.managerName;
  row.country = deal.country || lead?.country || "";
  row.product_sku = product.sku;
  row.product_name = product.name;
  row.amount = amount ? String(amount) : "";
  row.currency = "EUR";
  row.invoice_amount = deal.invoiceAmount ? String(deal.invoiceAmount) : "";
  row.invoice_at = deal.invoiceDate ?? "";
  row.payment_status = payment;
  row.paid_at = payment === "paid" ? (deal.closeDate ?? "") : "";
  row.order_status = orderStatus(deal);
  row.stage_id = deal.stageId ?? "";
  row.stage_semantic = deal.stageSemanticId ?? "";
  row.source_channel = sourceChannel(deal.sourceId ?? lead?.sourceId);
  row.source_campaign = deal.utmCampaign || lead?.utmCampaign || "";
  row.utm_source = lead?.utmSource || "";
  row.utm_medium = lead?.utmMedium || "";
  row.utm_campaign = lead?.utmCampaign || deal.utmCampaign || "";
  row.source_of_truth = "bitrix";
  row.data_status = "live";
  row.updated_at = syncedAt;
  return row;
}

export function mergeOrdersRow(existing: OrdersRow | undefined, incoming: OrdersRow): OrdersRow {
  if (!existing) return incoming;

  const merged = { ...incoming };
  for (const column of ORDERS_MANUAL_COLUMNS) {
    merged[column] = existing[column] || "";
  }

  if (hasManualValues(existing) || existing.source_of_truth === "manual" || existing.source_of_truth === "hybrid") {
    merged.source_of_truth = existing.source_of_truth === "manual" ? "manual" : "hybrid";
  }

  return merged;
}

export function collectDealsFromSnapshot(snapshot: BitrixSnapshot): BitrixSnapshotDeal[] {
  const byId = new Map<string, BitrixSnapshotDeal>();
  for (const deal of snapshot.deals) byId.set(deal.id, deal);
  // Paid deals win on conflict — they carry CLOSEDATE / won semantic.
  for (const deal of snapshot.paidDeals) byId.set(deal.id, deal);
  return Array.from(byId.values()).sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true }));
}

export function buildOrdersRowsFromSnapshot(snapshot: BitrixSnapshot, syncedAt = new Date().toISOString()): OrdersRow[] {
  const leads = new Map(snapshot.leads.map((lead) => [lead.id, lead]));
  return collectDealsFromSnapshot(snapshot).map((deal) => mapDealToOrdersRow(deal, leadForDeal(deal, leads), syncedAt));
}

export function mergeSheetAndBitrixOrders(existingRows: OrdersRow[], bitrixRows: OrdersRow[]): OrdersRow[] {
  const existingById = new Map(existingRows.map((row) => [row.order_id, row]));
  const bitrixIds = new Set(bitrixRows.map((row) => row.order_id));

  const merged = bitrixRows.map((incoming) => mergeOrdersRow(existingById.get(incoming.order_id), incoming));

  for (const existing of existingRows) {
    if (bitrixIds.has(existing.order_id)) continue;
    // Keep manual / hybrid / orphan rows that Bitrix did not return this run.
    merged.push(existing);
  }

  return merged.sort((a, b) => a.order_id.localeCompare(b.order_id, "en", { numeric: true }));
}

export function isManualColumn(column: string) {
  return manualColumnSet.has(column);
}
