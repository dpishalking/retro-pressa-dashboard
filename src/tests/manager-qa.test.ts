import assert from "node:assert/strict";
import materialsFile from "../../data/training/client-materials.json";
import productsFile from "../../data/training/products.json";
import { faqSections, renderTelegramMessage, stripTelegramMarkup } from "@/lib/manager-qa/answer";
import {
  buildProductSections,
  formatAssetReply,
  formatCardFooter,
  matchProductRules,
  pickSections
} from "@/lib/manager-qa/catalog";
import { MANAGER_KNOWLEDGE, rankKnowledgeSections } from "@/lib/manager-qa/knowledge";
import { isAllowedManager } from "@/lib/manager-qa/telegram";

const italy = rankKnowledgeSections("Сколько занимает доставка в Италию и какая стоимость?");
assert.equal(italy[0]?.id, "delivery");

const stuck = rankKnowledgeSections("Куда обращаться, если у меня застрял заказ и нет трека?");
assert.equal(stuck[0]?.id, "chats");

const payment = rankKnowledgeSections("Какие реквизиты давать клиенту из Риги?");
assert.equal(payment[0]?.id, "payments");

assert.equal(rankKnowledgeSections("привет").length, 0);

const faq = faqSections([
  { question: "Как оформить заказ?", answer: "Создайте сделку в Bitrix.", category: "CRM" },
  { question: " ", answer: "пусто" }
]);
assert.equal(faq.length, 1);
assert.match(faq[0]?.text ?? "", /Bitrix/);

const previous = process.env.TELEGRAM_MANAGER_QA_USER_IDS;
process.env.TELEGRAM_MANAGER_QA_USER_IDS = "";
assert.equal(isAllowedManager(1), true);
process.env.TELEGRAM_MANAGER_QA_USER_IDS = "10, 20";
assert.equal(isAllowedManager(20), true);
assert.equal(isAllowedManager(30), false);
process.env.TELEGRAM_MANAGER_QA_USER_IDS = previous;

assert.deepEqual(matchProductRules("Сколько стоит книга жизни в заголовках?").map((rule) => rule.id), ["personal-magazine"]);
assert.deepEqual(matchProductRules("Сколько стоит книга жизни?").map((rule) => rule.id), ["life-story"]);
assert.equal(matchProductRules("Сколько занимает доставка в Италию?").length, 0);

const corpus = {
  sections: [...MANAGER_KNOWLEDGE, ...buildProductSections(productsFile.products)],
  products: productsFile.products,
  materials: materialsFile.materials,
  genericReviews: []
};
const book = pickSections("Сколько стоит книга жизни?", corpus.sections);
assert.equal(book[0]?.id, "product-life-story");
const italyWithProducts = pickSections("Сколько занимает доставка в Италию и какая стоимость?", corpus.sections);
assert.equal(italyWithProducts[0]?.id, "delivery");

const washington = pickSections("сколько будет стоить доставка в вашингтон?", MANAGER_KNOWLEDGE);
assert.equal(washington[0]?.id, "delivery");
assert.match(washington[0]?.text ?? "", /Вашингтон/);
assert.match(washington[0]?.text ?? "", /13 EUR/);

const reviews = formatAssetReply("Скинь отзывы по поздравительной газете", corpus);
assert.match(reviews || "", /Отзывы:/);
assert.match(reviews || "", /https:\/\/(www\.)?youtube\.com|https:\/\/youtu\.be/);
assert.doesNotMatch(reviews || "", /rp-bi\.site\/cards/);
assert.doesNotMatch(reviews || "", /congratulatory-magazine/);

assert.equal(formatCardFooter("Что говорить, если дорого, про книгу жизни?"), null);
assert.equal(formatCardFooter("Скинь отзывы по книге жизни"), null);

assert.equal(
  stripTelegramMarkup("* **Региональная репродукция:** Александр / чат «Репродукция»."),
  "Региональная репродукция: Александр / чат «Репродукция»."
);

const slovenia = renderTelegramMessage(`Для Словении есть два варианта доставки DPD:
- в пункт выдачи / пакомат DPD — 11 EUR, срок 3–6 дней;
- доставка DPD на дом — 21 EUR, срок 3–6 дней.`);
assert.match(slovenia, /🇸🇮 <b>Словения<\/b>/);
assert.match(slovenia, /📦 <b>Пункт выдачи \/ пакомат · DPD<\/b>/);
assert.match(slovenia, /🏠 <b>На дом · DPD<\/b>/);
assert.match(slovenia, /💶 11 EUR/);
assert.match(slovenia, /⏱ 3–6 дней/);
assert.doesNotMatch(slovenia, /\*/);

const gap = renderTelegramMessage(`Отдельной строки нет, но ориентируемся по правилу «Работа с архивом Retro Pressa».
Пункт выдачи DPD — 11 EUR, срок 3–6 дней.`);
assert.doesNotMatch(gap, /отдельной строки/i);
assert.doesNotMatch(gap, /правилу/i);
assert.match(gap, /11 EUR/);

const telAviv = renderTelegramMessage(`Доставка в Тель-Авив
Отдельной строки для Тель-Авива нет, считаем по правилу для Израиля.
- PUMITY — 19 EUR, срок 7–14 дней
Мы НЕ отвечаем за сроки доставки, потому что мы не являемся логистической компанией и ногами не доставляем.`);
assert.doesNotMatch(telAviv, /отдельной строки/i);
assert.doesNotMatch(telAviv, /правилу/i);
assert.doesNotMatch(telAviv, /не отвечаем за сроки/i);
assert.match(telAviv, /🇮🇱 <b>Израиль<\/b>/);

const archive = renderTelegramMessage(`Как проверить наличие издания в архиве
Чтобы проверить наличие издания, следуйте этим шагам:
1. Поиск по дате на сайте
Зайдите на сайт retropressa.com.
2. Определение формата
Внизу карточки смотрите строку «Оригинал».`);
assert.match(archive, /<b>Как проверить наличие издания в архиве<\/b>/);
assert.match(archive, /🔍 <b>1\. Поиск по дате на сайте<\/b>/);
assert.match(archive, /• Зайдите на сайт retropressa.com\./);
assert.match(archive, /🎨 <b>2\. Определение формата<\/b>/);
assert.match(archive, /\n\n🔍/);
assert.match(archive, /\n\n🎨/);
assert.doesNotMatch(archive, /следуйте этим шагам/);

const unsafe = renderTelegramMessage("Цена <script>alert(1)</script> и 5 < 10");
assert.match(unsafe, /&lt;script&gt;/);
assert.doesNotMatch(unsafe, /<script>/);
