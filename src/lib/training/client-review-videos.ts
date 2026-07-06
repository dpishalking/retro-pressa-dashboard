import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import seedCatalog from "../../../data/training/client-review-videos.json";
import { generateId } from "@/lib/training/id";
import { normalizeVideoEmbedUrl } from "@/lib/training/video-embed";
import type { TrainingClientReviewCatalog, TrainingClientReviewVideo } from "@/types/training";

const trainingDir = process.env.TRAINING_DATA_DIR?.trim()
  ? path.resolve(process.env.TRAINING_DATA_DIR.trim())
  : path.join(process.cwd(), "data", "training");

const catalogPath = path.join(trainingDir, "client-review-videos.json");

function defaultCatalog(): TrainingClientReviewCatalog {
  return seedCatalog as TrainingClientReviewCatalog;
}

function normalizeVideo(video: TrainingClientReviewVideo, sortOrder: number): TrainingClientReviewVideo {
  const source = video.url?.trim() || video.embedUrl?.trim() || "";
  const embedUrl = normalizeVideoEmbedUrl(source);

  return {
    id: video.id?.trim() || generateId("client-review"),
    title: video.title?.trim() || `Отзыв ${sortOrder}`,
    url: source || undefined,
    embedUrl: embedUrl || video.embedUrl?.trim() || "",
    sortOrder
  };
}

export function normalizeClientReviewCatalog(
  catalog: Partial<TrainingClientReviewCatalog> | null | undefined
): TrainingClientReviewCatalog {
  const fallback = defaultCatalog();
  const videos = Array.isArray(catalog?.videos) ? catalog.videos : fallback.videos;

  return {
    version: 1,
    sectionTitle: catalog?.sectionTitle?.trim() || fallback.sectionTitle,
    videos: videos
      .map((video, index) => normalizeVideo(video, index + 1))
      .filter((video) => video.embedUrl)
  };
}

async function readCatalogFile(): Promise<TrainingClientReviewCatalog | null> {
  try {
    const raw = await readFile(catalogPath, "utf8");
    const parsed = JSON.parse(raw) as Partial<TrainingClientReviewCatalog>;
    return normalizeClientReviewCatalog(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!message.includes("ENOENT")) {
      console.warn("Failed to read client review videos, using seed:", message);
    }
    return null;
  }
}

async function writeCatalogFile(catalog: TrainingClientReviewCatalog) {
  await mkdir(trainingDir, { recursive: true });
  await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
}

export async function readClientReviewCatalog(): Promise<TrainingClientReviewCatalog> {
  const stored = await readCatalogFile();
  if (stored) return stored;

  const seed = defaultCatalog();
  await writeCatalogFile(seed);
  return seed;
}

export async function saveClientReviewCatalog(catalog: Partial<TrainingClientReviewCatalog>) {
  const normalized = normalizeClientReviewCatalog(catalog);
  await writeCatalogFile(normalized);
  return normalized;
}
