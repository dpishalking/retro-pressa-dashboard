import assert from "node:assert/strict";
import { buildFallbackCompanySnapshot } from "@/lib/company-snapshot/fallback";
import { snapshotToDriverInputs } from "@/lib/company-snapshot/to-drivers";
import { applyOverrides } from "@/lib/digital-twin/drivers";
import { generateRecommendations } from "@/lib/digital-twin/recommendations";

const snapshot = buildFallbackCompanySnapshot("june-2026");
const baselineDrivers = snapshotToDriverInputs(snapshot);

const atZeroDefect = applyOverrides(baselineDrivers, { defectRate: 0 });
const recs = generateRecommendations(atZeroDefect, snapshot, { defectRate: 0 });

assert.ok(!recs.some((rec) => rec.driverId === "defectRate"), "defect recommendation should disappear at 0%");

const baselineRecs = generateRecommendations(baselineDrivers, snapshot, {});
const defectRec = baselineRecs.find((rec) => rec.driverId === "defectRate");
assert.ok(defectRec, "defect recommendation should exist on baseline");

console.log("recommendations tests passed");
