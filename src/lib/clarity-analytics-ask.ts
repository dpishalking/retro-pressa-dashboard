import type { ClaritySnapshot } from "@/lib/clarity/clarity-snapshot-store";
import { clarityContextForAsk } from "@/lib/clarity/clarity-connector";
import type { Ga4Snapshot } from "@/lib/google/ga4-snapshot-store";
import { ga4ContextForAsk } from "@/lib/google/ga4-connector";

const defaultModel = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";

function apiKey() {
  return process.env.GEMINI_API_KEY?.trim()
    || process.env.GOOGLE_API_KEY?.trim()
    || process.env.GOOGLE_AI_API_KEY?.trim()
    || process.env.GOOGLE_GEMINI_API_KEY?.trim()
    || process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim()
    || process.env.GEMINI_KEY?.trim()
    || "";
}

export type ClarityAskResult = {
  model: string;
  question: string;
  answer: string;
  highlights: string[];
  caveats: string[];
};

export async function askClarityAnalytics(
  question: string,
  clarity: ClaritySnapshot,
  ga4?: Ga4Snapshot | null,
  marketing?: {
    paidLeads: number;
    organicLeads: number;
    adSpend: number;
    ql: number;
  }
): Promise<ClarityAskResult> {
  const key = apiKey();
  if (!key) {
    throw new Error("Gemini API key не найден. Добавьте GEMINI_API_KEY в .env.local.");
  }

  const trimmedQuestion = question.trim();
  if (!trimmedQuestion) {
    throw new Error("Вопрос не может быть пустым.");
  }

  const model = defaultModel;
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{
          text: [
            "Ты UX/маркетинг-аналитик Retro Pressa.",
            "Отвечай на русском языке, кратко и по делу.",
            "Используй только данные из контекста. Не выдумывай цифры.",
            "Clarity показывает поведение на сайте: rage clicks, dead clicks, quickback, engagement, URL, campaign.",
            "GA4 показывает каналы и сессии. Связывай проблемы UX с UTM/кампаниями, если видно в данных.",
            "Если видишь social_paid, ig/paid, cpc как source — это плохая UTM-разметка.",
            "Предлагай конкретные гипотезы: форма, кнопка, мобильная версия, лендинг.",
            "Верни только валидный JSON по схеме."
          ].join(" ")
        }]
      },
      contents: [{
        role: "user",
        parts: [{
          text: JSON.stringify({
            question: trimmedQuestion,
            clarityContext: clarityContextForAsk(clarity),
            ga4Context: ga4 ? ga4ContextForAsk(ga4, marketing) : null
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
    }),
    cache: "no-store"
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || "Gemini request failed");
  }

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini не вернул ответ");

  const parsed = JSON.parse(text) as { answer: string; highlights?: string[]; caveats?: string[] };
  return {
    model,
    question: trimmedQuestion,
    answer: parsed.answer,
    highlights: parsed.highlights ?? [],
    caveats: parsed.caveats ?? []
  };
}
