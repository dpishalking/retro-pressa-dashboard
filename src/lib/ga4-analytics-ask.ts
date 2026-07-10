import { ga4ContextForAsk } from "@/lib/google/ga4-connector";
import type { Ga4Snapshot } from "@/lib/google/ga4-snapshot-store";

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
  const key = apiKey();
  if (!key) {
    throw new Error("Gemini API key не найден. Добавьте GEMINI_API_KEY в .env.local.");
  }

  const trimmedQuestion = question.trim();
  if (!trimmedQuestion) {
    throw new Error("Вопрос не может быть пустым.");
  }

  const model = defaultModel;
  const context = ga4ContextForAsk(snapshot, marketing);

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
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
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini вернул ошибку ${response.status}: ${errorText.slice(0, 500)}`);
  }

  const payload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  const parsed = JSON.parse(text) as { answer?: string; highlights?: string[]; caveats?: string[] };

  return {
    model,
    question: trimmedQuestion,
    answer: String(parsed.answer ?? "").trim(),
    highlights: Array.isArray(parsed.highlights) ? parsed.highlights.map(String).slice(0, 5) : [],
    caveats: Array.isArray(parsed.caveats) ? parsed.caveats.map(String).slice(0, 5) : []
  };
}
