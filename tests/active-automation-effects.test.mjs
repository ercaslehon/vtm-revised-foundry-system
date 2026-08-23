import assert from "node:assert/strict";
import { activeAutomationEffects, activeAutomationRollModifier } from "../scripts/utils/active-automation-effects.mjs";

const actor = {
  effects: [
    { id: "modern", name: "Точность", img: "", disabled: false, flags: { "vtm-revised": { type: "automationEffect", itemUuid: "Item.same", target: "attribute.physical.*", diceModifier: 2, difficultyModifier: -1 } } }
  ],
  system: { automation: { activeEffects: [
    { id: "duplicate", name: "Старая копия", itemUuid: "Item.same", target: "*", diceModifier: 10, difficultyModifier: 0 },
    { id: "legacy", name: "Помеха", itemUuid: "Item.other", target: "ability.talents.brawl", diceModifier: -1, difficultyModifier: 1 }
  ] } }
};

assert.equal(activeAutomationEffects(actor).length, 2, "modern effect replaces its legacy duplicate");
assert.deepEqual(activeAutomationRollModifier(actor, ["attribute.physical.dexterity"]), {
  dice: 2,
  difficulty: -1,
  effects: [activeAutomationEffects(actor)[0]]
});
const brawl = activeAutomationRollModifier(actor, ["ability.talents.brawl"]);
assert.equal(brawl.dice, -1);
assert.equal(brawl.difficulty, 1);

console.log("✓ active automation effects tests passed");
