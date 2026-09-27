export const INSTAGRAM_DM_SOURCE_IDS = ["UC_PXE40M", "UC_61GF35"];

const INTENT_TAGS = [
  { id: "book", label: "Книга", pattern: /книг/i },
  { id: "magazine", label: "Журнал", pattern: /журнал/i }
] as const;

export type IntentTag = { id: string; label: string };

export type ClientLine = {
  text: string;
  at: number;
};

export function isInstagramDmLead(sourceId: string, title: string): boolean {
  if (INSTAGRAM_DM_SOURCE_IDS.includes(sourceId.trim())) return true;
  return /instagram/i.test(title) && !/заявка с сайта/i.test(title);
}

export function plainChatText(raw: string): string {
  return raw
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\[\/?[^\]]+\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchIntentTags(text: string): IntentTag[] {
  return INTENT_TAGS.filter((tag) => tag.pattern.test(text)).map((tag) => ({
    id: tag.id,
    label: tag.label
  }));
}

/** Lines at or after `sinceMs`. `sinceMs` 0 means the whole dialog. */
export function intentLines(lines: ClientLine[], sinceMs: number): { tags: IntentTag[]; quotes: string[] } {
  const fresh = sinceMs > 0 ? lines.filter((line) => line.at > sinceMs) : lines;
  const tags = new Map<string, IntentTag>();
  const quotes: string[] = [];
  for (const line of fresh) {
    const matched = matchIntentTags(line.text);
    if (!matched.length) continue;
    for (const tag of matched) tags.set(tag.id, tag);
    if (quotes.length < 3) quotes.push(line.text.slice(0, 300));
  }
  return { tags: [...tags.values()], quotes };
}

export function formatInstagramIntentAlert(input: {
  name: string;
  leadId: string;
  createdAtLabel: string;
  bitrixUrl: string;
  tags: IntentTag[];
  quotes: string[];
}): string {
  const tagLabel = input.tags.map((tag) => tag.label).join(", ") || "запрос";
  const quotes = input.quotes.map((quote) => `«${quote}»`).join("\n");
  return [
    `Instagram — ${tagLabel}`,
    "",
    input.name || "Без имени",
    `Лид ${input.leadId} · ${input.createdAtLabel} (Рига)`,
    input.bitrixUrl,
    "",
    quotes
  ].join("\n").slice(0, 3500);
}
