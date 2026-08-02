import { readFile } from "node:fs/promises";
import path from "node:path";

export type MdDocumentMeta = {
  slug: string;
  title: string;
  description: string;
  file: string;
};

const DOCUMENTS: MdDocumentMeta[] = [
  {
    slug: "motivation",
    title: "Мотивация менеджеров",
    description: "ТЗ на раздел бонусов, рейтинга, отзывов и инструментов отдела продаж.",
    file: "motivation.md"
  }
];

const contentDir = path.join(process.cwd(), "src", "content", "md");

export function listMdDocuments(): MdDocumentMeta[] {
  return DOCUMENTS;
}

export function findMdDocument(slug: string): MdDocumentMeta | null {
  return DOCUMENTS.find((doc) => doc.slug === slug) ?? null;
}

export async function readMdDocument(slug: string): Promise<{ meta: MdDocumentMeta; markdown: string } | null> {
  const meta = findMdDocument(slug);
  if (!meta) return null;
  try {
    const markdown = await readFile(path.join(contentDir, meta.file), "utf8");
    return { meta, markdown };
  } catch {
    return null;
  }
}
