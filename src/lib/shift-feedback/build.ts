import { bitrixBatch, bitrixListAll, chunkIds } from "@/lib/bitrix/rest-client";
import { loadUserNames } from "@/lib/bitrix/sales-foundation/customer-key";
import { firstNameFrom, messageDayIso } from "@/lib/manager-cabinet/dates";
import { matchUniqueByName, normalizePersonName } from "@/lib/manager-cabinet/match";
import { loadManagerSchedule } from "@/lib/sales/load-manager-schedule";
import { isShiftLiveCut, moscowDateIso, moscowHm } from "@/lib/shift-feedback/time";
import type { ShiftFeedbackReport, ShiftFocusLead, ShiftLeadItem, ShiftManagerPage } from "@/lib/shift-feedback/types";

type BitrixUser = { ID?: string; NAME?: string; LAST_NAME?: string; ACTIVE?: boolean | string };
type BitrixLead = {
  ID?: string;
  TITLE?: string;
  DATE_CREATE?: string;
  ASSIGNED_BY_ID?: string;
  PHONE?: Array<{ VALUE?: string }>;
  EMAIL?: Array<{ VALUE?: string }>;
  UTM_SOURCE?: string;
  UTM_MEDIUM?: string;
  UTM_CAMPAIGN?: string;
};
type BitrixActivity = {
  ID?: string;
  CREATED?: string;
  OWNER_ID?: string;
  OWNER_TYPE_ID?: string;
  ASSOCIATED_ENTITY_ID?: string;
  SUBJECT?: string;
  RESPONSIBLE_ID?: string;
  LAST_UPDATED?: string;
};
type BitrixHistoryUser = { id?: string; name?: string; extranet?: boolean | string };
type BitrixHistoryMessage = { id?: string; date?: string; senderid?: string; text?: string; textlegacy?: string };
type BitrixSessionHistory = { message?: Record<string, BitrixHistoryMessage>; users?: Record<string, BitrixHistoryUser> };

type DialogLine = { date: string; role: "client" | "manager"; name: string; text: string };
type AnalyzedDialog = {
  sessionId: string;
  subject: string;
  leadId: string | null;
  responsibleId: string;
  todayLines: DialogLine[];
  managerText: string;
  clientText: string;
  lastRole: "client" | "manager" | null;
  responseTimes: number[];
  managerMessages: number;
  waitingOnUs: boolean;
  clientSilent: boolean;
  hasPrice: boolean;
  hasClose: boolean;
  hasList: boolean;
  hasPhoto: boolean;
  hasRecommendation: boolean;
  hasRecipient: boolean;
};

const PORTAL = "https://bb-wood.bitrix24.eu";
const SKIP_NAME = /tehniskais|техническ|frigat|robot|бот|\badmin\b|админ/i;
const SERVICE_PHONE_TAILS = ["28373939"];
const MONTHS_RU = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const WEEKDAYS_RU = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function addDaysIso(day: string, delta: number) {
  const [y, m, d] = day.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  utc.setUTCDate(utc.getUTCDate() + delta);
  return utc.toISOString().slice(0, 10);
}

