import assert from "node:assert/strict";
import {
  aggregateMargins,
  buildMarginCatalog,
  parseIndexRows,
  parseMoneyCell,
  parseSkuMapRows,
  resolveLineCogs
} from "@/lib/product-hub/sku-margin-catalog";
import type { BitrixSnapshotDeal } from "@/lib/bitrix/snapshot-store";

assert.equal(parseMoneyCell("19"), 19);
assert.equal(parseMoneyCell("0,005"), 0.005);
assert.equal(parseMoneyCell("15–51 €"), 15);
assert.equal(parseMoneyCell("от 135 €"), 135);
assert.equal(parseMoneyCell("TBD"), null);

const skuMap = [
  [
    "bitrix_product_id",
    "bitrix_product_name",
    "product_id",
    "bitrix_gift_type",
    "cogs_eur",
    "retail_model_eur",
    "mapping_status"
  ],
  ["166", "Репродукция газеты", "PRODUCT_REPRODUCTION", "Репродукция", "19", "45", "mapped"],
  ["174", "Поздравительная газета", "PRODUCT_CONGRATS_NEWSPAPER", "Поздравительная газета", "24", "67", "mapped"]
];

const index = [
  ["#", "Лист", "Тип Bitrix", "PRODUCT_ID", "Цена витрина", "COGS"],
  ["1", "01_Оригинал", "Оригинал", "PRODUCT_ORIGINAL", "15–51 €", "8"],
  ["12", "12_Песня", "Поздравительная песня", "PRODUCT_CONGRATS_SONG", "20 €", "1"]
];

assert.equal(parseSkuMapRows(skuMap).length, 2);
assert.equal(parseIndexRows(index).length, 2);

const catalog = buildMarginCatalog({
  spreadsheetId: "test",
  skuMap,
  index
});

assert.equal(resolveLineCogs({ productId: "166", productName: "Репродукция газеты", quantity: 2, price: 45 }, catalog).cogsUnit, 19);
assert.equal(
  resolveLineCogs({ productId: "288", productName: "Оригинальная газета", quantity: 1, price: 45 }, catalog).cogsUnit,
  8
);
assert.equal(resolveLineCogs({ productId: "496", productName: "Песня", quantity: 1, price: 20 }, catalog).cogsUnit, 1);

const deals: BitrixSnapshotDeal[] = [
  {
    id: "1",
    title: null,
    leadId: null,
    contactId: null,
    dateCreate: null,
    closeDate: null,
    invoiceDate: null,
    opportunity: 90,
    currencyId: "EUR",
    invoiceAmount: 90,
    stageId: null,
    stageSemanticId: "S",
    sourceId: null,
    assignedById: "1",
    managerName: "A",
    country: "LV",
    utmCampaign: null,
    landingPage: null,
    phone: null,
    email: null,
    products: [{ productId: "166", productName: "Репродукция газеты", quantity: 2, price: 45 }]
  },
  {
    id: "2",
    title: null,
    leadId: null,
    contactId: null,
    dateCreate: null,
    closeDate: null,
    invoiceDate: null,
    opportunity: 60,
    currencyId: "EUR",
    invoiceAmount: 60,
    stageId: null,
    stageSemanticId: "S",
    sourceId: null,
    assignedById: "1",
    managerName: "A",
    country: "LV",
    utmCampaign: null,
    landingPage: null,
    phone: null,
    email: null,
    products: []
  }
];

const agg = aggregateMargins(deals, catalog);
assert.equal(agg.revenue, 150);
assert.equal(agg.mappedRevenue, 90);
assert.equal(agg.cogs, 38);
assert.equal(agg.grossProfit, 52);
assert.equal(agg.dealsFullyMapped, 1);
assert.equal(agg.dealsWithProducts, 1);

console.log("sku-margin-catalog tests ok");
