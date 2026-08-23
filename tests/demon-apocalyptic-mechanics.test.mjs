import assert from "node:assert/strict";
import { DEMON_APOCALYPTIC_FORMS } from "../scripts/data/demon/demon-apocalyptic-forms.mjs";
import { DEMON_APOCALYPTIC_MECHANICS, getActiveDemonFormSummary, getDemonFormAbilityMechanic } from "../scripts/data/demon/demon-apocalyptic-mechanics.mjs";

assert.deepEqual(Object.keys(DEMON_APOCALYPTIC_MECHANICS).sort(), Object.keys(DEMON_APOCALYPTIC_FORMS).sort());

for (const [loreKey, form] of Object.entries(DEMON_APOCALYPTIC_FORMS)) {
  const mechanics = DEMON_APOCALYPTIC_MECHANICS[loreKey];
  assert.equal(mechanics.low.length, form.abilities.length, `${loreKey}: low-Torment coverage`);
  assert.equal(mechanics.high.length, form.highTormentAbilities.length, `${loreKey}: high-Torment coverage`);
  for (const [tier, abilities] of [["low", form.abilities], ["high", form.highTormentAbilities]]) {
    abilities.forEach((description, index) => {
      const mechanic = getDemonFormAbilityMechanic(loreKey, tier, index);
      assert.ok(mechanic, `${loreKey}:${tier}:${index} mechanic exists`);
      assert.equal(mechanic.id, `${tier}-${index}`);
      assert.equal(mechanic.label, description.split(":")[0].trim());
    });
  }
}

assert.equal(getDemonFormAbilityMechanic("flame", "low", 3).initiative, 2);
assert.equal(getDemonFormAbilityMechanic("forge", "high", 3).armor.dice, 4);
assert.equal(getDemonFormAbilityMechanic("forge", "high", 3).armor.aggravated, true);
assert.equal(getDemonFormAbilityMechanic("awakening", "high", 1).healthLevels, 3);
assert.equal(getDemonFormAbilityMechanic("earth", "low", 1).immunities[0], "bashing");
assert.equal(getDemonFormAbilityMechanic("patterns", "high", 1).extraActions.costPerAction, 1);

const activeActor = (primaryLore, torment = 0, highTormentSelected = []) => ({
  system: {
    creation: { primaryLore },
    resources: { torment: { max: torment } },
    apocalypticForm: { active: true, highTormentSelected }
  }
});

assert.equal(getActiveDemonFormSummary(activeActor("flame")).initiative, 2);
assert.equal(getActiveDemonFormSummary(activeActor("awakening", 8, ["1"])).healthLevels, 3);
assert.deepEqual(getActiveDemonFormSummary(activeActor("earth")).immunities, ["bashing"]);
assert.equal(getActiveDemonFormSummary(activeActor("forge", 8, ["3"])).aggravatedArmor, 4);
assert.equal(getActiveDemonFormSummary(activeActor("patterns", 8, ["1"])).extraActions, true);
assert.equal(getActiveDemonFormSummary({ system: { apocalypticForm: { active: false } } }).abilities.length, 0);

console.log("✓ demon apocalyptic mechanics tests passed");
