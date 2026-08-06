import { readFile } from "node:fs/promises";
import path from "node:path";
import type { PartnerCatalogProduct, PartnerFaqItem, PartnerMaterial } from "@/types/partners";

const contentDir = path.join(process.cwd(), "data", "partners");

async function readJsonArray<T>(fileName: string): Promise<T[]> {
  const raw = await readFile(path.join(contentDir, fileName), "utf8");
  const parsed = JSON.parse(raw) as unknown;
  return Array.isArray(parsed) ? (parsed as T[]) : [];
}

export async function listPartnerCatalog(): Promise<PartnerCatalogProduct[]> {
  return readJsonArray<PartnerCatalogProduct>("catalog.json");
}

export async function listPartnerMaterials(): Promise<PartnerMaterial[]> {
  return readJsonArray<PartnerMaterial>("materials.json");
}

export async function listPartnerFaq(): Promise<PartnerFaqItem[]> {
  return readJsonArray<PartnerFaqItem>("faq.json");
}
