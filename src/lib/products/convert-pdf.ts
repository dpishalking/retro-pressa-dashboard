import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createCanvas } from "@napi-rs/canvas";
import { getDocument, type PDFDocumentProxy } from "pdfjs-dist/legacy/build/pdf.mjs";
import sharp from "sharp";
import type { ProductIssueManifest, ProductIssuePage } from "@/types/products";
import { deimposeSaddleStitchSpreads, type RasterPage } from "@/lib/products/deimpose-booklet";
import {
  getPagesDir,
  getSourcePdfPath,
  publicPageUrl,
  readProductManifest,
  writeProductManifest
} from "@/lib/products/store";

/** Target long-edge for sharp text (≈3× print-screen quality). */
const TARGET_LONG_EDGE = 2650;
const MAX_OUTPUT_PAGES = 80;

type ConvertResult = {
  manifest: ProductIssueManifest;
};

function assertPdfMagic(buffer: Buffer) {
  const head = buffer.subarray(0, 5).toString("utf8");
  if (head !== "%PDF-") {
    throw new Error("Файл не похож на PDF");
  }
}

async function renderPageToRaster(doc: PDFDocumentProxy, pageNumber: number): Promise<RasterPage> {
  const page = await doc.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const longEdge = Math.max(base.width, base.height);
  const scale = Math.min(3.2, Math.max(2, TARGET_LONG_EDGE / longEdge));
  const viewport = page.getViewport({ scale });

  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({
    canvas: canvas as unknown as HTMLCanvasElement,
    canvasContext: context as unknown as CanvasRenderingContext2D,
    viewport
  }).promise;

  const png = canvas.toBuffer("image/png");
  const webp = await sharp(png).webp({ quality: 90, effort: 4 }).toBuffer();
  return { buffer: webp, width: canvas.width, height: canvas.height };
}

async function rasterizePdfBuffer(opts: {
  slug: string;
  title: string;
  pdfBuffer: Buffer;
  createdAt: string;
}): Promise<ProductIssueManifest> {
  assertPdfMagic(opts.pdfBuffer);

  const pagesDir = getPagesDir(opts.slug);
  await mkdir(pagesDir, { recursive: true });
  // Drop previous rasterization so page count changes don't leave stale files.
  const { readdir, unlink } = await import("node:fs/promises");
  for (const name of await readdir(pagesDir).catch(() => [])) {
    if (name.endsWith(".webp")) await unlink(path.join(pagesDir, name));
  }

  const loadingTask = getDocument({
    data: new Uint8Array(opts.pdfBuffer),
    useSystemFonts: true
  });
  const doc = await loadingTask.promise;

  if (doc.numPages < 1) {
    throw new Error("В PDF нет страниц");
  }
  if (doc.numPages > MAX_OUTPUT_PAGES) {
    throw new Error(`Слишком много страниц PDF (максимум ${MAX_OUTPUT_PAGES})`);
  }

  const spreads: RasterPage[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    spreads.push(await renderPageToRaster(doc, i));
  }

  const rasters = await deimposeSaddleStitchSpreads(spreads);
  if (rasters.length > MAX_OUTPUT_PAGES) {
    throw new Error(`Слишком много страниц после разбора спуска (максимум ${MAX_OUTPUT_PAGES})`);
  }

  const pages: ProductIssuePage[] = [];
  let pageWidth = 0;
  let pageHeight = 0;

  for (let i = 0; i < rasters.length; i++) {
    const rendered = rasters[i];
    if (!pageWidth) {
      pageWidth = rendered.width;
      pageHeight = rendered.height;
    }
    const pageNumber = i + 1;
    const file = `page-${String(pageNumber).padStart(2, "0")}.webp`;
    await writeFile(path.join(pagesDir, file), rendered.buffer);
    pages.push({
      page: pageNumber,
      file,
      src: publicPageUrl(opts.slug, pageNumber)
    });
  }

  const now = new Date().toISOString();
  return {
    version: 1,
    slug: opts.slug,
    title: opts.title,
    createdAt: opts.createdAt,
    updatedAt: now,
    pageCount: pages.length,
    pageWidth,
    pageHeight,
    sourceFile: "source.pdf",
    pages,
    status: "ready"
  };
}

/** Save PDF and write a processing placeholder (fast path for upload response). */
export async function saveUploadedPdfDraft(opts: {
  slug: string;
  title: string;
  pdfBuffer: Buffer;
}): Promise<ProductIssueManifest> {
  assertPdfMagic(opts.pdfBuffer);
  await mkdir(getPagesDir(opts.slug), { recursive: true });
  await writeFile(getSourcePdfPath(opts.slug), opts.pdfBuffer);

  const now = new Date().toISOString();
  const draft: ProductIssueManifest = {
    version: 1,
    slug: opts.slug,
    title: opts.title,
    createdAt: now,
    updatedAt: now,
    pageCount: 0,
    pageWidth: 0,
    pageHeight: 0,
    sourceFile: "source.pdf",
    pages: [],
    status: "processing"
  };
  await writeProductManifest(draft);
  return draft;
}

/** Convert a previously saved source.pdf into page images. */
export async function convertStoredIssuePdf(slug: string): Promise<ConvertResult> {
  const existing = await readProductManifest(slug);
  if (!existing) {
    throw new Error("Выпуск не найден");
  }

  const pdfBuffer = await readFile(getSourcePdfPath(slug));
  try {
    const manifest = await rasterizePdfBuffer({
      slug,
      title: existing.title,
      pdfBuffer,
      createdAt: existing.createdAt
    });
    await writeProductManifest(manifest);
    return { manifest };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка конвертации PDF";
    await writeProductManifest({
      ...existing,
      updatedAt: new Date().toISOString(),
      status: "error",
      errorMessage: message,
      pages: [],
      pageCount: 0
    });
    throw error;
  }
}

export async function convertPdfToIssuePages(opts: {
  slug: string;
  title: string;
  pdfBuffer: Buffer;
  createdAt?: string;
}): Promise<ConvertResult> {
  await saveUploadedPdfDraft(opts);
  return convertStoredIssuePdf(opts.slug);
}
