import assert from "node:assert/strict";
import fs from "node:fs";
import { deriveVampireRollEffect, getVampireRollEffects } from "../scripts/data/vampire/vampire-roll-effects.mjs";

const catalog = JSON.parse(fs.readFileSync(new URL("../data/vtm-revised-merits-flaws.generated.json", import.meta.url), "utf8"));
const records = [...catalog.merits, ...catalog.flaws];
assert.equal(records.length, 364);
for (const entry of records) {
  assert.equal(typeof entry.effect?.appliesToRoll, "boolean", `No roll audit: ${entry.name}`);
  assert.ok(Array.isArray(entry.effect?.selectors), `No selectors: ${entry.name}`);
}
const rollEntries = records.filter(entry => entry.effect.appliesToRoll);
assert.deepEqual(rollEntries.filter(entry => !entry.effect.selectors.length).map(entry => entry.name), []);
assert.deepEqual(rollEntries.filter(entry => entry.effect.selectors.includes("*")).map(entry => entry.name), ["Сорвиголова"]);

const leader = deriveVampireRollEffect({ system: { description: { system: "Вы получаете два дополнительных кубика на броски Лидерства." } } });
assert.equal(leader.dice, 2);
assert.ok(leader.selectors.includes("ability.talents.leadership"));

const flaw = { id: "f1", type: "flaw", name: "Робость", system: { effect: { appliesToRoll: true, selectors: ["attribute.social.*"], difficultyModifier: 2, diceModifier: 0, notes: "С незнакомцами." } } };
const effects = getVampireRollEffects({ items: [flaw] }, ["attribute.social.charisma", "ability.talents.empathy"]);
assert.equal(effects.length, 1);
assert.equal(effects[0].difficulty, 2);

const balance = { id: "m1", type: "merit", name: "Кошачье равновесие", system: { description: { system: "Снижает сложность всех бросков, связанных с удержанием равновесия (Ловкость + Атлетика), на два." } } };
assert.equal(getVampireRollEffects({ items: [balance] }, ["attribute.social.charisma"]).length, 0);
assert.equal(getVampireRollEffects({ items: [balance] }, ["attribute.physical.dexterity"]).length, 0);
assert.equal(getVampireRollEffects({ items: [balance] }, ["ability.talents.athletics"]).length, 0);
assert.equal(getVampireRollEffects({ items: [balance] }, ["attribute.physical.dexterity", "ability.talents.athletics"]).length, 1);
assert.ok(!deriveVampireRollEffect(balance).selectors.includes("*"));
assert.equal(deriveVampireRollEffect(balance).matchAll, true);

const catalogBalance = catalog.merits.find(entry => entry.name === "Кошачье равновесие");
assert.deepEqual(catalogBalance.effect.selectors.sort(), ["ability.talents.athletics", "attribute.physical.dexterity"].sort());
assert.equal(catalogBalance.effect.matchAll, true);
const catalogBalanceItem = { id: "catalog-balance", type: "merit", name: catalogBalance.name, system: catalogBalance };
assert.equal(getVampireRollEffects({ items: [catalogBalanceItem] }, ["attribute.physical.strength"]).length, 0);
const legacyGrace = { id: "legacy-grace", type: "merit", name: "Кошачья грация", system: { description: { value: "", system: "" } } };
assert.equal(getVampireRollEffects({ items: [legacyGrace] }, ["attribute.physical.strength"]).length, 0);
assert.equal(getVampireRollEffects({ items: [legacyGrace] }, ["attribute.physical.dexterity", "ability.talents.athletics"]).length, 1);

console.log(`Vampire roll effects: ${records.length} records audited.`);
