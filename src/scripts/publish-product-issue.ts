#!/usr/bin/env npx tsx
/**
 * Convert a local PDF into a product issue folder, then optionally pack it for deploy.
 *
 * Usage:
 *   npx tsx --env-file=.env.local src/scripts/publish-product-issue.ts \
 *     --pdf "/path/to/file.pdf" \
 *     --title "Весёлая семейка 1" \
 *     --slug veselaya-semeika-1
 */
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createCanvas } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import sharp from "sharp";
import { isValidSlug, slugifyTitle } from "@/lib/products/slug";
import {
  getIssueDir,
  getPagesDir,
  getSourcePdfPath,
  publicPageUrl,
  writeProductManifest
} from "@/lib/products/store";
import type { ProductIssueManifest, ProductIssuePage } from "@/types/products";

const TARGET_LONG_EDGE = 2650;

function argValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function hasFlag(flag: string) {
  return process.argv.includes(flag);
}

async function main() {
  const pdfPath = argValue("--pdf");
  if (!pdfPath) {
    console.error("Missing --pdf /path/to/file.pdf");
    process.exit(1);
  }

  const title = (argValue("--title") || path.basename(pdfPath, path.extname(pdfPath))).trim();
  const slug = (argValue("--slug") || slugifyTitle(title)).toLowerCase();
  if (!isValidSlug(slug)) {
    console.error(`Invalid slug: ${slug}`);
    process.exit(1);
  }

  const pdfBuffer = await readFile(pdfPath);
  if (pdfBuffer.subarray(0, 5).toString("utf8") !== "%PDF-") {
    console.error("File does not look like a PDF");
    process.exit(1);
  }

  const issueDir = getIssueDir(slug);
  if (hasFlag("--force")) {
    await rm(issueDir, { recursive: true, force: true });
  }

  const pagesDir = getPagesDir(slug);
  await mkdir(pagesDir, { recursive: true });
  await writeFile(getSourcePdfPath(slug), pdfBuffer);

  console.log(`Converting «${title}» → ${slug} (${(pdfBuffer.length / 1024 / 1024).toFixed(1)} MB)`);

  const doc = await getDocument({
    data: new Uint8Array(pdfBuffer),
    useSystemFonts: true
  }).promise;

  if (doc.numPages < 1 || doc.numPages > 80) {
    throw new Error(`Unexpected page count: ${doc.numPages}`);
  }

  const pages: ProductIssuePage[] = [];
  let pageWidth = 0;
  let pageHeight = 0;

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
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

    const webp = await sharp(canvas.toBuffer("image/png")).webp({ quality: 90, effort: 4 }).toBuffer();
    if (!pageWidth) {
      pageWidth = canvas.width;
      pageHeight = canvas.height;
    }
    const file = `page-${String(i).padStart(2, "0")}.webp`;
    await writeFile(path.join(pagesDir, file), webp);
    pages.push({ page: i, file, src: publicPageUrl(slug, i) });
    console.log(`  page ${i}/${doc.numPages} → ${file} (${Math.round(webp.length / 1024)} KB)`);
  }

  const now = new Date().toISOString();
  const manifest: ProductIssueManifest = {
    version: 1,
    slug,
    title,
    createdAt: now,
    updatedAt: now,
    pageCount: pages.length,
    pageWidth,
    pageHeight,
    sourceFile: "source.pdf",
    pages,
    status: "ready"
  };
  await writeProductManifest(manifest);

  const packDir = path.join(process.cwd(), ".cache", "product-packs");
  await mkdir(packDir, { recursive: true });
  const packPath = path.join(packDir, `${slug}.tar.gz`);
  const { spawnSync } = await import("node:child_process");
  const pack = spawnSync(
    "tar",
    ["-czf", packPath, "-C", path.dirname(issueDir), path.basename(issueDir)],
    { stdio: "inherit" }
  );
  if (pack.status !== 0) {
    throw new Error("Failed to create tar.gz pack");
  }

  console.log("\nReady:");
  console.log(`  issue: ${issueDir}`);
  console.log(`  pack:  ${packPath}`);
  console.log(`  view:  https://rp-bi.site/view/${slug}`);
  console.log("\nNext: upload pack via GitHub Actions workflow publish-product.yml");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
