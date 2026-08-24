import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { rigaDateIso } from "@/lib/manager-cabinet/dates";

const FALLBACK_RUB_PER_EUR = 100;
const cachePath = path.join(process.cwd(), ".cache", "fx-cbr-eur.json");

type RateCache = {
  asOf: string;
  rubPerEur: number;
  source: string;
  fetchedAt: string;
};

async function readCache(asOf: string): Promise<RateCache | null> {
  try {
    const parsed = JSON.parse(await readFile(cachePath, "utf8")) as RateCache;
    if (parsed?.asOf === asOf && parsed.rubPerEur > 0) return parsed;
  } catch {
    /* miss */
  }
  return null;
}

async function writeCache(row: RateCache) {
  await mkdir(path.dirname(cachePath), { recursive: true });
  await writeFile(cachePath, JSON.stringify(row, null, 2));
}

function parseCbr(payload: unknown): number | null {
  if (!payload || typeof payload !== "object") return null;
  const eur = (payload as { Valute?: { EUR?: { Value?: number; Nominal?: number } } }).Valute?.EUR;
  const value = Number(eur?.Value);
  const nominal = Number(eur?.Nominal) || 1;
  if (!(value > 0) || !(nominal > 0)) return null;
  return value / nominal;
}

export async function loadRubPerEur(now = new Date()): Promise<{ rubPerEur: number; source: string; asOf: string }> {
  const asOf = rigaDateIso(now);
  const cached = await readCache(asOf);
  if (cached) return { rubPerEur: cached.rubPerEur, source: cached.source, asOf };

  try {
    const response = await fetch("https://www.cbr-xml-daily.ru/daily_json.js", { cache: "no-store" });
    if (!response.ok) throw new Error(`CBR ${response.status}`);
    const rubPerEur = parseCbr(await response.json());
    if (!rubPerEur) throw new Error("CBR EUR missing");
    const row = { asOf, rubPerEur, source: "cbr", fetchedAt: new Date().toISOString() };
    await writeCache(row);
    return { rubPerEur, source: "cbr", asOf };
  } catch {
    return { rubPerEur: FALLBACK_RUB_PER_EUR, source: "fallback-100", asOf };
  }
}
