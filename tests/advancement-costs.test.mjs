import assert from "node:assert/strict";
import { advancementCost } from "../scripts/utils/advancement-costs.mjs";

assert.equal(advancementCost("ability", 0), 3);
assert.equal(advancementCost("ability", 3), 6);
assert.equal(advancementCost("attribute", 3), 12);
assert.equal(advancementCost("vampireDiscipline", 3, { inClan: true }), 15);
assert.equal(advancementCost("vampireDiscipline", 3), 21);
assert.equal(advancementCost("vampireDiscipline", 0), 10);
assert.equal(advancementCost("demonLore", 0, { ownLore: true }), 7);
assert.equal(advancementCost("demonLore", 0), 10);
assert.equal(advancementCost("demonLore", 3), 15);
assert.equal(advancementCost("tormentReduction", 8), 10);

console.log("✓ advancement cost tests passed");
