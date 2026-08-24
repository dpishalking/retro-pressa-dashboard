import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { currentPeriodKey } from "@/lib/conversation-periods";
import { readLivePeriodStore } from "@/lib/conversation-live-store";
import { callGeminiGenerateContent, extractGeminiText, getGeminiModel } from "@/lib/gemini/client";
import { firstNameFrom, messageDayIso, rigaYesterdayIso } from "@/lib/manager-cabinet/dates";
import { namesMatch } from "@/lib/manager-cabinet/match";
import type { YesterdayCoachReview } from "@/lib/manager-cabinet/types";
import type { ConversationMessage, PeriodKey } from "@/types/metrics";

const cacheDir = path.join(process.cwd(), ".cache", "manager-coach");
const maxDialogs = 6;
const maxMessagesPerDialog = 40;

type DialogPack = {
  dialogId: string;
  lastAt: string;
  transcript: string;
};

function periodKeyForDay(day: string): PeriodKey {
  if (day.startsWith("2026-05")) return "may-2026";
  if (day.startsWith("2026-06")) return "june-2026";
  if (day.startsWith("2026-07")) return "july-2026";
  return "august-2026";
}

function emptyReview(day: string, emptyHint: string): YesterdayCoachReview {
  return {
    day,
    dialogs: 0,
    headline: null,
    good: [],
    better: [],
    tryToday: null,
    emptyHint
  };
}

function belongsToManager(message: ConversationMessage, managerName: string): boolean {
  if (message.manager && namesMatch(managerName, message.manager)) return true;
  if (message.senderRole === "manager" && namesMatch(managerName, message.sender)) return true;
  return false;
}

function compactTranscript(messages: ConversationMessage[]): string {
  return messages
    .slice(-maxMessagesPerDialog)
    .map((message) => {
      const who =
        message.senderRole === "manager" ? "Ты" : message.senderRole === "client" ? "Клиент" : message.sender || "Система";
      return `${who}: ${message.text}`.trim();
    })
    .join("\n")
    .slice(0, 2500);
}

export function packYesterdayDialogs(
  messages: ConversationMessage[],
  managerName: string,
  day: string
): DialogPack[] {
  const grouped = new Map<string, ConversationMessage[]>();
  for (const message of messages) {
    grouped.set(message.dialogId, [...(grouped.get(message.dialogId) ?? []), message]);
  }

  const packs: DialogPack[] = [];
  for (const [dialogId, rows] of grouped) {
    const sorted = [...rows].sort((a, b) => String(a.date ?? "").localeCompare(String(b.date ?? "")));
    const mine = sorted.some((row) => belongsToManager(row, managerName));
    if (!mine) continue;
    const touchedYesterday = sorted.some((row) => messageDayIso(row.date) === day);
    if (!touchedYesterday) continue;
    packs.push({
      dialogId,
      lastAt: sorted[sorted.length - 1]?.date || "",
      transcript: compactTranscript(sorted)
    });
  }

  return packs.sort((a, b) => b.lastAt.localeCompare(a.lastAt)).slice(0, maxDialogs);
}

function cachePath(bitrixUserId: string, day: string) {
  return path.join(cacheDir, `${bitrixUserId}-${day}.json`);
}

async function readCache(bitrixUserId: string, day: string): Promise<YesterdayCoachReview | null> {
  try {
    const parsed = JSON.parse(await readFile(cachePath(bitrixUserId, day), "utf8")) as YesterdayCoachReview;
    if (parsed?.day === day && Array.isArray(parsed.good)) return parsed;
  } catch {
    /* miss */
  }
  return null;
}

async function writeCache(bitrixUserId: string, day: string, review: YesterdayCoachReview) {
  await mkdir(cacheDir, { recursive: true });
  await writeFile(cachePath(bitrixUserId, day), JSON.stringify(review, null, 2));
}

function clip(value: unknown, max: number): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function normalizeReview(raw: unknown, day: string, dialogs: number): YesterdayCoachReview | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const good = Array.isArray(row.good) ? row.good.map((item) => clip(item, 180)).filter(Boolean).slice(0, 3) : [];
  const better = Array.isArray(row.better) ? row.better.map((item) => clip(item, 180)).filter(Boolean).slice(0, 3) : [];
  return {
    day,
    dialogs,
    headline: clip(row.headline, 160) || null,
    good,
    better,
    tryToday: clip(row.tryToday, 220) || null,
    emptyHint: null
  };
}

async function askGemini(packs: DialogPack[], firstName: string): Promise<unknown> {
  const payload = await callGeminiGenerateContent({
    systemInstruction: {
      parts: [
        {
          text: [
            "Ты добрый старший коллега в магазине подарков Retro Pressa.",
            "Объясняешь как Гомеру Симпсону: короткие фразы, простые слова, без терминов.",
            "Не говори: квалификация, конверсия, CR, AOV, KPI, воронка, сквозная.",
            "Не ругай. Не выдумывай того, чего нет в переписке.",
            "Пиши на «ты». Имя менеджера можно назвать."
          ].join(" ")
        }
      ]
    },
    contents: [
      {
        role: "user",
        parts: [
          {
            text: JSON.stringify({
              manager: firstName,
              task: "Разбери вчерашние чаты. Что получилось, где можно было ответить точнее, что сказать сегодня.",
              dialogs: packs.map((pack) => ({ id: pack.dialogId, text: pack.transcript }))
            })
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.3,
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          headline: { type: "string" },
          good: { type: "array", items: { type: "string" } },
          better: { type: "array", items: { type: "string" } },
          tryToday: { type: "string" }
        },
        required: ["headline", "good", "better", "tryToday"]
      }
    }
  }, getGeminiModel());

  const text = extractGeminiText(payload);
  return JSON.parse(text) as unknown;
}

export async function loadYesterdayCoach(input: {
  bitrixUserId: string;
  managerName: string;
}): Promise<YesterdayCoachReview> {
  const day = rigaYesterdayIso();
  const cached = await readCache(input.bitrixUserId, day);
  if (cached) return cached;

  const periodKey = periodKeyForDay(day) || currentPeriodKey();
  let store = await readLivePeriodStore(periodKey);
  if (!store && periodKey !== currentPeriodKey()) {
    store = await readLivePeriodStore(currentPeriodKey());
  }
  if (!store?.messages.length) {
    return emptyReview(
      day,
      "Вчерашние чаты ещё не подтянулись. Когда подтянутся, здесь будет простой разбор: что вышло и что сказать точнее."
    );
  }

  const packs = packYesterdayDialogs(store.messages, input.managerName, day);
  if (!packs.length) {
    return emptyReview(
      day,
      "Вчера в твоих чатах тишина — выходной или заявки не писали. Тогда смотри цифры зарплаты и один совет на сегодня."
    );
  }

  try {
    const raw = await askGemini(packs, firstNameFrom(input.managerName));
    const review = normalizeReview(raw, day, packs.length);
    if (!review) throw new Error("Пустой разбор");
    await writeCache(input.bitrixUserId, day, review);
    return review;
  } catch {
    return {
      day,
      dialogs: packs.length,
      headline: `Вчера было ${packs.length} чатов. Разбор сейчас не собрался — вот простое правило.`,
      good: [],
      better: [],
      tryToday: "Клиент спросил «сколько стоит?» — ответь числом с доставкой, не «сейчас посмотрю».",
      emptyHint: null
    };
  }
}
