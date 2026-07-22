#!/usr/bin/env node
/**
 * Day report: Bitrix leads created + duplicates by phone/email history.
 * Usage: node scripts/bitrix-leads-day.mjs [YYYY-MM-DD]
 * Env: BITRIX_WEBHOOK_URL from .env.local
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = t.indexOf("=");
    const k = t.slice(0, i).trim();
    if (!process.env[k]) process.env[k] = t.slice(i + 1).trim().replace(/^['"]|['"]$/g, "");
  }
}

const bitrixUrl = (process.env.BITRIX_WEBHOOK_URL || "").replace(/\/$/, "");
if (!bitrixUrl) {
  console.error("BITRIX_WEBHOOK_URL is not configured");
  process.exit(1);
}

const SERVICE_PHONE_TAILS = ["28373939"];

function todayRiga() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Riga",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function digits(v) {
  return String(v || "").replace(/\D/g, "");
}

function normalizePhone(v) {
  const d = digits(v);
  if (!d) return "";
  return d.length >= 10 ? d.slice(-10) : d;
}

function isServicePhone(p) {
  return SERVICE_PHONE_TAILS.some((tail) => p === tail || p.endsWith(tail));
}

function extractPhones(lead) {
  const phones = [];
  for (const key of ["PHONE", "PHONE_MOBILE", "PHONE_WORK", "PHONE_HOME"]) {
    if (!Array.isArray(lead[key])) continue;
    for (const item of lead[key]) phones.push(normalizePhone(item?.VALUE || item?.value));
  }
  return [...new Set(phones.filter(Boolean).filter((p) => !isServicePhone(p)))];
}

function extractEmails(lead) {
  const emails = [];
  if (!Array.isArray(lead.EMAIL)) return emails;
  for (const item of lead.EMAIL) {
    const v = String(item?.VALUE || item?.value || "")
      .trim()
      .toLowerCase();
    if (v) emails.push(v);
  }
  return [...new Set(emails)];
}

function hasUtm(lead) {
  return Boolean(
    (lead.UTM_SOURCE || "").trim() ||
      (lead.UTM_MEDIUM || "").trim() ||
      (lead.UTM_CAMPAIGN || "").trim()
  );
}

function channelOf(title) {
  const t = String(title || "");
  if (/Instagram/i.test(t)) return "Instagram";
  if (/WhatsApp/i.test(t)) return "WhatsApp";
  if (/Facebook/i.test(t) && !/Заявка/i.test(t)) return "Facebook";
  if (/Wazzup|Telegram|\bTG\b/i.test(t)) return "Telegram";
  if (/Заявка с сайта/i.test(t)) return "Site";
  return "Other";
}

async function bitrixAll(method, params) {
  const rows = [];
  let start = 0;
  while (true) {
    const response = await fetch(`${bitrixUrl}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...params, start })
    });
    const data = await response.json();
    if (data.error) throw new Error(data.error_description || data.error);
    const chunk = Array.isArray(data.result) ? data.result : data.result?.items || [];
    rows.push(...chunk);
    if (data.next == null) break;
    start = data.next;
  }
  return rows;
}

const day = process.argv[2] || todayRiga();
if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
  console.error("Date must be YYYY-MM-DD");
  process.exit(1);
}

const historyFrom = `${day.slice(0, 4)}-05-01`;

const leads = await bitrixAll("crm.lead.list", {
  order: { DATE_CREATE: "ASC" },
  filter: {
    ">=DATE_CREATE": historyFrom,
    "<=DATE_CREATE": `${day} 23:59:59`
  },
  select: [
    "ID",
    "DATE_CREATE",
    "TITLE",
    "PHONE",
    "EMAIL",
    "UTM_SOURCE",
    "UTM_MEDIUM",
    "UTM_CAMPAIGN"
  ]
});

const today = leads.filter((l) => String(l.DATE_CREATE || "").startsWith(day));
const before = leads.filter((l) => !String(l.DATE_CREATE || "").startsWith(day));

const phoneHist = new Map();
const emailHist = new Map();
for (const lead of before) {
  for (const p of extractPhones(lead)) if (!phoneHist.has(p)) phoneHist.set(p, lead);
  for (const e of extractEmails(lead)) if (!emailHist.has(e)) emailHist.set(e, lead);
}

const phoneDay = new Map();
const emailDay = new Map();
const dups = new Map();

function mark(id, reason, channel) {
  if (!dups.has(id)) dups.set(id, { reasons: new Set(), channel });
  dups.get(id).reasons.add(reason);
}

let withUtm = 0;
const byChannelAll = {};
const byChannelDup = {};

for (const lead of today) {
  const channel = channelOf(lead.TITLE);
  byChannelAll[channel] = (byChannelAll[channel] || 0) + 1;
  if (hasUtm(lead)) withUtm += 1;

  const phones = extractPhones(lead);
  const emails = extractEmails(lead);

  for (const p of phones) {
    if (phoneHist.has(p)) mark(lead.ID, "phone_history", channel);
    if (phoneDay.has(p)) mark(lead.ID, "phone_same_day", channel);
    else phoneDay.set(p, lead);
  }
  for (const e of emails) {
    if (emailHist.has(e)) mark(lead.ID, "email_history", channel);
    if (emailDay.has(e)) mark(lead.ID, "email_same_day", channel);
    else emailDay.set(e, lead);
  }
}

for (const info of dups.values()) {
  byChannelDup[info.channel] = (byChannelDup[info.channel] || 0) + 1;
}

const created = today.length;
const duplicates = dups.size;
const unique = created - duplicates;

const report = {
  date: day,
  historyFrom,
  created,
  duplicates,
  unique,
  withUtm,
  withoutUtm: created - withUtm,
  byChannelAll,
  byChannelDup
};

console.log(JSON.stringify(report, null, 2));
console.log(
  `\n${day}: создано ${created} | дубли ${duplicates} | уникальные ≈ ${unique} | UTM ${withUtm}/${created - withUtm}`
);
