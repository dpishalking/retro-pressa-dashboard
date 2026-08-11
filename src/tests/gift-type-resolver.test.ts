import assert from "node:assert/strict";
import {
  giftTypesFromDealField,
  parseDealGiftLinkIds,
  productRowsFromGiftTypes,
  giftTypeNameFromEnumId,
  hydrateDealProducts,
  inferProductFromDealTitle
} from "@/lib/bitrix/gift-type-resolver";

assert.deepEqual(parseDealGiftLinkIds(["2966", "3040"]), ["2966", "3040"]);
assert.deepEqual(parseDealGiftLinkIds(false), []);
assert.deepEqual(parseDealGiftLinkIds(null), []);
assert.deepEqual(parseDealGiftLinkIds("3236"), ["3236"]);

assert.equal(giftTypeNameFromEnumId("2730"), "Репродукция");
assert.equal(giftTypeNameFromEnumId("2732"), "Поздравительная газета");
assert.equal(giftTypeNameFromEnumId("9999"), null);

const map = new Map([
  ["2966", "Репродукция"],
  ["2728", "Оригинал"]
]);
assert.deepEqual(giftTypesFromDealField(["2966", "2728", "2966"], map), ["Репродукция", "Оригинал"]);
assert.deepEqual(giftTypesFromDealField(false, map), []);

const rows = productRowsFromGiftTypes(["Оригинал"]);
assert.equal(rows.length, 1);
assert.equal(rows[0].productName, "Оригинал");
assert.equal(rows[0].quantity, 1);

assert.equal(inferProductFromDealTitle("8678 поздр Правда - Наталья"), "Поздравительная газета");
assert.equal(inferProductFromDealTitle("8319 реп Правда 05.08.1973"), "Репродукция");
assert.equal(inferProductFromDealTitle("Правда, № 265 оригинал"), "Оригинал");
assert.equal(inferProductFromDealTitle("8609 доставка!"), "Доставка");
assert.equal(inferProductFromDealTitle("8261 - Vitaly Levin (2 дигитальные)"), "Дигитальная версия");
assert.equal(inferProductFromDealTitle("Надежда Солонская Знамя коммунизма на дату 12.07.1966"), "Оригинал");
assert.equal(inferProductFromDealTitle("8311 ольга - еще будет оживление"), "Оживи");
assert.equal(inferProductFromDealTitle("7802/ ОПЛАТИЛА 148 РУБЛЕЙ, ЕЩЕ 46 НА МЕСТЕ"), "Доставка");

const hydrated = hydrateDealProducts({
  id: "91316",
  title: "8678 поздр Правда - Наталья записано",
  products: [],
  giftTypes: []
});
assert.equal(hydrated.products[0]?.productName, "Поздравительная газета");
assert.deepEqual(hydrated.giftTypes, ["Поздравительная газета"]);

console.log("gift-type-resolver.test.ts: ok");
