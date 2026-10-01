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

const COUNTRIES: Array<{ test: RegExp; flag: string; name: string }> = [
  { test: /вашингтон/i, flag: "🇺🇸", name: "США" },
  { test: /сша|америк/i, flag: "🇺🇸", name: "США" },
  { test: /словен/i, flag: "🇸🇮", name: "Словения" },
  { test: /итали/i, flag: "🇮🇹", name: "Италия" },
  { test: /болгар/i, flag: "🇧🇬", name: "Болгария" },
  { test: /норвег/i, flag: "🇳🇴", name: "Норвегия" },
  { test: /эстон/i, flag: "🇪🇪", name: "Эстония" },
  { test: /литв/i, flag: "🇱🇹", name: "Литва" },
  { test: /латви/i, flag: "🇱🇻", name: "Латвия" },
  { test: /казахстан/i, flag: "🇰🇿", name: "Казахстан" },
  { test: /азербайджан/i, flag: "🇦🇿", name: "Азербайджан" },
  { test: /грузи/i, flag: "🇬🇪", name: "Грузия" },
  { test: /турци/i, flag: "🇹🇷", name: "Турция" },
  { test: /израил/i, flag: "🇮🇱", name: "Израиль" },
  { test: /англи|великобритан/i, flag: "🇬🇧", name: "Великобритания" },
  { test: /молдов/i, flag: "🇲🇩", name: "Молдова" },
  { test: /(?:^|\s)риг/i, flag: "🇱🇻", name: "Рига" },
  { test: /минск/i, flag: "🇧🇾", name: "Минск" },
  { test: /беларус|белорус/i, flag: "🇧🇾", name: "Беларусь" },
  { test: /росси/i, flag: "🇷🇺", name: "Россия" },
  { test: /герман/i, flag: "🇩🇪", name: "Германия" },
  { test: /франц/i, flag: "🇫🇷", name: "Франция" },
  { test: /испан/i, flag: "🇪🇸", name: "Испания" },
  { test: /польш/i, flag: "🇵🇱", name: "Польша" },
  { test: /чехи/i, flag: "🇨🇿", name: "Чехия" },
  { test: /австри/i, flag: "🇦🇹", name: "Австрия" },
  { test: /нидерланд|голлан/i, flag: "🇳🇱", name: "Нидерланды" },
  { test: /швец/i, flag: "🇸🇪", name: "Швеция" },
  { test: /финлянд/i, flag: "🇫🇮", name: "Финляндия" },
  { test: /дании|данию|дания/i, flag: "🇩🇰", name: "Дания" },
  { test: /португал/i, flag: "🇵🇹", name: "Португалия" },
  { test: /грец/i, flag: "🇬🇷", name: "Греция" },
  { test: /хорват/i, flag: "🇭🇷", name: "Хорватия" },
  { test: /серб/i, flag: "🇷🇸", name: "Сербия" },
  { test: /украин/i, flag: "🇺🇦", name: "Украина" },
  { test: /канад/i, flag: "🇨🇦", name: "Канада" },
  { test: /австрал/i, flag: "🇦🇺", name: "Австралия" }
];

const SECTION_HEADS: Record<string, string> = {
  "Отзывы:": "💬 <b>Отзывы</b>",
  "Фото:": "🖼 <b>Фото</b>",
  "Видео:": "🎬 <b>Видео</b>",
  "Файлы:": "📎 <b>Файлы</b>",
  "Карточка для клиента:": "🔗 <b>Карточка для клиента</b>",
  "Обучение:": "🎓 <b>Обучение</b>",
  "Общие видеоотзывы:": "💬 <b>Общие видеоотзывы</b>"
};

function countryIn(text: string): { flag: string; name: string } | null {
  return COUNTRIES.find((country) => country.test.test(text)) ?? null;
}

function carrierIn(text: string): string | null {
  return text.match(/\b(?:DPD|PUMITY|DHL|СДЭК|CDEK|Novapost|Мекус)\b/i)?.[0] ?? null;
}

function optionEmoji(title: string): string {
  const value = title.toLowerCase();
  if (/на дом|по адрес|курьер/.test(value)) return "🏠";
  if (/dhl|экспресс/.test(value)) return "✈️";
  if (/пакомат|пункт|самовывоз|офис/.test(value)) return "📦";
  return "🚚";
}

