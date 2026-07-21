import { ORDERS_COLUMNS } from "@/config/os-sheets";
import { buildOrdersRowsFromSnapshot, mergeOrdersRow, mergeSheetAndBitrixOrders, emptyOrdersRow, ordersRowToSheetLine } from "@/lib/os-sheets/orders-mapper";
import type { BitrixSnapshot } from "@/lib/bitrix/snapshot-store";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const snapshot = {
  version: 2,
  period: "july-2026",
  periodStart: "2026-07-01",
  periodEnd: "2026-07-31",
  factualEnd: "2026-07-21",
  createdAt: "2026-07-21T12:00:00.000Z",
  countryOptions: ["Латвия"],
  productOptions: ["Газета"],
  leads: [{
    id: "10",
    dateCreate: "2026-07-02T10:00:00+03:00",
    statusId: "NEW",
    sourceId: "UC_GQ92V4",
    assignedById: "1",
    managerName: "Иван",
    country: "Латвия",
    utmSource: "facebook",
    utmMedium: "paid_social",
    utmCampaign: "july_test",
    utmContent: null,
    utmTerm: null,
    landingPage: null,
    formName: null
  }],
  recentLeads: [],
  deals: [{
    id: "100",
    leadId: "10",
    dateCreate: "2026-07-03T10:00:00+03:00",
    closeDate: null,
    invoiceDate: "2026-07-04",
    opportunity: 80,
    invoiceAmount: 80,
    stageId: "1",
    stageSemanticId: "P",
    sourceId: "UC_GQ92V4",
    assignedById: "1",
    managerName: "Иван",
    country: "Латвия",
    utmCampaign: "july_test",
    landingPage: null,
    products: [{ productId: "sku-1", productName: "Газета", quantity: 1, price: 80 }]
  }],
  paidDeals: [{
    id: "100",
    leadId: "10",
    dateCreate: "2026-07-03T10:00:00+03:00",
    closeDate: "2026-07-05",
    invoiceDate: "2026-07-04",
    opportunity: 80,
    invoiceAmount: 80,
    stageId: "WON",
    stageSemanticId: "S",
    sourceId: "UC_GQ92V4",
    assignedById: "1",
    managerName: "Иван",
    country: "Латвия",
    utmCampaign: "july_test",
    landingPage: null,
    products: [{ productId: "sku-1", productName: "Газета", quantity: 1, price: 80 }]
  }]
} satisfies BitrixSnapshot;

const rows = buildOrdersRowsFromSnapshot(snapshot, "2026-07-21T12:00:00.000Z");
assert(rows.length === 1, "expected one merged deal");
assert(rows[0].payment_status === "paid", "paid deal should win");
assert(rows[0].utm_source === "facebook", "utm from lead");
assert(rows[0].source_channel === "paid_social", "paid source channel");
process.env.BITRIX_WEBHOOK_URL = "https://bb-wood.bitrix24.eu/rest/1/xxx/";
const withUrl = buildOrdersRowsFromSnapshot(snapshot, "2026-07-21T12:00:00.000Z");
assert(
  withUrl[0].bitrix_url === "https://bb-wood.bitrix24.eu/crm/deal/details/100/",
  "bitrix deal url"
);

const sheetLine = ordersRowToSheetLine(withUrl[0]);
const amountIndex = ORDERS_COLUMNS.indexOf("amount");
assert(typeof sheetLine[amountIndex] === "number", "amount must be numeric cell");
assert(sheetLine[amountIndex] === 80, "amount value");

const existing = emptyOrdersRow();
existing.order_id = "100";
existing.production_status = "in_print";
existing.notes = "срочно";
existing.source_of_truth = "hybrid";

const merged = mergeOrdersRow(existing, rows[0]);
assert(merged.production_status === "in_print", "manual production preserved");
assert(merged.notes === "срочно", "notes preserved");
assert(merged.payment_status === "paid", "crm payment updated");
assert(merged.source_of_truth === "hybrid", "hybrid kept");

const orphan = emptyOrdersRow();
orphan.order_id = "manual-1";
orphan.source_of_truth = "manual";
orphan.notes = "ручной заказ";

const sheetMerged = mergeSheetAndBitrixOrders([existing, orphan], rows);
assert(sheetMerged.length === 2, "orphan manual row kept");
assert(sheetMerged.some((row) => row.order_id === "manual-1"), "manual order preserved");

console.log("os-orders mapper ok");
