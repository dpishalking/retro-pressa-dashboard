import assert from "node:assert/strict";
import { parseOpenLineManagerEcho, resolveOpenLineSpeaker } from "@/lib/bitrix/openline-waba";

const waba = `=== Исходящее сообщение, автор: Битрикс24 (Надежда Веклич) ===
Добрый день! 😊
Меня зовут Надежда, я менеджер retro-pressa.`;

const parsed = parseOpenLineManagerEcho(waba);
assert.equal(parsed?.authorName, "Надежда Веклич");
assert.match(parsed?.body ?? "", /^Добрый день!/);

const speaker = resolveOpenLineSpeaker({
  extranet: "Y",
  userName: "Николай",
  text: waba
});
assert.equal(speaker.role, "manager");
assert.equal(speaker.name, "Надежда Веклич");
assert.match(speaker.text, /^Добрый день!/);

const collapsed = waba.replace(/\s+/g, " ");
const collapsedSpeaker = resolveOpenLineSpeaker({ extranet: true, userName: "Николай", text: collapsed });
assert.equal(collapsedSpeaker.role, "manager");
assert.equal(collapsedSpeaker.name, "Надежда Веклич");

const wazzup = resolveOpenLineSpeaker({
  extranet: true,
  userName: "Юра",
  text: "=== Исходящее сообщение, автор: WAZZUP === Отлично, спасибо!"
});
assert.equal(wazzup.role, "manager");
assert.equal(wazzup.name, "Менеджер");
assert.equal(wazzup.text, "Отлично, спасибо!");

const br = resolveOpenLineSpeaker({
  extranet: "Y",
  userName: "Клиент",
  text: "=== Исходящее сообщение, автор: Битрикс24 (Альбина Филоненко) ===<br />Добрый день!"
});
assert.equal(br.role, "manager");
assert.equal(br.name, "Альбина Филоненко");
assert.equal(br.text, "Добрый день!");

const client = resolveOpenLineSpeaker({
  extranet: true,
  userName: "Николай",
  text: "Здравствуйте. Сколько стоит такая газета?"
});
assert.equal(client.role, "client");
assert.equal(client.name, "Николай");

const manager = resolveOpenLineSpeaker({
  extranet: false,
  userName: "Надежда Веклич",
  text: "Добрый день! Это Надежда."
});
assert.equal(manager.role, "manager");
assert.equal(manager.name, "Надежда Веклич");

assert.equal(parseOpenLineManagerEcho("Клиент просто написал"), null);

console.log("openline-waba tests passed");
