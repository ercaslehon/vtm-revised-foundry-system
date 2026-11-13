import assert from "node:assert/strict";
import { rollDicePool } from "../scripts/dice/dice-pool.mjs";
let values = [], message;
globalThis.Roll = class {
  async evaluate() { this.dice = [{ results: values.map(result => ({ result })) }]; return this; }
  async toMessage(data) { message = data; return data; }
};
globalThis.ChatMessage = { getSpeaker: () => ({}), create: async data => { message = data; return data; } };
globalThis.renderTemplate = async () => "";
globalThis.Hooks = { on() {} };
const { getRepeatParameters } = await import("../scripts/dice/repeat-roll.mjs");
for (const rollKind of ["action", "damage", "soak"]) {
  for (const difficulty of [6, 8, 10]) {
    values = [10];
    assert.equal((await rollDicePool({ rollKind, difficulty })).successes, 2, "10 always counts twice, even on damage and soak");
    values = [10, 1];
    assert.equal((await rollDicePool({ rollKind, difficulty, pool: 2 })).successes, 1);
    values = [1, 2];
    const result = await rollDicePool({ rollKind, difficulty, pool: 2 });
    assert.equal(result.successes, 0);
    assert.equal(result.botch, rollKind === "action");
    const repeat = getRepeatParameters(message);
    assert.equal(repeat.rollKind, rollKind);
    assert.equal((await rollDicePool(repeat)).botch, rollKind === "action", "repeat preserves no-botch rule");
    values = [10, 1, 1];
    assert.equal((await rollDicePool({ rollKind, difficulty, pool: 3 })).botch, false);
  }
}
console.log("✓ damage/soak cannot botch; tens count twice; repeat preserves roll kind");
