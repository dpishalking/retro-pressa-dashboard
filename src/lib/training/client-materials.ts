import { readFile } from "node:fs/promises";
import path from "node:path";
import clientMaterialsCatalog from "../../../data/training/client-materials.json";
import type { ClientMaterial, ClientMaterialsCatalog } from "@/types/training";

const catalog = clientMaterialsCatalog as ClientMaterialsCatalog;

export function listClientMaterials(): ClientMaterial[] {
  return [...catalog.materials].sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getClientMaterial(materialId: string): ClientMaterial | null {
  const normalized = materialId.trim();
  if (!normalized) return null;
  return catalog.materials.find((material) => material.id === normalized) ?? null;
}

function extensionFromSource(source: string) {
  try {
    const url = new URL(source.startsWith("http") ? source : `https://rp-bi.site${source}`);
    return path.extname(url.pathname);
  } catch {
    return path.extname(source);
  }
}

export function buildClientMaterialFilename(material: ClientMaterial) {
  const extension = extensionFromSource(material.downloadUrl ?? material.url) || ".jpg";
  return `${material.id}${extension}`;
}

export async function readLocalClientMaterial(source: string) {
  const publicDir = path.join(process.cwd(), "public");
  const filePath = path.resolve(publicDir, source.replace(/^\//, ""));

  if (!filePath.startsWith(publicDir)) {
    throw new Error("Недопустимый путь к файлу.");
  }

  return readFile(filePath);
}
