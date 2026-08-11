import assert from "node:assert/strict";
import { parseList2Plans } from "@/lib/marketing-planning/load-marketing-predictive";

const sample: string[][] = [
  ["Категория", "Метрика", "Показатель", "Владелец", "План Август", "W1", "W2", "W3", "W4", "W5", "Итог"],
  ["Маркетинг", "[Lag] Выручка, €", "План", "", "46 676", "—", "—", "—", "—", "—", "46 676"],
  ["", "", "Факт", "", "—", "—", "—", "—", "—", "—", "—"],
  ["Маркетинг", "[Lead 1] Лиды, шт.", "План", "", "3 334", "—", "—", "—", "—", "—", "3 334"],
  ["", "", "Факт", "", "—", "—", "—", "—", "—", "—", "—"],
  ["Маркетинг", "[Lead 2] Facebook — лиды, шт.", "План", "", "2 667", "—", "—", "—", "—", "—", "2 667"],
  ["Маркетинг", "[Capacity] Paid media budget, €", "План", "", "4 500", "—", "—", "—", "—", "—", "4 500"],
  ["Маркетинг", "[Lag] Blended ROAS, %", "План", "", "1 037%", "—", "—", "—", "—", "—", "1 037%"]
];

const plans = parseList2Plans(sample);
assert.equal(plans.get("paid_revenue")?.plan, 46676);
assert.equal(plans.get("leads")?.plan, 3334);
assert.equal(plans.get("facebook_leads")?.plan, 2667);
assert.equal(plans.get("spend")?.plan, 4500);
assert.ok(plans.get("roas")?.plan != null && plans.get("roas")!.plan! > 10);

console.log("marketing-predictive-list2.test.ts: ok");
