import fs from "node:fs/promises";
import path from "node:path";
import type { PassportDashboardSnapshot } from "@/types/product-passports";

const SNAPSHOT_PATH = path.join(process.cwd(), "data/product-passports/dashboard.json");

export async function readPassportDashboardSnapshot(): Promise<PassportDashboardSnapshot | null> {
  try {
    const raw = await fs.readFile(SNAPSHOT_PATH, "utf8");
    const parsed = JSON.parse(raw) as PassportDashboardSnapshot;
    if (!parsed || !Array.isArray(parsed.products)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function passportDashboardSnapshotPath() {
  return SNAPSHOT_PATH;
}
