import { bitrixBatch, bitrixListAll, chunkIds } from "@/lib/bitrix/rest-client";
import { loadUserNames } from "@/lib/bitrix/sales-foundation/customer-key";
import { firstNameFrom, messageDayIso, rigaDateIso } from "@/lib/manager-cabinet/dates";
import type {
  ManagerChatFeedback,
  ManagerChatFocusLead,
  RopChatFeedbackReport
} from "@/lib/rop-chat-feedback/types";

type BitrixActivity = {
  ID: string;
  CREATED?: string;
  OWNER_ID?: string;
  OWNER_TYPE_ID?: string;
  ASSOCIATED_ENTITY_ID?: string;
  SUBJECT?: string;
  RESPONSIBLE_ID?: string;
  LAST_UPDATED?: string;
};

type BitrixHistoryUser = {
  id: string;
  name?: string;
  extranet?: boolean | string;
};

type BitrixHistoryMessage = {
  id: string;
  date?: string;
  senderid?: string;
  text?: string;
  textlegacy?: string;
};

type BitrixSessionHistory = {
  sessionId?: number;
  message?: Record<string, BitrixHistoryMessage>;
  users?: Record<string, BitrixHistoryUser>;
};

type DialogLine = {
  date: string;
  role: "client" | "manager";
  name: string;
  text: string;
};

type ManagerDialog = {
  sessionId: string;
  subject: string;
  leadId: string | null;
  lines: DialogLine[];
  todayLines: DialogLine[];
  managerText: string;
  clientText: string;
  lastRole: "client" | "manager" | null;
  firstResponseMinutes: number | null;
  hasPrice: boolean;
  hasClose: boolean;
  hasList: boolean;
  hasPhoto: boolean;
  hasRecommendation: boolean;
  waitingOnUs: boolean;
  slowFirst: boolean;
};

