import fs from "node:fs/promises";
import path from "node:path";
import seedSnapshot from "../../../data/product-passports/dashboard.json";
import type { PassportDashboardSnapshot } from "@/types/product-passports";

function resolveSnapshotPath() {
  const fromEnv = process.env.PRODUCT_PASSPORTS_DATA_DIR?.trim();
  if (fromEnv) return path.join(path.resolve(fromEnv), "dashboard.json");
  return path.join(process.cwd(), "data", "product-passports", "dashboard.json");
}

function normalizeSnapshot(raw: unknown): PassportDashboardSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const parsed = raw as PassportDashboardSnapshot;
  if (!Array.isArray(parsed.products)) return null;
  return parsed;
}

export async function readPassportDashboardSnapshot(): Promise<PassportDashboardSnapshot | null> {
  const snapshotPath = resolveSnapshotPath();
  try {
    const raw = await fs.readFile(snapshotPath, "utf8");
    const fromDisk = normalizeSnapshot(JSON.parse(raw));
    if (fromDisk) return fromDisk;
  } catch {
    // fall through to bundled seed
  }

  return normalizeSnapshot(seedSnapshot);
}

export function passportDashboardSnapshotPath() {
  return resolveSnapshotPath();
}