function minutesBetween(a: string | null | undefined, b: string | null | undefined) {
  if (!a || !b) return null;
  const first = Date.parse(a);
  const second = Date.parse(b);
  if (!Number.isFinite(first) || !Number.isFinite(second) || second < first) return null;
  return (second - first) / 60000;
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function pct(part: number, whole: number) {
  if (!whole) return null;
  return Math.round((part / whole) * 1000) / 10;
}

function digits(value: unknown) {
  return String(value || "").replace(/\D/g, "");
}

function normalizePhone(value: unknown) {
  const d = digits(value);
  if (!d) return "";
  return d.length >= 10 ? d.slice(-10) : d;
}

function isServicePhone(phone: string) {
  return SERVICE_PHONE_TAILS.some((tail) => phone === tail || phone.endsWith(tail));
}

function extractPhones(lead: BitrixLead) {
  return [...new Set((lead.PHONE || []).map((item) => normalizePhone(item?.VALUE)).filter((phone) => phone && !isServicePhone(phone)))];
}

function extractEmails(lead: BitrixLead) {
  return [...new Set((lead.EMAIL || []).map((item) => String(item?.VALUE || "").trim().toLowerCase()).filter(Boolean))];
}

function hasUtm(lead: BitrixLead) {
  return Boolean(String(lead.UTM_SOURCE || "").trim() || String(lead.UTM_MEDIUM || "").trim() || String(lead.UTM_CAMPAIGN || "").trim());
}

function cleanText(value: string) {
  return value
    .replace(/\[USER=\d+ REPLACE\]([^\[]+)\[\/USER\]/gi, "$1")
    .replace(/\[\/?b\]/gi, "")
    .replace(/\[URL[^\]]*\]([^\[]*)\[\/URL\]/gi, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function isSystemText(text: string) {
  return /^(Enquiry |A new lead was created|Диалог закреплен|Conversation |Contact information saved|Data received:)/i.test(text)
    || /начал работу с диалогом|завершил работу с диалогом|transferred to/i.test(text);
}

function dayLabelRu(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  const utc = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  const weekday = WEEKDAYS_RU[utc.getUTCDay()] ?? "";
  const month = MONTHS_RU[(m ?? 1) - 1] ?? "";
  return `${d} ${month} ${y}, ${weekday}`;
}

function userName(user: BitrixUser) {
  return `${user.NAME || ""} ${user.LAST_NAME || ""}`.trim() || `ID ${user.ID}`;
}

function firstNameKey(value: string) {
  return normalizePersonName(value).split(" ")[0] || "";
}

function matchScheduleName<T extends { bitrixId?: string; name: string; firstName?: string }>(
  scheduleName: string,
  people: T[],
  preferIds?: Set<string>
) {
  const normalized = normalizePersonName(scheduleName);
  const tokens = normalized.split(" ").filter(Boolean);
  const exact = people.filter((row) => normalizePersonName(row.name) === normalized);
  if (exact.length === 1) return exact[0]!;

  if (tokens.length >= 2) {
    const last = tokens[tokens.length - 1]!;
    const byLast = people.filter((row) => normalizePersonName(row.name).split(" ").includes(last));
    if (byLast.length === 1) return byLast[0]!;
  }

  const first = firstNameKey(scheduleName);
  const byFirst = people.filter((row) => firstNameKey(row.name) === first || firstNameKey(row.firstName || "") === first);
  if (byFirst.length === 1) return byFirst[0]!;
  if (preferIds && byFirst.length > 1) {
    const working = byFirst.filter((row) => row.bitrixId && preferIds.has(row.bitrixId));
    if (working.length === 1) return working[0]!;
  }

  return matchUniqueByName(scheduleName, people);
}

async function fetchHistories(sessionIds: string[]) {
  const map = new Map<string, BitrixSessionHistory | null>();
  for (const chunk of chunkIds(sessionIds, 25)) {
    const cmd: Record<string, string> = {};
    chunk.forEach((id, index) => {
      cmd[`h${index}`] = `imopenlines.session.history.get?SESSION_ID=${encodeURIComponent(id)}`;
    });
    try {
      const result = await bitrixBatch<BitrixSessionHistory>(cmd);
      chunk.forEach((id, index) => map.set(id, result[`h${index}`] ?? null));
    } catch {
      chunk.forEach((id) => map.set(id, null));
    }
    await sleep(250);
  }
  return map;
}

function analyzeDialog(input: {
  sessionId: string;
  subject: string;
  leadId: string | null;
  responsibleId: string;
  history: BitrixSessionHistory | null;
  day: string;
}): AnalyzedDialog | null {
  const messages = Object.values(input.history?.message || {}).sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
  const users = input.history?.users || {};
  const lines: DialogLine[] = [];
  for (const row of messages) {
    const user = users[String(row.senderid || "")] || {};
    const isClient = user.extranet === true || user.extranet === "Y";
    const text = cleanText(String(row.text || row.textlegacy || ""));
    if (isSystemText(text)) continue;
    if (String(row.senderid ?? "0") === "0") continue;
    lines.push({
      date: row.date || "",
      role: isClient ? "client" : "manager",
      name: user.name || (isClient ? "Клиент" : "Менеджер"),
      text: text || "[вложение]"
    });
  }
  if (!lines.length) return null;
  const todayLines = lines.filter((line) => messageDayIso(line.date) === input.day);
  if (!todayLines.length) return null;

  const responseTimes: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.role !== "client" || messageDayIso(line.date) !== input.day) continue;
    const response = lines.slice(i + 1).find((next) => next.role === "manager");
    const minutes = response ? minutesBetween(line.date, response.date) : null;
    if (minutes !== null) responseTimes.push(minutes);
  }

  const managerToday = todayLines.filter((line) => line.role === "manager" && line.text !== "[вложение]");
  const managerText = managerToday.map((line) => line.text).join("\n");
  const clientText = todayLines.filter((line) => line.role === "client").map((line) => line.text).join("\n");
  const last = lines.at(-1) || null;
  const lastRole = last?.role ?? null;

  return {
    sessionId: input.sessionId,
    subject: input.subject,
    leadId: input.leadId,
    responsibleId: input.responsibleId,
    todayLines,
    managerText,
    clientText,
    lastRole,
    responseTimes,
    managerMessages: managerToday.length,
    waitingOnUs: lastRole === "client",
    clientSilent: lastRole === "manager",
    hasPrice: /\d{2,6}\s*(€|eur|евро|руб|₽|byn)|(?:€|eur|евро|руб|₽|byn)\s*\d{2,6}/i.test(managerText),
    hasClose: /оплат|оформ|сч[её]т|ссылк|пришлите|бронь|какой вариант .*оформ/i.test(managerText),
    hasList: /(правд|извести|журнал|газет|крокод|огон)[\s\S]{0,100}(правд|извести|журнал|газет|крокод|огон)/i.test(managerText),
    hasPhoto: /фото|пример|макет|обложк|разворот|видео/i.test(managerText),
    hasRecommendation: /рекоменд|я бы|лучше взять|подойд[её]т|оптимальн|главный вариант/i.test(managerText),
    hasRecipient: /кому|получател|для (мам|пап|муж|жен|дед|бабуш|сын|доч)/i.test(managerText)
  };
}

function cleanLeadTitle(raw: string, fallback: string) {
  const title = raw
    .replace(/^Open Channel chat:\s*/i, "")
    .replace(/["«»]/g, "")
    .replace(/\s*\(.*\)\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
  return title || fallback;
}

function describeLead(dialog: AnalyzedDialog | null, isDupe: boolean, createdToday: boolean): string {
  if (!dialog) {
    if (isDupe) return "Повтор: телефон или email уже были в CRM. Переписки за срез не видно — не начинать как с нового.";
    return createdToday
      ? "Новый лид, переписки за срез не видно. Написать первым: 1 вариант + цена."
      : "Карточка есть, чата за срез нет.";
  }
  const bits: string[] = [];
  if (isDupe) bits.push("повторный контакт");
  if (dialog.waitingOnUs) bits.push("клиент ждёт нашего ответа");
  else if (dialog.clientSilent) bits.push("клиент не ответил");
  if (dialog.hasList && !dialog.hasPrice) bits.push("дал список без цены");
  else if (dialog.hasPrice && !dialog.hasClose) bits.push("назвал цену, не спросил про оформление");
  else if (dialog.hasClose) bits.push("уже звал оформить");
  else if (dialog.hasPrice) bits.push("назвал цену");
  if (/дорого/i.test(dialog.clientText)) bits.push("клиент сказал «дорого»");
  else if (/подума/i.test(dialog.clientText)) bits.push("клиент ушёл думать");
  if (!bits.length) bits.push("был чат, нужен следующий шаг");
  const text = bits.join("; ");
  return text.charAt(0).toUpperCase() + text.slice(1) + ".";
}

function buildLeadList(leads: BitrixLead[], dialogs: AnalyzedDialog[], dupeIds: Set<string>): ShiftLeadItem[] {
  const dialogByLead = new Map<string, AnalyzedDialog>();
  for (const dialog of dialogs) {
    if (!dialog.leadId) continue;
    const prev = dialogByLead.get(dialog.leadId);
    if (!prev || Number(dialog.waitingOnUs) > Number(prev.waitingOnUs) || dialog.managerMessages > prev.managerMessages) {
      dialogByLead.set(dialog.leadId, dialog);
    }
  }
  const leadById = new Map(leads.map((lead) => [String(lead.ID || ""), lead] as const).filter(([id]) => id));
  const ids = [...new Set([...leadById.keys(), ...dialogByLead.keys()])];
  return ids
    .map((id) => {
      const lead = leadById.get(id);
      const dialog = dialogByLead.get(id) ?? null;
      const createdToday = Boolean(lead);
      const isDupe = dupeIds.has(id);
      return {
        id,
        title: cleanLeadTitle(lead?.TITLE || dialog?.subject || "", `Лид ${id}`),
        url: `${PORTAL}/crm/lead/details/${id}/`,
        comment: describeLead(dialog, isDupe, createdToday),
        waiting: Boolean(dialog?.waitingOnUs),
        silent: Boolean(dialog?.clientSilent),
        dupe: isDupe
      };
    })
    .sort((a, b) => Number(b.silent) - Number(a.silent) || Number(b.waiting) - Number(a.waiting) || Number(b.dupe) - Number(a.dupe) || a.title.localeCompare(b.title, "ru"))
    .map((row) => ({ id: row.id, title: row.title, url: row.url, comment: row.comment }));
}

function focusLeads(dialogs: AnalyzedDialog[]): ShiftFocusLead[] {
  return [...dialogs]
    .map((dialog) => {
      let score = 0;
      let note = "Нужен следующий шаг";
      let nextStep = "1 вариант + цена с доставкой → «оформляем этот?»";
      if (dialog.waitingOnUs) {
        score += 3;
        note = "Клиент ждёт нашего ответа";
        nextStep = "Ответить сегодняшним хвостом: цена с доставкой → «оформляем?»";
      } else if (dialog.clientSilent) {
        score += 2;
        note = "Клиент не ответил";
        nextStep = "Короткий пинг: 1 вариант + цена → «оформляем?»";
      }
      if (dialog.hasList && !dialog.hasPrice) {
        score += 2;
        note = "Список без цены";
        nextStep = "1 главный вариант + сумма + срок";
      } else if (dialog.hasPrice && !dialog.hasClose) {
        score += 2;
        note = "Цена есть — нет оформления";
        nextStep = "После цены спросить: «оформляем этот?»";
      }
      if (/дорого/i.test(dialog.clientText)) {
        score += 2;
        note = "Сказал «дорого»";
        nextStep = "Короткий расчёт и более простой вариант";
      } else if (/подума/i.test(dialog.clientText)) {
        score += 2;
        note = "Ушёл думать";
        nextStep = "Расчёт и бронь до вечера";
      }
      const title = cleanLeadTitle(dialog.subject, `Сессия ${dialog.sessionId}`);
      return { dialog, score, note, nextStep, title };
    })
    .filter((row) => row.score > 0 && row.dialog.leadId)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((row) => ({
      id: row.dialog.leadId!,
      title: row.title,
      url: `${PORTAL}/crm/lead/details/${row.dialog.leadId}/`,
      note: row.note,
      nextStep: row.nextStep
    }));
}

function buildPage(input: {
  bitrixUserId: string;
  scheduleName: string;
  name: string;
  onShift: boolean;
  leads: BitrixLead[];
  dupeIds: Set<string>;
  dialogs: AnalyzedDialog[];
}): ShiftManagerPage {
  const dialogs = input.dialogs;
  const responseTimes = dialogs.flatMap((dialog) => dialog.responseTimes);
  const managerMessages = dialogs.reduce((sum, dialog) => sum + dialog.managerMessages, 0);
  const withPrice = dialogs.filter((dialog) => dialog.hasPrice).length;
  const withClose = dialogs.filter((dialog) => dialog.hasClose).length;
  const withList = dialogs.filter((dialog) => dialog.hasList).length;
  const withPhoto = dialogs.filter((dialog) => dialog.hasPhoto).length;
  const withRecommendation = dialogs.filter((dialog) => dialog.hasRecommendation).length;
  const withRecipient = dialogs.filter((dialog) => dialog.hasRecipient).length;
  const waitingOnUs = dialogs.filter((dialog) => dialog.waitingOnUs).length;
  const clientSilent = dialogs.filter((dialog) => dialog.clientSilent).length;
  const shareUnder5 = pct(responseTimes.filter((value) => value <= 5).length, responseTimes.length);
  const shareOver60 = pct(responseTimes.filter((value) => value >= 60).length, responseTimes.length);
  const firstName = firstNameFrom(input.name);
  const leadsCreated = input.leads.length;
  const leadDupes = input.leads.filter((lead) => input.dupeIds.has(String(lead.ID || ""))).length;
  const leadUnique = leadsCreated - leadDupes;
  const withUtm = input.leads.filter(hasUtm).length;

  const good: string[] = [];
  if (shareUnder5 !== null && shareUnder5 >= 45) {
    good.push(`Быстрые ответы: ${Math.round(shareUnder5)}% ушли клиенту за 5 минут.`);
  }
  if (dialogs.length && withPrice >= Math.ceil(dialogs.length * 0.4)) {
    good.push(`Цена названа в ${withPrice} из ${dialogs.length} чатов — так проще решить.`);
  }
  if (withPhoto > 0) good.push(`Фото или пример — в ${withPhoto} чатах.`);
  if (withClose > 0) good.push(`Призыв оформить заказ — в ${withClose} чатах.`);
  if (withRecommendation > 0) good.push(`Рекомендация, а не только список — в ${withRecommendation} чатах.`);
  if (withRecipient > 0) good.push(`Вопрос «кому подарок» — в ${withRecipient} чатах.`);
  if (!good.length && (leadsCreated > 0 || dialogs.length > 0)) {
    good.push("Берёт лиды и отвечает людям.");
  }

  const better: string[] = [];
  if (withList >= Math.max(2, Math.ceil(dialogs.length * 0.35)) && withRecommendation < Math.max(1, Math.ceil(dialogs.length * 0.15))) {
    better.push(`${withList} чатов со списком газет и ${withRecommendation} рекомендаций. Замена: 1 главный вариант + 1 запасной.`);
  }
  if (dialogs.length && withPrice / dialogs.length < 0.45) {
    better.push(`Цену пишет редко (${withPrice} из ${dialogs.length}). Без цифры люди зависают.`);
  }
  if (dialogs.length && withClose / dialogs.length < 0.2) {
    better.push(`Мало закрытий на оформление (${withClose} из ${dialogs.length}). После цены: «оформляем этот?»`);
  }
  if (clientSilent > 0) {
    better.push(`${clientSilent} чатов, где клиент не ответил после нас. Завтра короткий пинг: цена + «оформляем?»`);
  }
  if (waitingOnUs > 0) {
    better.push(`${waitingOnUs} чатов ждут нашего ответа — клиент написал, мы ещё не закрыли.`);
  }
  if (shareOver60 !== null && shareOver60 >= 30) {
    better.push(`${Math.round(shareOver60)}% ответов ушли позже часа. Держать живой чат в первые 5 минут.`);
  }
  if (!better.length && dialogs.length) {
    better.push("Держать темп: 1 вариант + цена + доставка + «какой оформляем?» в каждом живом чате.");
  }
  if (!leadsCreated && !dialogs.length) {
    better.push("По графику на смене, но за этот срез нет новых лидов и переписки. Проверить, доходят ли назначения.");
  }

  let headline = `${firstName}: ${leadsCreated} новых лидов, ${dialogs.length} чатов.`;
  if (!leadsCreated && !dialogs.length) {
    headline = `${firstName}: на смене по графику, за срез работы в CRM не видно.`;
  } else if (dialogs.length && withClose / dialogs.length >= 0.25 && withPrice / dialogs.length >= 0.5) {
    headline = `${firstName}: ведёт к цене и оформлению, не только консультирует.`;
  } else if (withList >= withPrice && withList >= 2) {
    headline = `${firstName}: быстро берёт поток, но чаще работает как справочная архива.`;
  } else if (shareOver60 !== null && shareOver60 >= 40) {
    headline = leadsCreated
      ? `${firstName}: лиды есть, ответы сильно запаздывают.`
      : `${firstName}: в чатах отвечает с большой паузой.`;
  } else if (clientSilent >= 3) {
    headline = `${firstName}: много чатов, где клиент не ответил — ${clientSilent} ждут пинга.`;
  } else if (waitingOnUs >= 3) {
    headline = `${firstName}: ${waitingOnUs} чатов ждут нашего ответа.`;
  }

  return {
    bitrixUserId: input.bitrixUserId,
    scheduleName: input.scheduleName,
    name: input.name,
    firstName,
    onShift: input.onShift,
    leadsCreated,
    leadDupes,
    leadUnique,
    withUtm,
    withoutUtm: leadsCreated - withUtm,
    dialogs: dialogs.length,
    managerMessages,
    avgManagerMessages: dialogs.length ? Math.round((managerMessages / dialogs.length) * 10) / 10 : null,
    medianReplyMin: median(responseTimes),
    shareUnder5,
    shareOver60,
    waitingOnUs,
    clientSilent,
    withPrice,
    withClose,
    withList,
    withPhoto,
    withRecommendation,
    withRecipient,
    headline,
    good: good.slice(0, 3),
    better: better.slice(0, 3),
    focusLeads: focusLeads(dialogs),
    leads: buildLeadList(input.leads, dialogs, input.dupeIds)
  };
}

export async function buildShiftFeedbackReport(day = moscowDateIso()): Promise<ShiftFeedbackReport> {
  const liveCut = isShiftLiveCut(day);
  const cutLabel = liveCut
    ? `Живой срез на ${moscowHm()} по Москве, смена ещё идёт до 20:00`
    : `Вечерний срез после 20:00 по Москве, ${moscowHm()}`;

  let onShiftNames: string[] = [];
  let shiftHours = "8:00–20:00";
  try {
    const schedule = await loadManagerSchedule(day.slice(0, 7));
    const index = schedule.selected.days.findIndex((row) => row.date === day);
    if (index >= 0) {
      onShiftNames = schedule.selected.managers.filter((row) => row.shifts[index]).map((row) => row.name);
    }
    if (schedule.selected.shiftHours) shiftHours = schedule.selected.shiftHours;
  } catch {
    onShiftNames = [];
  }

  const lookback = addDaysIso(day, -1);
  const historyFrom = `${day.slice(0, 4)}-05-01`;

  const [users, leads, activities] = await Promise.all([
    bitrixListAll<BitrixUser>("user.get", {
      sort: "ID",
      order: "ASC",
      FILTER: { ACTIVE: true },
      SELECT: ["ID", "NAME", "LAST_NAME", "ACTIVE"]
    }, 50),
    bitrixListAll<BitrixLead>("crm.lead.list", {
      order: { DATE_CREATE: "ASC" },
      filter: {
        ">=DATE_CREATE": `${historyFrom}T00:00:00+03:00`,
        "<=DATE_CREATE": `${day}T23:59:59+03:00`
      },
      select: ["ID", "DATE_CREATE", "TITLE", "ASSIGNED_BY_ID", "PHONE", "EMAIL", "UTM_SOURCE", "UTM_MEDIUM", "UTM_CAMPAIGN"]
    }),
    bitrixListAll<BitrixActivity>("crm.activity.list", {
      filter: {
        ">=CREATED": `${lookback}T00:00:00+03:00`,
        "<=CREATED": `${day}T23:59:59+03:00`,
        TYPE_ID: "6",
        PROVIDER_ID: "IMOPENLINES_SESSION"
      },
      select: ["ID", "CREATED", "OWNER_ID", "OWNER_TYPE_ID", "ASSOCIATED_ENTITY_ID", "SUBJECT", "RESPONSIBLE_ID", "LAST_UPDATED"],
      order: { CREATED: "DESC" }
    }, 50)
  ]);

  const people = users
    .map((user) => ({
      bitrixId: String(user.ID || ""),
      name: userName(user),
      firstName: firstNameFrom(userName(user))
    }))
    .filter((row) => row.bitrixId && !SKIP_NAME.test(row.name));

  const todayLeads = leads.filter((lead) => String(lead.DATE_CREATE || "").startsWith(day));
  const before = leads.filter((lead) => !String(lead.DATE_CREATE || "").startsWith(day));
  const phoneHist = new Map<string, true>();
  const emailHist = new Map<string, true>();
  for (const lead of before) {
    for (const phone of extractPhones(lead)) phoneHist.set(phone, true);
    for (const email of extractEmails(lead)) emailHist.set(email, true);
  }
  const phoneDay = new Map<string, true>();
  const emailDay = new Map<string, true>();
  const dupeIds = new Set<string>();
  for (const lead of todayLeads) {
    const id = String(lead.ID || "");
    for (const phone of extractPhones(lead)) {
      if (phoneHist.has(phone) || phoneDay.has(phone)) dupeIds.add(id);
      else phoneDay.set(phone, true);
    }
    for (const email of extractEmails(lead)) {
      if (emailHist.has(email) || emailDay.has(email)) dupeIds.add(id);
      else emailDay.set(email, true);
    }
  }

  const bySession = new Map<string, BitrixActivity>();
  for (const activity of activities) {
    const sessionId = String(activity.ASSOCIATED_ENTITY_ID || "").trim();
    if (!sessionId) continue;
    const created = messageDayIso(activity.CREATED);
    const updated = messageDayIso(activity.LAST_UPDATED);
    if (created !== day && updated !== day && created !== lookback) continue;
    const prev = bySession.get(sessionId);
    if (!prev || String(activity.LAST_UPDATED || activity.CREATED || "") > String(prev.LAST_UPDATED || prev.CREATED || "")) {
      bySession.set(sessionId, activity);
    }
  }

  const histories = await fetchHistories([...bySession.keys()]);
  const dialogs: AnalyzedDialog[] = [];
  for (const [sessionId, activity] of bySession) {
    const responsibleId = String(activity.RESPONSIBLE_ID || "").trim();
    if (!responsibleId) continue;
    const dialog = analyzeDialog({
      sessionId,
      subject: activity.SUBJECT || "",
      leadId: activity.OWNER_TYPE_ID === "1" ? String(activity.OWNER_ID || "") : null,
      responsibleId,
      history: histories.get(sessionId) || null,
      day
    });
    if (dialog) dialogs.push(dialog);
  }

  const extraIds = [
    ...todayLeads.map((lead) => String(lead.ASSIGNED_BY_ID || "")),
    ...dialogs.map((dialog) => dialog.responsibleId)
  ].filter((id) => id && !people.some((row) => row.bitrixId === id));
  const extraNames = extraIds.length ? await loadUserNames(extraIds) : new Map<string, string>();
  for (const [id, name] of extraNames) {
    if (SKIP_NAME.test(name)) continue;
    people.push({ bitrixId: id, name, firstName: firstNameFrom(name) });
  }

  const workedIds = new Set([
    ...todayLeads.map((lead) => String(lead.ASSIGNED_BY_ID || "")),
    ...dialogs.map((dialog) => dialog.responsibleId)
  ].filter(Boolean));

  const usedIds = new Set<string>();
  const unmatchedSchedule: string[] = [];
  const managers: ShiftManagerPage[] = [];

  const sourceNames = onShiftNames.length ? onShiftNames : [];
  for (const scheduleName of sourceNames) {
    const match = matchScheduleName(scheduleName, people, workedIds);
    if (!match) {
      unmatchedSchedule.push(scheduleName);
      continue;
    }
    usedIds.add(match.bitrixId);
    const assigned = todayLeads.filter((lead) => String(lead.ASSIGNED_BY_ID || "") === match.bitrixId);
    managers.push(buildPage({
      bitrixUserId: match.bitrixId,
      scheduleName,
      name: match.name,
      onShift: true,
      leads: assigned,
      dupeIds,
      dialogs: dialogs.filter((dialog) => dialog.responsibleId === match.bitrixId)
    }));
  }

  if (!onShiftNames.length) {
    const activeToday = [...new Set([
      ...todayLeads.map((lead) => String(lead.ASSIGNED_BY_ID || "")),
      ...dialogs.map((dialog) => dialog.responsibleId)
    ])].filter(Boolean);
    for (const id of activeToday) {
      const person = people.find((row) => row.bitrixId === id);
      if (!person || SKIP_NAME.test(person.name)) continue;
      usedIds.add(id);
      const assigned = todayLeads.filter((lead) => String(lead.ASSIGNED_BY_ID || "") === id);
      managers.push(buildPage({
        bitrixUserId: id,
        scheduleName: person.name,
        name: person.name,
        onShift: true,
        leads: assigned,
        dupeIds,
        dialogs: dialogs.filter((dialog) => dialog.responsibleId === id)
      }));
    }
  }

  const offShift: ShiftManagerPage[] = [];
  const leftoverIds = [...new Set([
    ...todayLeads.map((lead) => String(lead.ASSIGNED_BY_ID || "")),
    ...dialogs.map((dialog) => dialog.responsibleId)
  ])].filter((id) => id && !usedIds.has(id));
  for (const id of leftoverIds) {
    const person = people.find((row) => row.bitrixId === id);
    const name = person?.name || extraNames.get(id) || `ID ${id}`;
    if (SKIP_NAME.test(name)) continue;
    const assigned = todayLeads.filter((lead) => String(lead.ASSIGNED_BY_ID || "") === id);
    const ownDialogs = dialogs.filter((dialog) => dialog.responsibleId === id);
    if (!assigned.length && !ownDialogs.length) continue;
    offShift.push(buildPage({
      bitrixUserId: id,
      scheduleName: name,
      name,
      onShift: false,
      leads: assigned,
      dupeIds,
      dialogs: ownDialogs
    }));
  }

  managers.sort((a, b) => b.leadsCreated - a.leadsCreated || b.dialogs - a.dialogs || a.name.localeCompare(b.name, "ru"));
  offShift.sort((a, b) => b.leadsCreated - a.leadsCreated || a.name.localeCompare(b.name, "ru"));

  const teamCreated = managers.reduce((sum, row) => sum + row.leadsCreated, 0);
  const teamDupes = managers.reduce((sum, row) => sum + row.leadDupes, 0);

  return {
    day,
    dayLabel: dayLabelRu(day),
    generatedAt: new Date().toISOString(),
    cutLabel,
    liveCut,
    timezone: "Europe/Moscow",
    shiftHours,
    onShiftNames,
    unmatchedSchedule,
    team: {
      created: teamCreated,
      dupes: teamDupes,
      unique: teamCreated - teamDupes,
      withUtm: managers.reduce((sum, row) => sum + row.withUtm, 0),
      withoutUtm: managers.reduce((sum, row) => sum + row.withoutUtm, 0),
      dialogs: managers.reduce((sum, row) => sum + row.dialogs, 0),
      waitingOnUs: managers.reduce((sum, row) => sum + row.waitingOnUs, 0),
      clientSilent: managers.reduce((sum, row) => sum + row.clientSilent, 0)
    },
    managers,
    offShift
  };
}

export function placeShiftPages(onShiftNames: string[], pages: ShiftManagerPage[]) {
  const preferIds = new Set(pages.filter((page) => page.leadsCreated > 0 || page.dialogs > 0).map((page) => page.bitrixUserId));
  const remaining = [...pages];
  const managers: ShiftManagerPage[] = [];
  const unmatchedSchedule: string[] = [];

  for (const scheduleName of onShiftNames) {
    const people = remaining.map((page) => ({
      bitrixId: page.bitrixUserId,
      name: page.name,
      firstName: page.firstName
    }));
    const match = matchScheduleName(scheduleName, people, preferIds);
    if (!match?.bitrixId) {
      unmatchedSchedule.push(scheduleName);
      continue;
    }
    const index = remaining.findIndex((page) => page.bitrixUserId === match.bitrixId);
    if (index < 0) {
      unmatchedSchedule.push(scheduleName);
      continue;
    }
    const [page] = remaining.splice(index, 1);
    if (!page) continue;
    managers.push({ ...page, onShift: true, scheduleName });
  }

  const offShift = remaining.map((page) => ({ ...page, onShift: false }));
  managers.sort((a, b) => b.leadsCreated - a.leadsCreated || b.dialogs - a.dialogs || a.name.localeCompare(b.name, "ru"));
  offShift.sort((a, b) => b.leadsCreated - a.leadsCreated || a.name.localeCompare(b.name, "ru"));
  return { managers, offShift, unmatchedSchedule };
}
