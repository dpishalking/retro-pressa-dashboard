import assert from "node:assert/strict";
import { buildSectionFunnel } from "../lib/architecture-depth/sections";

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

console.log("architecture depth funnel ok");
