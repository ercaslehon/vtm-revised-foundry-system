import assert from "node:assert/strict";
import { activeDemonHighTormentIndexes, damageAfterSoak, demonHighTormentSlots, multipleActionPenalty, netAttackSuccesses } from "../scripts/combat/combat-math.mjs";

assert.equal(netAttackSuccesses(5, 2), 3);
assert.equal(netAttackSuccesses(2, 5), 0);
assert.equal(multipleActionPenalty(1, 0), 0);
assert.equal(multipleActionPenalty(3, 0), 3);
assert.equal(multipleActionPenalty(3, 1), 4);
assert.equal(multipleActionPenalty(3, 2), 5);
assert.equal(damageAfterSoak(5, 2), 3);
assert.equal(damageAfterSoak(5, 2, { halveBashing: true }), 1);
assert.equal(damageAfterSoak(2, 1, { halveBashing: true }), 0);
assert.equal(damageAfterSoak(2, 4, { halveBashing: true }), 0);
assert.equal(demonHighTormentSlots(6), 0);
assert.equal(demonHighTormentSlots(7), 1);
assert.equal(demonHighTormentSlots(10), 4);
assert.deepEqual(activeDemonHighTormentIndexes(8, ["2", "2", "0", "3"]), ["2", "0"]);
assert.deepEqual(activeDemonHighTormentIndexes(6, ["0"]), []);
assert.deepEqual(activeDemonHighTormentIndexes(10, ["0", "bad", "3"]), ["0", "3"]);

console.log("✓ combat math tests passed");