const PORTAL = "https://bb-wood.bitrix24.eu";
const SKIP_NAME = /tehniskais|техническ|frigat|robot|бот|\badmin\b|админ/i;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanText(value: string) {
  return value
    .replace(/\[USER=\d+ REPLACE\]([^\[]+)\[\/USER\]/gi, "$1")
    .replace(/\[\/?b\]/gi, "")
    .replace(/\[URL[^\]]*\]([^\[]*)\[\/URL\]/gi, "$1")
    .replace(/\s+/g, " ")
    .trim();
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

function pct(part: number, whole: number) {
  if (!whole) return 0;
  return Math.round((part / whole) * 100);
}

async function listOpenlineActivities(day: string): Promise<BitrixActivity[]> {
  const lookback = addDaysIso(day, -1);
  const rows = await bitrixListAll<BitrixActivity>(
    "crm.activity.list",
    {
      filter: {
        ">=CREATED": `${lookback}T00:00:00+03:00`,
        "<=CREATED": `${day}T23:59:59+03:00`,
        TYPE_ID: "6",
        PROVIDER_ID: "IMOPENLINES_SESSION"
      },
      select: [
        "ID",
        "CREATED",
        "OWNER_ID",
        "OWNER_TYPE_ID",
        "ASSOCIATED_ENTITY_ID",
        "SUBJECT",
        "RESPONSIBLE_ID",
        "LAST_UPDATED"
      ],
      order: { CREATED: "DESC" }
    },
    50
  );

  return rows.filter((row) => {
    const created = messageDayIso(row.CREATED);
    const updated = messageDayIso(row.LAST_UPDATED);
    return created === day || updated === day || created === lookback;
  });
}

async function fetchHistories(sessionIds: string[]): Promise<Map<string, BitrixSessionHistory | null>> {
  const map = new Map<string, BitrixSessionHistory | null>();
  for (const chunk of chunkIds(sessionIds, 25)) {
    const cmd: Record<string, string> = {};
    chunk.forEach((id, index) => {
      cmd[`h${index}`] = `imopenlines.session.history.get?SESSION_ID=${encodeURIComponent(id)}`;
    });
    try {
      const result = await bitrixBatch<BitrixSessionHistory>(cmd);
      chunk.forEach((id, index) => {
        map.set(id, result[`h${index}`] ?? null);
      });
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
  history: BitrixSessionHistory | null;
  day: string;
}): ManagerDialog | null {
  const messages = Object.values(input.history?.message || {}).sort((a, b) =>
    String(a.date || "").localeCompare(String(b.date || ""))
  );
  const users = input.history?.users || {};
  const lines: DialogLine[] = messages
    .map((row) => {
      const user = users[String(row.senderid || "")] || {};
      const isClient = user.extranet === true || user.extranet === "Y";
      const text = cleanText(String(row.text || row.textlegacy || ""));
      if (!text) return null;
      if (
        /^Conversation #|^Contact information saved|^Data received:|^Диалог закреплен|^.*начал работу с диалогом/i.test(
          text
        )
      ) {
        return null;
      }
      return {
        date: row.date || "",
        role: (isClient ? "client" : "manager") as "client" | "manager",
        name: user.name || (isClient ? "Клиент" : "Менеджер"),
        text
      };
    })
    .filter((row): row is DialogLine => Boolean(row));

  if (!lines.length) return null;

  const todayLines = lines.filter((line) => messageDayIso(line.date) === input.day);
  if (!todayLines.length) return null;

  const client = lines.filter((line) => line.role === "client");
  const manager = lines.filter((line) => line.role === "manager");
  const firstClient = client[0];
  const firstManager = firstClient
    ? lines.slice(lines.indexOf(firstClient) + 1).find((line) => line.role === "manager")
    : manager[0];
  const firstResponseMinutes = minutesBetween(firstClient?.date, firstManager?.date);
  const managerText = manager.map((line) => line.text).join("\n");
  const clientText = client.map((line) => line.text).join("\n");
  const last = lines.at(-1) || null;

  return {
    sessionId: input.sessionId,
    subject: input.subject,
    leadId: input.leadId,
    lines,
    todayLines,
    managerText,
    clientText,
    lastRole: last?.role ?? null,
    firstResponseMinutes,
    hasPrice: /\d{2,6}\s*(€|eur|евро|руб|₽|byn)|(?:€|eur|евро|руб|₽|byn)\s*\d{2,6}/i.test(managerText),
    hasClose: /оплат|оформ|сч[её]т|ссылк|пришлите|бронь|какой вариант .*оформ/i.test(managerText),
    hasList:
      /(правд|извести|журнал|газет|крокод|огон)[\s\S]{0,100}(правд|извести|журнал|газет|крокод|огон)/i.test(
        managerText
      ),
    hasPhoto: /фото|пример|макет|обложк|разворот|видео/i.test(managerText),
    hasRecommendation: /рекоменд|я бы|лучше взять|подойд[её]т|оптимальн|главный вариант/i.test(managerText),
    waitingOnUs: last?.role === "client",
    slowFirst: firstResponseMinutes !== null && firstResponseMinutes > 60
  };
}

function buildFocusLeads(dialogs: ManagerDialog[]): ManagerChatFocusLead[] {
  const ranked = [...dialogs]
    .map((dialog) => {
      let score = 0;
      if (dialog.waitingOnUs) score += 3;
      if (dialog.hasList && !dialog.hasPrice) score += 2;
      if (dialog.hasPrice && !dialog.hasClose) score += 2;
      if (dialog.slowFirst) score += 1;
      if (/дорого|подума|не надо|не будем|отказ/i.test(dialog.clientText)) score += 2;
      return { dialog, score };
    })
    .filter((row) => row.score > 0 && row.dialog.leadId)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  return ranked.map(({ dialog }) => {
    let note = "Нужен следующий шаг";
    if (dialog.waitingOnUs) note = "Клиент ждёт ответа";
    else if (dialog.hasList && !dialog.hasPrice) note = "Список без цены";
    else if (dialog.hasPrice && !dialog.hasClose) note = "Цена есть — нет оформления";
    else if (/дорого/i.test(dialog.clientText)) note = "Сказал «дорого»";
    else if (/подума/i.test(dialog.clientText)) note = "Ушёл думать";

    const title =
      dialog.subject.replace(/^Open Channel chat:\s*/i, "").replace(/\s*\(.*\)\s*$/, "").trim() ||
      `Сессия ${dialog.sessionId}`;

    return {
      id: dialog.leadId!,
      title,
      url: `${PORTAL}/crm/lead/details/${dialog.leadId}/`,
      note
    };
  });
}

function buildManagerFeedback(input: {
  bitrixUserId: string;
  name: string;
  dialogs: ManagerDialog[];
}): ManagerChatFeedback {
  const dialogs = input.dialogs;
  const withPrice = dialogs.filter((d) => d.hasPrice).length;
  const withClose = dialogs.filter((d) => d.hasClose).length;
  const withList = dialogs.filter((d) => d.hasList).length;
  const withPhoto = dialogs.filter((d) => d.hasPhoto).length;
  const withRecommendation = dialogs.filter((d) => d.hasRecommendation).length;
  const waitingOnUs = dialogs.filter((d) => d.waitingOnUs).length;
  const slowFirst = dialogs.filter((d) => d.slowFirst).length;
  const messages = dialogs.reduce((sum, d) => sum + d.todayLines.length, 0);
  const firstName = firstNameFrom(input.name);

  const good: string[] = [];
  const better: string[] = [];

  if (withPrice >= Math.ceil(dialogs.length * 0.4)) {
    good.push(`В ${withPrice} из ${dialogs.length} чатов назвал цену — так клиенту проще решить.`);
  }
  if (withPhoto > 0) {
    good.push(`Показывал примеры/фото в ${withPhoto} чатах — это помогает.`);
  }
  if (withClose > 0) {
    good.push(`В ${withClose} чатах уже звал оформить заказ — так и надо.`);
  }
  if (!good.length && dialogs.length) {
    good.push("Берёт диалоги и отвечает людям.");
  }

  if (withList >= Math.ceil(dialogs.length * 0.35) && withRecommendation < Math.max(1, Math.ceil(dialogs.length * 0.15))) {
    better.push("Часто шлёт длинный список газет/журналов. Лучше: 1 главный вариант + 1 запасной.");
  }
  if (pct(withPrice, dialogs.length) < 45) {
    better.push(`Цену говорит редко (${withPrice}/${dialogs.length}). Без цифры люди зависают.`);
  }
  if (pct(withClose, dialogs.length) < 20) {
    better.push(
      `Мало закрытий на оформление (${withClose}/${dialogs.length}). После цены спроси: «Какой вариант оформляем?»`
    );
  }
  if (waitingOnUs > 0) {
    better.push(`Сейчас ${waitingOnUs} чатов ждут ответа — клиент написал последним.`);
  }
  if (slowFirst >= 2) {
    better.push(`В ${slowFirst} чатах первый ответ был дольше часа.`);
  }
  if (/броха|попустись|скрипт/i.test(dialogs.map((d) => d.managerText).join("\n"))) {
    better.push("В одном чате сорвался тон («броха/попустись»). С клиентом так нельзя.");
  }
  if (!better.length) {
    better.push("Держать темп: цена + один совет + вопрос «оформляем?» в каждом живом чате.");
  }

  let headline = `${firstName}: ${dialogs.length} ${dialogs.length === 1 ? "чат" : dialogs.length < 5 ? "чата" : "чатов"} за день.`;
  if (pct(withClose, dialogs.length) >= 25 && pct(withPrice, dialogs.length) >= 50) {
    headline = `${firstName}: нормально двигает к цене и оформлению (${dialogs.length} ${dialogs.length === 1 ? "чат" : "чатов"}).`;
  } else if (withList >= withPrice && withList >= 2) {
    headline = `${firstName}: больше работает как справочная архива, чем как продавец (${dialogs.length} ${dialogs.length === 1 ? "чат" : "чатов"}).`;
  } else if (waitingOnUs >= 3) {
    headline = `${firstName}: много открытых хвостов — ${waitingOnUs} ${waitingOnUs === 1 ? "чат ждёт" : "чатов ждут"} ответа.`;
  }

  const tryToday =
    waitingOnUs > 0
      ? `Сначала закрыть ${Math.min(waitingOnUs, 5)} чатов, где клиент ждёт. В каждом: цена с доставкой → «оформляем этот?»`
      : "В каждом новом чате сегодня: 1 вариант + цена + доставка + «какой оформляем?»";

  return {
    bitrixUserId: input.bitrixUserId,
    name: input.name,
    firstName,
    dialogs: dialogs.length,
    messages,
    stats: {
      withPrice,
      withClose,
      withList,
      withPhoto,
      withRecommendation,
      waitingOnUs,
      slowFirst
    },
    headline,
    good: good.slice(0, 3),
    better: better.slice(0, 5),
    tryToday,
    focusLeads: buildFocusLeads(dialogs)
  };
}

export async function buildRopChatFeedbackReport(day = rigaDateIso()): Promise<RopChatFeedbackReport> {
  const activities = await listOpenlineActivities(day);
  const bySession = new Map<string, BitrixActivity>();
  for (const activity of activities) {
    const sessionId = String(activity.ASSOCIATED_ENTITY_ID || "").trim();
    if (!sessionId) continue;
    const prev = bySession.get(sessionId);
    if (!prev) {
      bySession.set(sessionId, activity);
      continue;
    }
    const prevUpdated = prev.LAST_UPDATED || prev.CREATED || "";
    const nextUpdated = activity.LAST_UPDATED || activity.CREATED || "";
    if (nextUpdated > prevUpdated) bySession.set(sessionId, activity);
  }

  const sessionIds = [...bySession.keys()];
  const histories = await fetchHistories(sessionIds);
  const responsibleIds = [...bySession.values()].map((row) => String(row.RESPONSIBLE_ID || "")).filter(Boolean);
  const names = await loadUserNames(responsibleIds);
  const byManager = new Map<string, { name: string; dialogs: ManagerDialog[] }>();

  for (const [sessionId, activity] of bySession) {
    const responsibleId = String(activity.RESPONSIBLE_ID || "").trim();
    if (!responsibleId) continue;
    const name = names.get(responsibleId) || `ID ${responsibleId}`;
    if (SKIP_NAME.test(name)) continue;

    const dialog = analyzeDialog({
      sessionId,
      subject: activity.SUBJECT || "",
      leadId: activity.OWNER_TYPE_ID === "1" ? String(activity.OWNER_ID || "") : null,
      history: histories.get(sessionId) || null,
      day
    });
    if (!dialog) continue;

    const bucket = byManager.get(responsibleId) || { name, dialogs: [] };
    bucket.name = name;
    bucket.dialogs.push(dialog);
    byManager.set(responsibleId, bucket);
  }

  const managers = [...byManager.entries()]
    .map(([bitrixUserId, row]) =>
      buildManagerFeedback({
        bitrixUserId,
        name: row.name,
        dialogs: row.dialogs
      })
    )
    .filter((row) => row.dialogs > 0)
    .sort((a, b) => b.dialogs - a.dialogs || a.name.localeCompare(b.name, "ru"));

  const teamWaiting = managers.reduce((sum, row) => sum + row.stats.waitingOnUs, 0);
  const teamDialogs = managers.reduce((sum, row) => sum + row.dialogs, 0);
  const teamHeadline = managers.length
    ? `За ${day}: ${managers.length} менеджеров, ${teamDialogs} чатов с активностью. Ждут ответа: ${teamWaiting}.`
    : `За ${day} живых чатов менеджеров не нашли.`;

  return {
    day,
    generatedAt: new Date().toISOString(),
    source: "bitrix-openlines",
    managers,
    teamHeadline
  };
}
