import type { ProductMaterial, ProductTrainingModule } from "@/types/training";

export type ProductSectionKey =
  | "description"
  | "targetAudience"
  | "clientProblems"
  | "emotions"
  | "purchaseReasons"
  | "objections"
  | "presentationGuide";

export type ProductContentSection = {
  sectionKey: ProductSectionKey;
  title: string;
  content: string;
  emoji: string;
};

const sectionDefinitions: Array<{
  key: ProductSectionKey;
  title: string;
  field: keyof ProductTrainingModule;
}> = [
  { key: "description", title: "Что это за продукт", field: "description" },
  { key: "targetAudience", title: "Для кого подходит", field: "targetAudience" },
  { key: "clientProblems", title: "Какие задачи клиента закрывает", field: "clientProblems" },
  { key: "emotions", title: "Какие эмоции вызывает", field: "emotions" },
  { key: "purchaseReasons", title: "Основные поводы для покупки", field: "purchaseReasons" },
  { key: "objections", title: "Частые возражения клиентов", field: "objections" },
  { key: "presentationGuide", title: "Как правильно презентовать продукт", field: "presentationGuide" }
];

export const sectionEmojis: Record<ProductSectionKey, string> = {
  description: "🗞️",
  targetAudience: "👥",
  clientProblems: "🎯",
  emotions: "💛",
  purchaseReasons: "🎁",
  objections: "💬",
  presentationGuide: "🎤"
};

export function buildProductSections(product: ProductTrainingModule): ProductContentSection[] {
  const sections: ProductContentSection[] = [];

  for (const { key, title, field } of sectionDefinitions) {
    const content = String(product[field] ?? "").trim();
    if (!content) continue;
    sections.push({
      sectionKey: key,
      title,
      content,
      emoji: sectionEmojis[key]
    });
  }

  return sections;
}

export function splitProductMaterials(materials: ProductMaterial[]) {
  const videos: ProductMaterial[] = [];
  const extras: ProductMaterial[] = [];

  for (const material of materials) {
    if (material.type === "video") {
      videos.push(material);
      continue;
    }
    if (material.type === "image" && material.sectionKey) {
      continue;
    }
    extras.push(material);
  }

  videos.sort((a, b) => a.sortOrder - b.sortOrder);
  extras.sort((a, b) => a.sortOrder - b.sortOrder);

  return { videos, extras };
}

export function presentationEmbedUrl(presentationUrl?: string) {
  if (!presentationUrl?.trim()) return null;

  const trimmed = presentationUrl.trim();
  const publishedMatch = trimmed.match(/\/presentation\/d\/e\/([^/]+)/);
  if (publishedMatch) {
    return `https://docs.google.com/presentation/d/e/${publishedMatch[1]}/embed?start=false&loop=false&delayms=3000`;
  }

  const standardMatch = trimmed.match(/\/presentation\/d\/([^/]+)/);
  if (standardMatch) {
    return `https://docs.google.com/presentation/d/${standardMatch[1]}/embed?start=false&loop=false&delayms=3000`;
  }

  return null;
}
