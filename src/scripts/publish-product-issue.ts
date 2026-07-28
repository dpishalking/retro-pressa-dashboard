#!/usr/bin/env npx tsx
/**
 * Convert a local PDF into a product issue pack for deploy.
 *
 * Usage:
 *   npm run publish:product -- --pdf "/path/to/file.pdf" --title "…" --slug …
 */
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { convertPdfToIssuePages } from "@/lib/products/convert-pdf";
import { isValidSlug, slugifyTitle } from "@/lib/products/slug";
import { getIssueDir } from "@/lib/products/store";
import { rm } from "node:fs/promises";

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
  const issueDir = getIssueDir(slug);
  if (hasFlag("--force")) {
    await rm(issueDir, { recursive: true, force: true });
  }

  console.log(`Converting «${title}» → ${slug} (${(pdfBuffer.length / 1024 / 1024).toFixed(1)} MB)`);
  const { manifest } = await convertPdfToIssuePages({ slug, title, pdfBuffer });
  console.log(`  pages: ${manifest.pageCount} (${manifest.pageWidth}×${manifest.pageHeight})`);

  // Prebuild light display variants so first mobile/desktop open is fast.
  const { readIssuePageFile, readOrCreateResizedPage } = await import("@/lib/products/store");
  for (const width of [1000, 1400]) {
    process.stdout.write(`  cache w${width}:`);
    for (let i = 1; i <= manifest.pageCount; i++) {
      const pageFile = `page-${String(i).padStart(2, "0")}.webp`;
      const source = await readIssuePageFile(slug, pageFile);
      if (!source) continue;
      await readOrCreateResizedPage({ slug, pageFile, width, source });
      process.stdout.write(` ${i}`);
    }
    process.stdout.write("\n");
  }

  const packDir = path.join(process.cwd(), ".cache", "product-packs");
  await mkdir(packDir, { recursive: true });
  const packPath = path.join(packDir, `${slug}.tar.gz`);
  const pack = spawnSync(
    "tar",
    [
      "-czf",
      packPath,
      "-C",
      path.dirname(issueDir),
      `--exclude=${path.basename(issueDir)}/source.pdf`,
      path.basename(issueDir)
    ],
    { stdio: "inherit" }
  );
  if (pack.status !== 0) {
    throw new Error("Failed to create tar.gz pack");
  }

  console.log("\nReady:");
  console.log(`  issue: ${issueDir}`);
  console.log(`  pack:  ${packPath}`);
  console.log(`  view:  https://rp-bi.site/view/${slug}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
