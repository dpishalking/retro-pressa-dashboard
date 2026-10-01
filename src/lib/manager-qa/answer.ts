import { callGeminiGenerateContent, extractGeminiText } from "@/lib/gemini/client";
import {
  asksOperationalFact,
  formatAssetReply,
  formatCardFooter,
  loadManagerCorpus,
  pickSections,
  type ManagerCorpus
} from "@/lib/manager-qa/catalog";
import { readKnowledgeBaseCatalog } from "@/lib/training/knowledge-base";
import type { KnowledgeSection } from "@/lib/manager-qa/knowledge";

const EMPTY_REPLY =
  "Не нашёл это в базе. Спросите про доставку, сроки, оплату, продукт, отзывы или куда писать, если заказ встал. Если факта нет в базе, я его не придумываю.";

export function faqSections(entries: Array<{ question?: string; answer?: string; category?: string }>): KnowledgeSection[] {
  const sections: KnowledgeSection[] = [];
  entries.forEach((entry, index) => {
    const question = entry.question?.trim() || "";
    const answer = entry.answer?.trim() || "";
    if (!question || !answer) return;
    const category = entry.category?.trim();
    sections.push({
      id: `faq-${index + 1}`,
      title: category ? `${category}: ${question}` : question,
      keywords: question.split(/\s+/).slice(0, 8),
      text: `${question}\n${answer}`
    });
  });
  return sections;
}

export async function loadAnswerCorpus(): Promise<ManagerCorpus> {
  const corpus = await loadManagerCorpus();
  try {
    const catalog = await readKnowledgeBaseCatalog();
    corpus.sections.push(...faqSections(catalog.entries));
  } catch (error) {
    console.warn("Manager QA knowledge FAQ skipped:", error instanceof Error ? error.message : error);
  }
  return corpus;
}

export function stripTelegramMarkup(text: string): string {
  return text
    .replace(/\*/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function clipTelegramText(text: string, limit = 3900): string {
  const trimmed = stripTelegramMarkup(text);
  if (trimmed.length <= limit) return trimmed;
  const lines = trimmed.split("\n");
  const kept: string[] = [];
  let size = 0;
  for (const line of lines) {
    if (size + line.length + 1 > limit - 20) break;
    kept.push(line);
    size += line.length + 1;
  }
  return `${kept.join("\n")}\n…`.trim();
}

function joinAnswer(main: string, extra: string | null): string {
  if (!extra) return clipTelegramText(main);
  const cleanedExtra = stripTelegramMarkup(extra);
  const room = 3900 - cleanedExtra.length - 2;
  if (room < 400) return clipTelegramText(cleanedExtra);
  return `${clipTelegramText(main, room)}\n\n${cleanedExtra}`;
}

export async function answerManagerQuestion(
  question: string,
  corpus?: ManagerCorpus
): Promise<string> {
  const data = corpus ?? await loadAnswerCorpus();
  const assets = formatAssetReply(question, data);
  if (assets && !asksOperationalFact(question)) return clipTelegramText(assets);

  const picked = pickSections(question, data.sections);
  if (picked.length === 0) return assets ?? EMPTY_REPLY;

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
            "Если во фрагменте есть URL, копируй его дословно.",
            "Пиши обычным текстом: без markdown, без звёздочек и без решёток.",
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
    if (text) return joinAnswer(text, assets || formatCardFooter(question));
  } catch (error) {
    console.error("Manager QA Gemini failed:", error instanceof Error ? error.message : error);
  }

  const fallback = picked
    .map((section) => `${section.title}\n${section.text}`)
    .join("\n\n");
  return joinAnswer(fallback, assets || formatCardFooter(question));
}
