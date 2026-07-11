import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import seedCatalog from "../../../data/training/knowledge-base.json";
import { generateId } from "@/lib/training/id";
import { normalizeVideoEmbedUrl } from "@/lib/training/video-embed";
import type {
  KnowledgeBaseCatalog,
  KnowledgeBaseEntry,
  KnowledgeBaseMediaType
} from "@/types/training";

const trainingDir = process.env.TRAINING_DATA_DIR?.trim()
  ? path.resolve(process.env.TRAINING_DATA_DIR.trim())
  : path.join(process.cwd(), "data", "training");

const catalogPath = path.join(trainingDir, "knowledge-base.json");

function defaultCatalog(): KnowledgeBaseCatalog {
  return seedCatalog as KnowledgeBaseCatalog;
}

function normalizeMediaType(value: unknown): KnowledgeBaseMediaType {
  return value === "video" || value === "image" ? value : "none";
}

function normalizeEntry(entry: KnowledgeBaseEntry, sortOrder: number): KnowledgeBaseEntry {
  const mediaType = normalizeMediaType(entry.mediaType);
  const mediaUrl = entry.mediaUrl?.trim() || "";
  const embedUrl = mediaType === "video" ? normalizeVideoEmbedUrl(mediaUrl) : "";

  return {
    id: entry.id?.trim() || generateId("kb"),
    question: entry.question?.trim() || `Вопрос ${sortOrder}`,
    answer: entry.answer?.trim() || "",
    category: entry.category?.trim() || undefined,
    mediaType,
    mediaUrl: mediaType === "none" ? undefined : mediaUrl || undefined,
    embedUrl: embedUrl || undefined,
    sortOrder
  };
}

export function normalizeKnowledgeBaseCatalog(
  catalog: Partial<KnowledgeBaseCatalog> | null | undefined
): KnowledgeBaseCatalog {
  const fallback = defaultCatalog();
  const entries = Array.isArray(catalog?.entries) ? catalog.entries : fallback.entries;

  return {
    version: 1,
    entries: entries.map((entry, index) => normalizeEntry(entry, index + 1))
  };
}

async function readCatalogFile(): Promise<KnowledgeBaseCatalog | null> {
  try {
    const raw = await readFile(catalogPath, "utf8");
    const parsed = JSON.parse(raw) as Partial<KnowledgeBaseCatalog>;
    return normalizeKnowledgeBaseCatalog(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!message.includes("ENOENT")) {
      console.warn("Failed to read knowledge base, using seed:", message);
    }
    return null;
  }
}

async function writeCatalogFile(catalog: KnowledgeBaseCatalog) {
  await mkdir(trainingDir, { recursive: true });
  await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
}

export async function readKnowledgeBaseCatalog(): Promise<KnowledgeBaseCatalog> {
  const stored = await readCatalogFile();
  if (stored) return stored;

  const seed = defaultCatalog();
  await writeCatalogFile(seed);
  return seed;
}

export async function saveKnowledgeBaseCatalog(catalog: Partial<KnowledgeBaseCatalog>) {
  const normalized = normalizeKnowledgeBaseCatalog(catalog);
  await writeCatalogFile(normalized);
  return normalized;
}
