import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PeriodKey } from "@/types/metrics";
import type { CompanySnapshot } from "./types";

const snapshotDir = path.join(process.cwd(), "data", "company-snapshots");

export function companySnapshotPath(period: PeriodKey) {
  return path.join(snapshotDir, `${period}.json`);
}

async function ensureDir() {
  await mkdir(snapshotDir, { recursive: true });
}

export async function readCompanySnapshot(period: PeriodKey): Promise<CompanySnapshot | null> {
  try {
    const raw = await readFile(companySnapshotPath(period), "utf8");
    const parsed = JSON.parse(raw) as Partial<CompanySnapshot>;
    if (parsed?.version !== 1 || parsed.meta?.period !== period || !parsed.canonical) {
      return null;
    }
    return parsed as CompanySnapshot;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("ENOENT")) return null;
    return null;
  }
}

export async function writeCompanySnapshot(snapshot: CompanySnapshot) {
  await ensureDir();
  await writeFile(companySnapshotPath(snapshot.meta.period), JSON.stringify(snapshot, null, 2), "utf8");
}