function optionTitle(title: string): string {
  const carrier = carrierIn(title);
  const value = title.toLowerCase();
  if (/на дом|по адрес/.test(value)) return carrier ? `На дом · ${carrier}` : "На дом";
  if (/пакомат|пункт выдачи/.test(value)) return carrier ? `Пункт выдачи / пакомат · ${carrier}` : "Пункт выдачи / пакомат";
  if (/самовывоз/.test(value)) return "Самовывоз";
  const cleaned = title.replace(/^в\s+/i, "").replace(/^доставка\s+/i, "").replace(/[;.,]$/, "").trim();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function parseOption(line: string): { emoji: string; title: string; price: string; time?: string } | null {
  if (line.length > 180 || line.includes("http")) return null;
  const body = line.replace(/^\s*[-•]\s+/, "").replace(/[;]+$/, "").trim();
  const split = body.match(/^(.+?)\s+[—–]\s+(.+)$/) ?? body.match(/^(.+?):\s+((?:от\s+)?\d+\s*(?:EUR|BYN|€).+)$/i);
  if (!split) return null;
  const price = split[2].match(/от\s+\d+\s*(?:EUR|BYN|€)|\d+(?:[.,]\d+)?\s*(?:EUR|BYN|€)/i)?.[0];
  if (!price) return null;
  const time = split[2].match(/(?:срок\s+)?(\d+\s*[–-]\s*\d+\s*(?:дн(?:я|ей)?|недел[а-я]*)|\d+\s*(?:дн(?:я|ей)?|недел[а-я]*))/i)?.[1];
  const title = optionTitle(split[1]);
  return {
    emoji: optionEmoji(`${split[1]} ${title}`),
    title,
    price: price.replace(/\s+/g, " "),
    time: time?.replace("-", "–").replace(/\s+/g, " ")
  };
}

function layoutReply(text: string): string {
  const source = text.split("\n");
  const lines: string[] = [];
  let options = 0;
  for (const raw of source) {
    const line = raw.trim();
    if (!line) {
      lines.push("");
      continue;
    }
    const head = SECTION_HEADS[line];
    if (head) {
      lines.push(head);
      continue;
    }
    const option = parseOption(line);
    if (!option) {
      lines.push(line);
      continue;
    }
    options += 1;
    if (lines.length && lines[lines.length - 1] !== "") lines.push("");
    lines.push(`${option.emoji} <b>${option.title}</b>`);
    lines.push(`💶 ${option.price}`);
    if (option.time) lines.push(`⏱ ${option.time}`);
    lines.push("");
  }

  const country = options > 0 ? countryIn(text) : null;
  const first = lines.findIndex((line) => line.trim());
  if (country && first >= 0 && !lines[first].includes(country.flag)) {
    const intro = /вариант|доставк/i.test(lines[first]) && !/ориентир|отдельн|уточн/i.test(lines[first]);
    if (intro) lines[first] = `${country.flag} <b>${country.name}</b>`;
    else lines.unshift(`${country.flag} <b>${country.name}</b>`, "");
  }
  const title = lines.findIndex((line) => line.trim());
  if (title >= 0 && lines[title].length < 48 && !lines[title].includes("http") && !lines[title].includes("<b>") && !/[.!?]$/.test(lines[title])) {
    const structured = options > 0 || lines.some((line) => line === "");
    if (structured) {
      const emoji = lines[title].match(/^(\p{Extended_Pictographic}\uFE0F?)\s*/u)?.[1] ?? "";
      const rest = (emoji ? lines[title].slice(emoji.length) : lines[title]).trim();
      lines[title] = emoji ? `${emoji} <b>${rest}</b>` : `<b>${rest}</b>`;
    }
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function sanitizeTelegramHtml(text: string): string {
  const tokens: string[] = [];
  const marked = text.replace(/<\/?b>|<\/?i>|<a href="(https?:\/\/[^"<>\s]+)">|<\/a>/gi, (tag, href?: string) => {
    if (href) tokens.push(`<a href="${href}">`);
    else tokens.push(tag.toLowerCase());
    return `\u0000${tokens.length - 1}\u0000`;
  });
  const escaped = marked
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\u0000(\d+)\u0000/g, (_, index: string) => tokens[Number(index)] ?? "");
  let bold = 0;
  let italic = 0;
  let links = 0;
  const balanced = escaped.replace(/<\/?b>|<\/?i>|<a href="[^"]*">|<\/a>/g, (tag) => {
    if (tag === "<b>") { bold += 1; return tag; }
    if (tag === "</b>") { if (bold === 0) return ""; bold -= 1; return tag; }
    if (tag === "<i>") { italic += 1; return tag; }
    if (tag === "</i>") { if (italic === 0) return ""; italic -= 1; return tag; }
    if (tag === "</a>") { if (links === 0) return ""; links -= 1; return tag; }
    links += 1;
    return tag;
  });
  return `${balanced}${"</b>".repeat(bold)}${"</i>".repeat(italic)}${"</a>".repeat(links)}`;
}

export function renderTelegramMessage(text: string): string {
  const prepared = text
    .replace(/\*\*([^*\n]+)\*\*/g, "<b>$1</b>")
    .replace(/\*/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return sanitizeTelegramHtml(layoutReply(prepared));
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
            "Отвечай по-русски, коротко и по делу.",
            "Если точной строки нет, но в базе есть соседнее правило, дай ориентир по нему. Первой фразой напиши, что отдельной строки нет и по какому правилу считаешь. Цифры бери только из этого правила.",
            "Город относи к стране: Вашингтон — это США.",
            "Не выдумывай новую цену, срок, имя или реквизит, которых нет в базе.",
            "Если рядом нет никакого правила, скажи, что в базе этого нет.",
            "Если есть несколько вариантов, перечисли их.",
            "Если клиенту нельзя обещать оценку как точный тариф, прямо это скажи.",
            "URL из базы копируй дословно.",
            "Верстай ответ для Telegram. Первая строка — короткая тема. Каждый вариант доставки — отдельный блок: название, цена, срок.",
            "Ставь немного эмодзи по смыслу: флаг страны, 📦 пункт или пакомат, 🏠 на дом, ✈️ DHL, 🚚 обычная доставка, 💶 цена, ⏱ срок, 💬 чат.",
            "Жирным выделяй только короткие названия через тег <b>название</b>. Другие HTML-теги, звёздочки и решётки не используй.",
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
