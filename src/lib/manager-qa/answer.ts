import { callGeminiGenerateContent, extractGeminiText } from "@/lib/gemini/client";
import { readKnowledgeBaseCatalog } from "@/lib/training/knowledge-base";
import {
  MANAGER_KNOWLEDGE,
  rankKnowledgeSections,
  type KnowledgeSection
} from "@/lib/manager-qa/knowledge";

const EMPTY_REPLY =
  "Не нашёл это в базе знаний. Спросите про доставку, сроки, оплату, реквизиты или куда писать, если заказ встал. Если факта нет в базе, я его не придумываю.";

export function faqSections(entries: Array<{ question?: string; answer?: string; category?: string }>): KnowledgeSection[] {
  return entries
    .map((entry, index) => {
      const question = entry.question?.trim() || "";
      const answer = entry.answer?.trim() || "";
      if (!question || !answer) return null;
      return {
        id: `faq-${index + 1}`,
        title: entry.category?.trim() ? `${entry.category}: ${question}` : question,
        keywords: [],
        text: `${question}\n${answer}`
      };
    })
    .filter((section): section is KnowledgeSection => section !== null);
}

export async function loadManagerKnowledge(): Promise<KnowledgeSection[]> {
  try {
    const catalog = await readKnowledgeBaseCatalog();
    return [...MANAGER_KNOWLEDGE, ...faqSections(catalog.entries)];
  } catch (error) {
    console.warn("Manager QA knowledge FAQ skipped:", error instanceof Error ? error.message : error);
    return MANAGER_KNOWLEDGE;
  }
}

export function clipTelegramText(text: string, limit = 3900): string {
  const trimmed = text.trim();
  if (trimmed.length <= limit) return trimmed;
  return `${trimmed.slice(0, limit - 1).trimEnd()}…`;
}

export async function answerManagerQuestion(
  question: string,
  sections: KnowledgeSection[] = MANAGER_KNOWLEDGE
): Promise<string> {
  const picked = rankKnowledgeSections(question, sections, 3);
  if (picked.length === 0) return EMPTY_REPLY;

  const context = picked
    .map((section) => `## ${section.title}\n${section.text}`)
    .join("\n\n");

  try {
    const response = await callGeminiGenerateContent({
      systemInstruction: {
        parts: [{
          text: [
            "Ты внутренний помощник менеджеров Retro Pressa.",
            "Отвечай по-русски, коротко и по делу, только фактами из переданных фрагментов базы знаний.",
            "Если во фрагментах нет точного ответа, так и напиши и не выдумывай цены, сроки, имена и реквизиты.",
            "Если есть несколько вариантов, перечисли их.",
            "Если клиенту нельзя что-то обещать, прямо это скажи.",
            "Не ссылайся на «фрагменты» и не упоминай, что ты языковая модель."
          ].join(" ")
        }]
      },
      contents: [{
        role: "user",
        parts: [{ text: `Вопрос менеджера:\n${question}\n\nБаза знаний:\n${context}` }]
      }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 900 }
    });
    const text = extractGeminiText(response).trim();
    if (text) return clipTelegramText(text);
  } catch (error) {
    console.error("Manager QA Gemini failed:", error instanceof Error ? error.message : error);
  }

  const fallback = picked
    .map((section) => `${section.title}\n${section.text}`)
    .join("\n\n");
  return clipTelegramText(`Ответ из базы знаний:\n\n${fallback}`);
}
