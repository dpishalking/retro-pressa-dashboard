import type { ProductTrainingModule } from "@/types/training";

export const TRAINING_SHEET_ID = "1hLYcO6_knzWrfz6RWuHkQPuJoRajiy1XM9Z1aqHcQ98";

export type ParsedSheetProduct = {
  id: string;
  title: string;
  shortDescription: string;
  description: string;
  targetAudience: string;
  clientProblems: string;
  emotions: string;
  purchaseReasons: string;
  objections: string;
  presentationGuide: string;
  managerBrief?: string;
  costNote?: string;
};

const HEADER_ALIASES = {
  name: ["короткое название продукта", "7й"],
  description: ["что это такое простыми словами"],
  audience: ["для кого продукт"],
  pain: ["главная боль / потребность клиента", "главная боль"],
  idea: ["ключевая идея продукта"],
  whyNow: ["почему клиенту это нужно сейчас"],
  howItWorks: ["как работает продукт"],
  benefits: ["главные выгоды для клиента"],
  cost: ["стоимость"]
} as const;

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function findHeaderIndex(headers: string[], aliases: readonly string[]) {
  const normalized = headers.map(normalizeHeader);
  for (const alias of aliases) {
    const index = normalized.findIndex((item) => item.includes(alias));
    if (index >= 0) return index;
  }
  return -1;
}

function cell(row: string[], index: number) {
  return index >= 0 ? String(row[index] ?? "").trim() : "";
}

function isProductMarkerRow(row: string[]) {
  const first = String(row[0] ?? "").trim();
  if (!first.startsWith("Продукт:")) return false;
  return !row.slice(1).some((cell) => String(cell).trim());
}

function cleanSectionHeader(value: string, header: string) {
  const pattern = new RegExp(`^${header}(?:\\s*\\n\\s*${header})?\\s*`, "i");
  return value.replace(pattern, "").trim();
}

function sanitizePresentationGuide(value: string) {
  return value
    .replace(/Как объяснять клиенту:\s*\nКак объяснять клиенту[^\n]*\n\n/gi, "Как объяснять клиенту:\n\n")
    .replace(/Короткая формулировка для менеджера:\s*\nКороткая формулировка для менеджера\s*\n\n/gi, "Короткая формулировка для менеджера:\n\n")
    .trim();
}

function joinParagraphs(...parts: Array<string | undefined>) {
  return parts
    .map((part) => part?.trim())
    .filter(Boolean)
    .join("\n\n");
}

function resolveProductId(marker: string, name: string) {
  const text = `${marker} ${name}`.toLowerCase();

  if (text.includes("оригинал газеты") || text.includes("газета из дня рождения") || text.includes("издание из важной даты")) {
    return "personal-newspaper";
  }
  if (text.includes("книга жизни")) return "personal-magazine";
  if (text.includes("partypage") || text.includes("персонализированная газета") || text.includes("газета о человеке")) {
    return "retro-newspaper";
  }
  if (text.includes("глянцевый журнал") || text.includes("именной журнал") || text.includes("персональный журнал")) {
    return "gift-edition";
  }

  return null;
}

const CANONICAL_PRODUCT_TITLES: Record<string, string> = {};

