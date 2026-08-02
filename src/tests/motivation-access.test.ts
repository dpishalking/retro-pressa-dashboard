import assert from "node:assert/strict";
import { canAccessRoute, canSeeOfficeSection } from "@/lib/auth/access";
import { canManageMotivation, canViewMotivation } from "@/lib/motivation/access";

assert.equal(canAccessRoute("mop", "/motivation"), true);
assert.equal(canSeeOfficeSection("mop", "/motivation"), true);
assert.equal(canViewMotivation("mop"), true);
assert.equal(canManageMotivation("mop"), false);

assert.equal(canAccessRoute("rop", "/motivation"), true);
assert.equal(canViewMotivation("rop"), true);
assert.equal(canManageMotivation("rop"), true);

assert.equal(canAccessRoute("admin", "/motivation"), true);
assert.equal(canViewMotivation("admin"), true);

console.log("motivation-access tests passed");
