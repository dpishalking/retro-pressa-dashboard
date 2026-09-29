import assert from "node:assert/strict";
import {
  chunkText,
  commandOf,
  formatDuration,
  formatQueue,
  formatReport,
  startOfTodayUnix,
  type WaitingChat
} from "@/lib/smartdesk/telegram-report";

assert.equal(commandOf("/queue@SmartdeskBot"), "queue");
assert.equal(commandOf("отчёт"), "report");
assert.equal(commandOf("привет"), null);

assert.equal(startOfTodayUnix(Date.parse("2026-09-28T17:38:00Z")), 1790542800);
assert.equal(formatDuration(360), "6 мин");
assert.equal(formatDuration(5400), "1,5 ч");

const chats: WaitingChat[] = [
  {
    id: 2,
    inbox: "WABA",
    assignee: "Надежда",
    contact: "Лена",
    waitingSince: 200,
    lastText: "позже",
    incoming: true
  },
  {
    id: 1,
    inbox: "WABA",
    assignee: "Ирина",
    contact: "Оля",
    waitingSince: 100,
    lastText: "где заказ",
    incoming: true
  }
];
const queue = formatQueue(chats, 2, 100_000);
assert.ok(queue.indexOf("conversations/1") < queue.indexOf("conversations/2"));
assert.match(queue, /Очередь «ждёт-ответа»: 2/);

const report = formatReport({
  dayLabel: "29 сентября",
  managers: [{ name: "Надежда", conversations: 4, incoming: 3, outgoing: 5, replySeconds: 360 }],
  inboxes: [],
  waiting: 1
});
assert.match(report, /Надежда — 4 диал\./);
assert.match(report, /Источники/);
const managersOnly = formatReport({
  dayLabel: "29 сентября",
  managers: [{ name: "Надежда", conversations: 4, incoming: 3, outgoing: 5, replySeconds: 360 }],
  inboxes: [],
  waiting: 1,
  part: "managers"
});
assert.equal(managersOnly.includes("Источники"), false);
assert.equal(chunkText("a\nb\nc", 3).length > 1, true);

console.log("smartdesk telegram tests passed");
