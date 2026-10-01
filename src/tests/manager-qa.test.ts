import assert from "node:assert/strict";
import { faqSections } from "@/lib/manager-qa/answer";
import { rankKnowledgeSections } from "@/lib/manager-qa/knowledge";
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