function parseProductBlock(rows: string[][]) {
  const markerRow = rows.find((row) => row[0]?.startsWith("Продукт:"));
  if (!markerRow) return null;

  const marker = markerRow[0];
  const headerRowIndex = rows.findIndex((row) =>
    row.some((cell) => normalizeHeader(cell).includes("что это такое простыми словами"))
  );
  if (headerRowIndex < 0) return null;

  const headers = rows[headerRowIndex];
  const dataRow = rows[headerRowIndex + 1] ?? [];

  const rawName = cell(dataRow, findHeaderIndex(headers, HEADER_ALIASES.name)) || marker.replace(/^Продукт:\s*/i, "").trim();
  const name = rawName.replace(/^Продукт:\s*/i, "").replace(/\s+-\s*$/, "").trim();
  const id = resolveProductId(marker, name);
  if (!id) return null;

  const description = cell(dataRow, findHeaderIndex(headers, HEADER_ALIASES.description));
  const targetAudience = cell(dataRow, findHeaderIndex(headers, HEADER_ALIASES.audience));
  const clientProblems = cell(dataRow, findHeaderIndex(headers, HEADER_ALIASES.pain));
  const keyIdea = cell(dataRow, findHeaderIndex(headers, HEADER_ALIASES.idea));
  const whyNow = cell(dataRow, findHeaderIndex(headers, HEADER_ALIASES.whyNow));
  const howItWorks = cell(dataRow, findHeaderIndex(headers, HEADER_ALIASES.howItWorks));
  const benefits = cell(dataRow, findHeaderIndex(headers, HEADER_ALIASES.benefits));
  let costNote = cell(dataRow, findHeaderIndex(headers, HEADER_ALIASES.cost));

  let extendedDescription = "";
  let clientParagraph = "";
  let managerBrief = "";
  let emotionalResult = "";
  let whenToOffer = "";
  let meaning = "";
  let objections = "";

  for (let i = headerRowIndex + 2; i < rows.length; i++) {
    const row = rows[i];
    const label = String(row[0] ?? "").trim();
    const normalized = normalizeHeader(label);

    if (label.startsWith("Продукт:")) break;

    if (normalized === "дополнительные смыслы") {
      const contentRow = rows[i + 1]?.every((cell) => !String(cell).trim()) ? rows[i + 2] ?? [] : rows[i + 1] ?? [];
      extendedDescription = joinParagraphs(extendedDescription, contentRow[0]);
      clientParagraph = joinParagraphs(clientParagraph, contentRow[2]);
      managerBrief = joinParagraphs(managerBrief, contentRow[3]);
      i += contentRow === rows[i + 2] ? 2 : 1;
      continue;
    }

    if (normalized.includes("расширенное описание продукта")) {
      const contentRow = rows[i + 1] ?? [];
      extendedDescription = joinParagraphs(extendedDescription, contentRow[0]);
      clientParagraph = joinParagraphs(clientParagraph, contentRow[1]);
      managerBrief = joinParagraphs(managerBrief, contentRow[2]);
      i += 1;
      continue;
    }

    if (normalized.includes("что именно продаём по смыслу")) {
      const contentRow = rows[i + 1] ?? [];
      meaning = String(contentRow[0] ?? "").trim();
      emotionalResult = String(contentRow[1] ?? "").trim();
      whenToOffer = String(contentRow[2] ?? "").trim();
      i += 1;
      continue;
    }

    if (normalized.includes("какие проблемы решает продукт") || label.includes("Какие проблемы решает продукт")) {
      objections = joinParagraphs(
        label.replace(/^Какие проблемы решает продукт\s*/i, ""),
        row[1],
        rows[i + 1]?.[0],
        rows[i + 1]?.[1]
      );
      continue;
    }

    if (normalized.includes("из чего состоит продукт") && !costNote) {
      const contentRow = rows[i + 1] ?? [];
      costNote = joinParagraphs(contentRow[1], contentRow[2]);
      i += 1;
      continue;
    }
  }

  const cleanMeaning = meaning.replace(/^Что именно продаём по смыслу\s*/i, "").trim();
  const cleanEmotional = emotionalResult.replace(/^Главный эмоциональный результат\s*/i, "").trim();
  const cleanWhen = whenToOffer.replace(/^Когда особенно хорошо предлагать\s*/i, "").trim();
  const cleanedManagerBrief = cleanSectionHeader(managerBrief, "Короткая формулировка для менеджера");
  const cleanedClientParagraph = cleanSectionHeader(clientParagraph, "Как объяснять клиенту");

  return {
    id,
    title: CANONICAL_PRODUCT_TITLES[id] || name,
    shortDescription: cleanedManagerBrief || cleanedClientParagraph || description.slice(0, 220),
    description: joinParagraphs(description, extendedDescription, keyIdea ? `Ключевая идея: ${keyIdea}` : undefined),
    targetAudience,
    clientProblems: joinParagraphs(
      clientProblems,
      cleanMeaning && !cleanMeaning.startsWith("Что продаём") ? `Что продаём по смыслу: ${cleanMeaning}` : cleanMeaning || undefined
    ),
    emotions: joinParagraphs(benefits, cleanEmotional ? `Главный эмоциональный результат: ${cleanEmotional}` : undefined),
    purchaseReasons: joinParagraphs(cleanWhen, whyNow),
    objections,
    presentationGuide: sanitizePresentationGuide(
      joinParagraphs(
        howItWorks,
        cleanedClientParagraph ? `Как объяснять клиенту:\n${cleanedClientParagraph}` : undefined,
        cleanedManagerBrief ? `Короткая формулировка для менеджера:\n${cleanedManagerBrief}` : undefined
      )
    ),
    managerBrief: cleanedManagerBrief,
    costNote: costNote || undefined
  } satisfies ParsedSheetProduct;
}

export function parseTrainingSheetTabs(tabs: Record<string, string[][]>) {
  const products = new Map<string, ParsedSheetProduct>();

  for (const rows of Object.values(tabs)) {
    const blocks: string[][][] = [];
    let current: string[][] = [];

    for (const row of rows) {
      if (isProductMarkerRow(row) && current.length) {
        blocks.push(current);
        current = [row];
      } else {
        current.push(row);
      }
    }
    if (current.length) blocks.push(current);

    for (const block of blocks) {
      const parsed = parseProductBlock(block);
      if (parsed) products.set(parsed.id, parsed);
    }
  }

  return [...products.values()];
}

export function applySheetProductContent(product: ProductTrainingModule, sheet?: ParsedSheetProduct): ProductTrainingModule {
  if (!sheet) return product;

  const sheetMaterials = sheet.costNote
    ? [
        ...product.materials.filter((item) => item.id !== `mat-${product.id}-sheet-cost`),
        {
          id: `mat-${product.id}-sheet-cost`,
          type: "text" as const,
          title: "Сроки и объём",
          content: sheet.costNote,
          sortOrder: 10
        }
      ]
    : product.materials;

  return {
    ...product,
    title: sheet.title || product.title,
    shortDescription: sheet.shortDescription || product.shortDescription,
    description: sheet.description || product.description,
    targetAudience: sheet.targetAudience || product.targetAudience,
    clientProblems: sheet.clientProblems || product.clientProblems,
    emotions: sheet.emotions || product.emotions,
    purchaseReasons: sheet.purchaseReasons || product.purchaseReasons,
    objections: sheet.objections || product.objections,
    presentationGuide: sheet.presentationGuide || product.presentationGuide,
    materials: sheetMaterials
  };
}

export function applySheetContentToCatalog(products: ProductTrainingModule[], sheetProducts: ParsedSheetProduct[]) {
  const sheetMap = new Map(sheetProducts.map((item) => [item.id, item]));
  return products.map((product) => applySheetProductContent(product, sheetMap.get(product.id)));
}
