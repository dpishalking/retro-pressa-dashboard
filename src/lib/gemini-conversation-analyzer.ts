import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { ConversationMessage, GeminiConversationSummary, GeminiDialogueAnalysis } from "@/types/metrics";

type GeminiCache = {
  version: 1;
  model: string;
  analyses: Record<string, GeminiDialogueAnalysis>;
};

type GeminiBatchResult = {
  dialogs: GeminiDialogueAnalysis[];
};

const cachePath = ".cache/gemini-conversation-analysis.json";
const defaultModel = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
const cacheVersion = 1;

function apiKey() {
  return process.env.GEMINI_API_KEY?.trim()
    || process.env.GOOGLE_API_KEY?.trim()
    || process.env.GOOGLE_AI_API_KEY?.trim()
    || process.env.GOOGLE_GEMINI_API_KEY?.trim()
    || process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim()
    || process.env.GEMINI_KEY?.trim()
    || "";
}

function countBy(items: string[]) {
  const counts = new Map<string, number>();
  items.filter(Boolean).forEach((item) => counts.set(item, (counts.get(item) ?? 0) + 1));
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

async function readCache(model: string): Promise<GeminiCache> {
  try {
    const parsed = JSON.parse(await readFile(cachePath, "utf8")) as GeminiCache;
    if (parsed.version === cacheVersion && parsed.model === model && parsed.analyses) return parsed;
  } catch {
    // Missing or invalid cache is fine; it will be recreated.
  }
  return { version: cacheVersion, model, analyses: {} };
}

async function writeCache(cache: GeminiCache) {
  await mkdir(dirname(cachePath), { recursive: true });
  await writeFile(cachePath, JSON.stringify(cache, null, 2));
}

function groupMessages(messages: ConversationMessage[]) {
  const groups = new Map<string, ConversationMessage[]>();
  messages.forEach((message) => groups.set(message.dialogId, [...(groups.get(message.dialogId) ?? []), message]));
  return Array.from(groups.entries()).map(([dialogId, rows]) => ({
    dialogId,
    messages: [...rows].sort((a, b) => String(a.date ?? "").localeCompare(String(b.date ?? "")))
  }));
}

function compactDialog(dialog: { dialogId: string; messages: ConversationMessage[] }) {
  const transcript = dialog.messages
    .slice(0, 80)
    .map((message) => {
      const role = message.senderRole === "manager" ? "Менеджер" : message.senderRole === "client" ? "Клиент" : message.sender || "unknown";
      return `${message.date ?? ""} ${role}: ${message.text}`.trim();
    })
    .join("\n")
    .slice(0, 9000);

  return {
    dialogId: dialog.dialogId,
    manager: dialog.messages.find((message) => message.manager)?.manager ?? null,
    outcomeHint: dialog.messages.find((message) => message.outcome !== "unknown")?.outcome ?? "unknown",
    transcript
  };
}

function normalizeAnalysis(value: unknown): GeminiDialogueAnalysis | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<GeminiDialogueAnalysis>;
  if (!row.dialogId || typeof row.dialogId !== "string") return null;
  const qualityScore = Math.max(0, Math.min(100, Math.round(Number(row.qualityScore) || 0)));
  return {
    dialogId: row.dialogId,
    qualityScore,
    outcome: row.outcome ?? "unknown",
    summary: String(row.summary ?? "").slice(0, 500),
    managerStrengths: Array.isArray(row.managerStrengths) ? row.managerStrengths.map(String).slice(0, 4) : [],
    missedOpportunities: Array.isArray(row.missedOpportunities) ? row.missedOpportunities.map(String).slice(0, 5) : [],
    lossReason: row.lossReason ? String(row.lossReason).slice(0, 120) : null,
    recommendedNextAction: String(row.recommendedNextAction ?? "").slice(0, 500),
    needsHumanReview: Boolean(row.needsHumanReview)
  };
}

async function analyzeBatch(dialogs: ReturnType<typeof compactDialog>[], model: string) {
  const key = apiKey();
  if (!key) {
    throw new Error("Gemini API key не найден. Добавьте GEMINI_API_KEY или GOOGLE_API_KEY в .env.local текущего проекта.");
  }

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{
          text: [
            "Ты senior sales quality analyst для Retro Pressa.",
            "Анализируй клиентские переписки строго по смыслу, без выдумывания фактов.",
            "Оценивай, помог ли менеджер выбрать подарок, назвал ли полную сумму/доставку, закрыл ли на следующий шаг.",
            "Верни только валидный JSON по схеме."
          ].join(" ")
        }]
      },
      contents: [{
        role: "user",
        parts: [{
          text: JSON.stringify({
            task: "Проанализируй каждый диалог и верни dialogs.",
            dialogs
          })
        }]
      }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            dialogs: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  dialogId: { type: "string" },
                  qualityScore: { type: "number" },
                  outcome: { type: "string", enum: ["order", "invoice", "lost", "in_progress", "unknown"] },
                  summary: { type: "string" },
                  managerStrengths: { type: "array", items: { type: "string" } },
                  missedOpportunities: { type: "array", items: { type: "string" } },
                  lossReason: { type: "string" },
                  recommendedNextAction: { type: "string" },
                  needsHumanReview: { type: "boolean" }
                },
                required: ["dialogId", "qualityScore", "outcome", "summary", "managerStrengths", "missedOpportunities", "recommendedNextAction", "needsHumanReview"]
              }
            }
          },
          required: ["dialogs"]
        }
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini вернул ошибку ${response.status}: ${errorText.slice(0, 500)}`);
  }

  const payload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  const parsed = JSON.parse(text) as GeminiBatchResult;
  return (parsed.dialogs ?? []).map(normalizeAnalysis).filter(Boolean) as GeminiDialogueAnalysis[];
}

export async function analyzeConversationsWithGemini(messages: ConversationMessage[], options: { limit?: number; batchSize?: number; model?: string } = {}): Promise<GeminiConversationSummary> {
  const model = options.model || defaultModel;
  const limit = Math.max(1, Math.min(options.limit ?? 80, 500));
  const batchSize = Math.max(1, Math.min(options.batchSize ?? 8, 20));
  const dialogs = groupMessages(messages).slice(0, limit);
  const cache = await readCache(model);
  const cached = dialogs.map((dialog) => cache.analyses[dialog.dialogId]).filter(Boolean);
  const missing = dialogs.filter((dialog) => !cache.analyses[dialog.dialogId]);

  for (let index = 0; index < missing.length; index += batchSize) {
    const batch = missing.slice(index, index + batchSize).map(compactDialog);
    const analyses = await analyzeBatch(batch, model);
    analyses.forEach((analysis) => {
      cache.analyses[analysis.dialogId] = analysis;
    });
    await writeCache(cache);
  }

  const sample = dialogs.map((dialog) => cache.analyses[dialog.dialogId]).filter(Boolean);
  const averageQualityScore = Math.round(sample.reduce((sum, item) => sum + item.qualityScore, 0) / Math.max(1, sample.length));

  return {
    model,
    requestedDialogs: dialogs.length,
    analyzedDialogs: sample.length,
    cachedDialogs: cached.length,
    newDialogs: sample.length - cached.length,
    averageQualityScore,
    needsHumanReview: sample.filter((item) => item.needsHumanReview).length,
    topMissedOpportunities: countBy(sample.flatMap((item) => item.missedOpportunities)).slice(0, 8),
    topLossReasons: countBy(sample.map((item) => item.lossReason ?? "")).slice(0, 8),
    sample: sample.slice(0, 12)
  };
}
