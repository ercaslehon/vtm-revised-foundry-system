import assert from "node:assert/strict";
import { VTM_REVISED } from "../scripts/config.mjs";
import { DEMON_ABILITY_CATEGORIES, DEMON_ABILITY_LABELS } from "../scripts/data/demon/demon-abilities.mjs";
import { getTraitReference } from "../scripts/data/trait-reference.mjs";
import { TRAIT_SOURCE_TEXT } from "../scripts/data/trait-source-text.generated.mjs";

const attributeKeys = Object.values(VTM_REVISED.attributeCategories).flat();
const abilityKeys = new Set([
  ...Object.values(VTM_REVISED.abilityCategories).flat(),
  ...Object.values(DEMON_ABILITY_CATEGORIES).flat()
]);

for (const key of attributeKeys) {
  const entry = getTraitReference("attribute", key, key);
  assert.notEqual(entry.summary, "Базовая врождённая характеристика персонажа.", `Missing attribute reference: ${key}`);
  assert.ok(entry.examples.length > 20, `Attribute examples are too short: ${key}`);
}

for (const key of abilityKeys) {
  const entry = getTraitReference("ability", key, DEMON_ABILITY_LABELS[key] ?? key);
  assert.notEqual(entry.summary, "Обучение или практический опыт в выбранной области.", `Missing ability reference: ${key}`);
  assert.ok(entry.examples.length > 20, `Ability examples are too short: ${key}`);
}

const awareness = getTraitReference("ability", "awareness", "Осведомлённость");
assert.match(awareness.summary, /сверхъестествен/i);
assert.equal(awareness.summary, TRAIT_SOURCE_TEXT.demon.ability.awareness.summary);
assert.equal(getTraitReference("attribute", "strength", "", { demon: true }).summary, TRAIT_SOURCE_TEXT.demon.attribute.strength.summary);
assert.notEqual(getTraitReference("attribute", "strength").summary, getTraitReference("attribute", "strength", "", { demon: true }).summary);

console.log(`Trait references: ${attributeKeys.length} attributes, ${abilityKeys.size} abilities.`);
