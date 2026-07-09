import assert from "node:assert/strict";
import {
  getDriverBounds,
  clampDriverValue,
  driverValueFromInput,
  driverValueToInput,
  normalizeDriverInput,
  roundDriverValue
} from "@/lib/digital-twin/driver-bounds";
import { DRIVER_CATALOG } from "@/lib/digital-twin/drivers";

const formatNumber = (value: number, digits: number) => value.toFixed(digits).replace(".", ",");

const cpl = DRIVER_CATALOG.find((d) => d.id === "cpl")!;
const bounds = getDriverBounds(cpl);

assert.equal(bounds.min, 0.75);
assert.equal(bounds.max, 9);
assert.equal(bounds.step, 0.1);
assert.equal(clampDriverValue(cpl, 5), 5);
assert.equal(clampDriverValue(cpl, 999), 9);

assert.equal(driverValueFromInput(cpl, "1,3"), 1.3);
assert.equal(driverValueFromInput(cpl, "1.7"), 1.7);
assert.equal(normalizeDriverInput(cpl, "1,7"), 1.7);
assert.equal(driverValueToInput(cpl, 1.3, formatNumber), "1,3");

const conversion = DRIVER_CATALOG.find((d) => d.id === "salesConversion")!;
assert.equal(driverValueFromInput(conversion, "16,8"), 0.168);
assert.equal(roundDriverValue(conversion, 0.1684), 0.168);

let value = cpl.actual;
for (let i = 0; i < 20; i++) {
  value = clampDriverValue(cpl, bounds.max);
  const nextBounds = getDriverBounds({ ...cpl, actual: value });
  assert.equal(nextBounds.max, bounds.max, "bounds must stay stable when actual changes");
}

console.log("driver-bounds tests passed");
