import assert from "node:assert/strict";
import { getDriverBounds, clampDriverValue } from "@/lib/digital-twin/driver-bounds";
import { DRIVER_CATALOG } from "@/lib/digital-twin/drivers";

const cpl = DRIVER_CATALOG.find((d) => d.id === "cpl")!;
const bounds = getDriverBounds(cpl);

assert.equal(bounds.min, 0.75);
assert.equal(bounds.max, 9);
assert.equal(clampDriverValue(cpl, 5), 5);
assert.equal(clampDriverValue(cpl, 999), 9);

let value = cpl.actual;
for (let i = 0; i < 20; i++) {
  value = clampDriverValue(cpl, bounds.max);
  const nextBounds = getDriverBounds({ ...cpl, actual: value });
  assert.equal(nextBounds.max, bounds.max, "bounds must stay stable when actual changes");
}

console.log("driver-bounds tests passed");
