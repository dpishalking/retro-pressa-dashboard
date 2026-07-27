import { access, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ProductIssueManifest, ProductIssueSummary } from "@/types/products";
import { PRODUCT_VIEW_PUBLIC_PREFIX } from "@/lib/auth/routes";

const productsDir = process.env.PRODUCTS_DATA_DIR?.trim()
  ? path.resolve(process.env.PRODUCTS_DATA_DIR.trim())
  : path.join(process.cwd(), "data", "products");

const issuesDir = path.join(productsDir, "issues");

export function getProductsRootDir() {
  return productsDir;
}

export function getIssueDir(slug: string) {
  return path.join(issuesDir, slug);
}

export function getManifestPath(slug: string) {
  return path.join(getIssueDir(slug), "manifest.json");
}

export function getPagesDir(slug: string) {
  return path.join(getIssueDir(slug), "pages");
}

export function getSourcePdfPath(slug: string) {
  return path.join(getIssueDir(slug), "source.pdf");
}

export function publicPageUrl(slug: string, page: number, version?: string) {
  const base = `/api/products/public/${encodeURIComponent(slug)}/pages/${String(page).padStart(2, "0")}`;
  if (!version) return base;
  return `${base}?v=${encodeURIComponent(version)}`;
}

export function publicViewPath(slug: string) {
  return `${PRODUCT_VIEW_PUBLIC_PREFIX}/${encodeURIComponent(slug)}`;
}

async function ensureProductsDirs() {
  await mkdir(issuesDir, { recursive: true });
}

async function pathExists(target: string) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

export async function listProductIssues(): Promise<ProductIssueSummary[]> {
  await ensureProductsDirs();
  const entries = await readdir(issuesDir, { withFileTypes: true }).catch(() => []);
  const items: ProductIssueSummary[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const manifest = await readProductManifest(entry.name);
    if (!manifest) continue;
    items.push({
      slug: manifest.slug,
      title: manifest.title,
      createdAt: manifest.createdAt,
      updatedAt: manifest.updatedAt,
      pageCount: manifest.pageCount,
      viewPath: publicViewPath(manifest.slug),
      status: manifest.status ?? (manifest.pageCount > 0 ? "ready" : "processing"),
      errorMessage: manifest.errorMessage
    });
  }

  items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return items;
}

export async function readProductManifest(slug: string): Promise<ProductIssueManifest | null> {
  try {
    const raw = await readFile(getManifestPath(slug), "utf8");
    const parsed = JSON.parse(raw) as ProductIssueManifest;
    if (parsed?.version !== 1 || !parsed.slug || !Array.isArray(parsed.pages)) return null;
    if (!parsed.status) {
      parsed.status = parsed.pageCount > 0 ? "ready" : "processing";
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function writeProductManifest(manifest: ProductIssueManifest) {
  await ensureProductsDirs();
  await mkdir(getIssueDir(manifest.slug), { recursive: true });
  await writeFile(getManifestPath(manifest.slug), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

export async function issueExists(slug: string) {
  return pathExists(getManifestPath(slug));
}

export async function deleteProductIssue(slug: string) {
  const dir = getIssueDir(slug);
  if (!(await pathExists(dir))) return false;
  await rm(dir, { recursive: true, force: true });
  return true;
}

export async function readIssuePageFile(slug: string, pageFile: string): Promise<Buffer | null> {
  if (!/^page-\d{2}\.webp$/.test(pageFile)) return null;
  const filePath = path.join(getPagesDir(slug), pageFile);
  try {
    return await readFile(filePath);
  } catch {
    return null;
  }
}
