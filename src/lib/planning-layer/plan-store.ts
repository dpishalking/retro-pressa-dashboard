import path from "node:path";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import type { PeriodKey } from "@/types/metrics";
import { buildDefaultPlanDocument } from "./default-plan";
import type { PlanDocument } from "./types";

const planDir = path.join(process.cwd(), "data", "plans");

export async function readPlanDocument(period: PeriodKey): Promise<PlanDocument> {
  const filePath = path.join(planDir, `${period}.json`);
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as PlanDocument;
  } catch {
    return buildDefaultPlanDocument(period);
  }
}

export async function writePlanDocument(plan: PlanDocument): Promise<PlanDocument> {
  await mkdir(planDir, { recursive: true });
  const payload = { ...plan, updatedAt: new Date().toISOString() };
  await writeFile(path.join(planDir, `${plan.period}.json`), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return payload;
}
