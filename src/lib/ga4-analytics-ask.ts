import { callGeminiGenerateContent, extractGeminiText, getGeminiModel } from "@/lib/gemini/client";
import { ga4ContextForAsk } from "@/lib/google/ga4-connector";
import type { Ga4Snapshot } from "@/lib/google/ga4-snapshot-store";

export type Ga4AskResult = {
  model: string;
  question: string;
  answer: string;
  highlights: string[];
  caveats: string[];
};

export async function askGa4Analytics(
  question: string,
  snapshot: Ga4Snapshot,
  marketing?: {
    paidLeads: number;
    organicLeads: number;
    adSpend: number;
    ql: number;
  }
): Promise<Ga4AskResult> {
  const trimmedQuestion = question.trim();
  if (!trimmedQuestion) {
    throw new Error("Вопрос не может быть пустым.");
  }

  const model = getGeminiModel();
  const context = ga4ContextForAsk(snapshot, marketing);

  const payload = await callGeminiGenerateContent({
    systemInstruction: {
      parts: [{
        text: [
          "Ты аналитик веб-трафика Retro Pressa.",
          "Отвечай на русском языке, кратко и по делу.",
          "Используй только данные из контекста. Не выдумывай цифры.",
          "Различай: newUsers/sessions из GA4 — это посетители сайта; paidLeads/organicLeads — это CRM-лиды из Google Sheets.",
          "Если вопрос про лиды или выручку, а в контексте только GA4, явно скажи об ограничении.",
          "Верни только валидный JSON по схеме."
        ].join(" ")
      }]
    },
    contents: [{
      role: "user",
      parts: [{
        text: JSON.stringify({
          question: trimmedQuestion,
          ga4Context: context
        })
      }]
    }],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          answer: { type: "string" },
          highlights: { type: "array", items: { type: "string" } },
          caveats: { type: "array", items: { type: "string" } }
        },
        required: ["answer", "highlights", "caveats"]
      }
    }
  }, model);

  const text = extractGeminiText(payload);
  const parsed = JSON.parse(text) as { answer?: string; highlights?: string[]; caveats?: string[] };

  return {
    model,
    question: trimmedQuestion,
    answer: String(parsed.answer ?? "").trim(),
    highlights: Array.isArray(parsed.highlights) ? parsed.highlights.map(String).slice(0, 5) : [],
    caveats: Array.isArray(parsed.caveats) ? parsed.caveats.map(String).slice(0, 5) : []
  };
}
