import assert from "node:assert/strict";
import { buildSectionFunnel, LANDING_DEPTH } from "../lib/architecture-depth/sections";

const rows = buildSectionFunnel({
  hero: 100,
  problem: 40,
  cannot_buy: 40
});

assert.equal(rows.length, 10);
assert.equal(rows[0]?.users, 100);
assert.equal(rows[0]?.shareOfHero, 1);
assert.equal(rows[0]?.dropFromPrevious, null);
assert.equal(rows[1]?.users, 40);
assert.equal(rows[1]?.shareOfHero, 0.4);
assert.equal(rows[1]?.dropFromPrevious, 0.6);
assert.equal(rows[2]?.dropFromPrevious, 0);
assert.equal(rows[3]?.users, 0);
assert.equal(rows[9]?.id, "application");

for (const landing of Object.values(LANDING_DEPTH)) {
  assert.equal(landing.sections[0]?.id, "hero");
  assert.equal(new Set(landing.sections.map((section) => section.id)).size, landing.sections.length);
}

console.log("architecture depth funnel ok");
