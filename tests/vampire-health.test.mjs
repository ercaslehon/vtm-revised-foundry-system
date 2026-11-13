import assert from "node:assert/strict";
import { HEALTH_KEYS, healthKeys, healthPenalty, healthCondition, wounds, editHealth, planDamage, planHealing } from "../scripts/combat/vampire-health.mjs";
import { fortitudeSoakPool } from "../scripts/combat/fortitude-soak.mjs";
function actor(values = [], condition = "active") {
  return { type: "vampire", items: [], generationCaps: { bloodPerTurn: 1 }, system: {
    health: { ...Object.fromEntries(HEALTH_KEYS.map((key, i) => [key, values[i] ?? 0])), condition, restStartedAt: -1, restCompletedAt: -1, extraHealingUsed: false },
    resources: { blood: { value: 20 }, willpower: { value: 5 } }, automation: { bloodSpentTurn: 0, physicalBoost: { stamina: 2 }, armor: { active: true, rating: 2 } },
    attributes: { physical: { stamina: 3 } }
  } };
}
function apply(a, update) {
  for (const [path, value] of Object.entries(update)) {
    const parts = path.split('.'); let target = a;
    for (const part of parts.slice(0, -1)) target = target[part] ??= {};
    target[parts.at(-1)] = value;
  }
  return a;
}
for (const type of ["bashing", "lethal", "aggravated"]) {
  const a = actor();
  apply(a, planDamage(a, 7, type).update);
  assert.equal(healthCondition(a), "active", "seventh wound never causes final death");
  assert.equal(healthPenalty(a).incapacitated, true);
  assert.equal(a.system.health.incapacitated, { bashing: 1, lethal: 2, aggravated: 3 }[type]);
  a.system.automation.frenzy = true;
  assert.equal(healthPenalty(a).incapacitated, true, "frenzy cannot bypass incapacitation");
  assert.equal(planDamage(a, 1, "aggravated").condition, "finalDeath");
  assert.equal(planDamage(a, 1, "bashing").condition, "torpor");
  assert.equal(planDamage(a, 1, "lethal").condition, "torpor");
}
for (let count = 0; count <= 7; count++) {
  const a = actor(Array(count).fill(2));
  assert.equal(healthPenalty(a).value, [0, 0, -1, -1, -2, -2, -5, 0][count]);
}
const mixed = actor([1, 2]);
apply(mixed, planDamage(mixed, 2, "aggravated").update);
assert.deepEqual(wounds(mixed), [3, 3, 1, 2]);
assert.equal(mixed.system.health.bruised, 3);
apply(mixed, planHealing(mixed).update);
assert.deepEqual(wounds(mixed), [3, 3, 1]);
assert.equal(mixed.system.health.injured, 1);
assert.equal(mixed.system.health.wounded, 0);
assert.equal(mixed.system.resources.blood.value, 19);
assert.throws(() => planHealing(mixed), /Лимит/);
assert.throws(() => planHealing(mixed, { aggravated: true }), /Сначала/);
assert.deepEqual(planDamage(mixed, 0, "aggravated").update, {});
const emptyBlood = actor(Array(6).fill(1)); emptyBlood.system.resources.blood.value = 0;
assert.equal(planDamage(emptyBlood, 1, "bashing").condition, "torpor");
const sleeping = actor([1], "torpor");
apply(sleeping, planHealing(sleeping).update);
assert.equal(sleeping.system.health.condition, "torpor", "healing never wakes torpor automatically");
assert.equal(healthPenalty(sleeping).incapacitated, true);
assert.equal(planDamage(sleeping, 1, "aggravated").condition, "finalDeath");
const dead = actor([3], "finalDeath");
assert.throws(() => planHealing(dead, { aggravated: true }), /Смерть/);
assert.deepEqual(planDamage(dead, 1, "bashing").update, {});
const huge = actor(); huge.items.push({ type: "merit", name: "Огромные размеры" });
assert.equal(healthKeys(huge).length, 8);
apply(huge, planDamage(huge, 2, "bashing").update);
assert.equal(healthPenalty(huge).value, 0);
apply(huge, planDamage(huge, 5, "lethal").update);
assert.equal(healthPenalty(huge).value, -5);
apply(huge, planDamage(huge, 1, "aggravated").update);
assert.equal(healthPenalty(huge).incapacitated, true);
huge.items = [];
assert.equal(wounds(huge).length, 8, "removing Huge Size never erases damage");
const sparse = actor([0, 0, 3, 0, 2]);
apply(sparse, editHealth(sparse, "bruised", 1));
assert.deepEqual(HEALTH_KEYS.map(key => sparse.system.health[key]), [3, 1, 2, 0, 0, 0, 0]);
const healing = actor([3, 3, 3]);
assert.throws(() => planHealing(healing, { aggravated: true, now: 100000 }), /полный день/);
healing.system.health.restStartedAt = 100;
assert.throws(() => planHealing(healing, { aggravated: true, now: 86499 }), /полный день/);
apply(healing, planHealing(healing, { aggravated: true, now: 86500 }).update);
assert.equal(wounds(healing).length, 2);
assert.equal(healing.system.resources.blood.value, 15);
assert.throws(() => planHealing(healing, { aggravated: true, extra: true, now: 172900 }), /Дополнительное/);
apply(healing, planHealing(healing, { aggravated: true, extra: true, now: 86500 }).update);
assert.equal(healing.system.resources.blood.value, 10);
assert.equal(healing.system.resources.willpower.value, 4);
assert.throws(() => planHealing(healing, { aggravated: true, extra: true, now: 86500 }), /Дополнительное/);
const confirm = actor([3]); confirm.system.health.restStartedAt = 0;
assert.equal(planHealing(confirm, { aggravated: true, now: 0, restConfirmed: true }).healed, 1);
const interrupted = actor([3]); interrupted.system.health.restStartedAt = 0;
apply(interrupted, planDamage(interrupted, 1, "aggravated").update);
assert.equal(interrupted.system.health.restStartedAt, -1);
for (const outcome of ["failure", "botch"]) {
  const a = actor([2]);
  apply(a, planHealing(a, { outcome }).update);
  assert.equal(a.system.resources.blood.value, 19);
  assert.equal(wounds(a).length, outcome === "botch" ? 2 : 1);
}
const noBlood = actor([1]); noBlood.system.resources.blood.value = 0;
assert.throws(() => planHealing(noBlood), /Недостаточно крови/);
const soak = actor(); soak.items.push({ type: "discipline", name: "Fortitude", system: { rating: 2 } });
assert.deepEqual(fortitudeSoakPool(soak, "lethal"), { pool: 9, stamina: 5, fortitude: 2, armor: 2 });
assert.equal(fortitudeSoakPool(soak, "aggravated", { damageSource: "physical" }).pool, 4);
for (const damageSource of ["fire", "sunlight", "unknown"]) assert.equal(fortitudeSoakPool(soak, "aggravated", { damageSource }).pool, 2);
assert.equal(fortitudeSoakPool(soak, "aggravated", { damageSource: "physical", ignoreArmor: true }).pool, 2);
console.log("✓ vampire health: packing, all seven levels, overflow, Huge Size, healing, rest, blood limits, soak sources");
