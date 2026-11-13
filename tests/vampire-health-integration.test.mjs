import assert from "node:assert/strict";
import { HEALTH_KEYS } from "../scripts/combat/vampire-health.mjs";
const messages = [], warnings = [], dialogs = [], hooks = new Map();
let dice = [1], choice = "rest", dialogFields = {};
const getProperty = (object, path) => path.split('.').reduce((value, part) => value?.[part], object);
const setProperty = (object, path, value) => { const parts = path.split('.'); let target = object; for (const key of parts.slice(0, -1)) target = target[key] ??= {}; target[parts.at(-1)] = value; };
class App {}
class Element { constructor(fields = {}) { this.fields = fields; } querySelector(selector) { return this.fields[/name='([^']+)'/.exec(selector)?.[1] ?? selector]; } }
globalThis.HTMLElement = Element;
globalThis.HTMLFormElement = Element;
globalThis.foundry = { applications: { api: { ApplicationV2: App, HandlebarsApplicationMixin: base => base }, sheets: { ActorSheetV2: App } },
  appv1: { api: { Dialog: class { constructor(options) { this.options = options; dialogs.push(options); } render() {
    const buttons = this.options.buttons;
    const name = buttons.next ? 'next' : buttons.apply ? 'apply' : choice;
    if (!buttons[name]) throw new Error(`Unexpected dialog: ${this.options.title}; ${name}`);
    buttons[name].callback(new Element(dialogFields)); this.options.close?.(); return this;
  } } } }, utils: { getProperty, setProperty, deepClone: structuredClone, escapeHTML: String } };
globalThis.Hooks = { on: (name, handler) => { const all = hooks.get(name) ?? []; all.push(handler); hooks.set(name, all); } };
globalThis.game = { user: { isGM: true, targets: new Set() }, time: { worldTime: 0 }, items: [], i18n: { localize: key => key, format: key => key } };
globalThis.ui = { notifications: { warn: m => warnings.push(m), error: m => { throw new Error(m); }, info() {} } };
globalThis.renderTemplate = async () => '';
globalThis.ChatMessage = { getSpeaker: () => ({}), create: async data => { messages.push(data); return data; } };
globalThis.Roll = class { async evaluate() { this.dice = [{ results: dice.map(result => ({ result })) }]; return this; } async toMessage(data) { messages.push(data); return data; } };
function actor(values = []) {
  return { name: "Test", type: "vampire", documentName: "Actor", isOwner: true, uuid: "Actor.test", items: [], effects: [], generationCaps: { bloodPerTurn: 1 },
    system: { health: { ...Object.fromEntries(HEALTH_KEYS.map((key, i) => [key, values[i] ?? 0])), condition: "active", restStartedAt: -1, restCompletedAt: -1 },
      resources: { blood: { value: 10 }, willpower: { value: 3 } }, attributes: { physical: { stamina: 2 } }, automation: { bloodSpentTurn: 0 } },
    async update(update) { for (const [path, value] of Object.entries(update)) setProperty(this, path, value); }
  };
}
const { VTMVampireActorSheet } = await import('../scripts/sheets/vampire-actor-sheet.mjs');
const sheet = Object.create(VTMVampireActorSheet.prototype);
sheet.document = actor([2]);
choice = 'rest';
assert.equal(await sheet._healWithBlood(), true);
assert.equal(sheet.actor.system.health.bruised, 0);
assert.equal(sheet.actor.system.resources.blood.value, 9);
sheet.document = actor([3, 3]); choice = 'start';
assert.equal(await sheet._healWithBlood({ aggravated: true }), true);
assert.equal(sheet.actor.system.resources.blood.value, 10, 'starting rest is free');
assert.equal(sheet.actor.system.health.bruised, 3);
choice = 'confirm';
assert.equal(await sheet._healWithBlood({ aggravated: true }), true);
assert.equal(sheet.actor.system.resources.blood.value, 5);
assert.equal(sheet.actor.system.health.hurt, 0);
choice = 'extra';
assert.equal(await sheet._healWithBlood({ aggravated: true }), true);
assert.equal(sheet.actor.system.resources.blood.value, 0);
assert.equal(sheet.actor.system.resources.willpower.value, 2);
sheet.document = actor([1]); choice = 'cancel';
assert.equal(await sheet._healWithBlood(), false);
assert.equal(sheet.actor.system.resources.blood.value, 10);
sheet.document = actor([1]); sheet.actor.isOwner = false;
assert.equal(await sheet._healWithBlood(), false);
const incapacitated = actor(Array(7).fill(3)); incapacitated.system.automation.frenzy = true;
assert.equal(sheet._actorHealthPenalty(incapacitated).incapacitated, true);
// Real chat handler, both Foundry hooks, zero net bashing and firearm conversion.
await import('../scripts/combat/combat-chat-actions.mjs');
let target = actor();
globalThis.fromUuid = async () => target;
async function clickDamage(data, fields) {
  dialogFields = fields;
  let click, listeners = 0;
  const button = { dataset: {}, addEventListener(name, callback) { listeners++; click = callback; } };
  const root = new Element({ '.weapon-damage-apply': button });
  const message = { id: 'damage', flags: { 'vtm-revised': { type: 'weaponDamage', targetActorUuid: target.uuid, ...data } } };
  for (const hook of ['renderChatMessage', 'renderChatMessageHTML']) for (const handler of hooks.get(hook) ?? []) handler(message, root);
  assert.equal(listeners, 1);
  await click({ preventDefault() {} });
  assert.equal(button.disabled, false);
}
await clickDamage({ damageType: 'lethal', weaponCategory: 'firearm', damageSuccesses: 1 }, { levels: { value: 0 } });
assert.equal(target.system.health.bruised, 0);
assert.ok(dialogs.at(-1).content.includes('value="0"'), 'one unsoaked bashing becomes zero');
assert.ok(messages.at(-1).content.includes('Ударный'));
target = actor(Array(6).fill(3));
await clickDamage({ damageType: 'aggravated', damageSuccesses: 1 }, { levels: { value: 1 } });
assert.equal(target.system.health.incapacitated, 3);
assert.equal(target.system.health.condition, 'active');
await clickDamage({ damageType: 'aggravated', damageSuccesses: 1 }, { levels: { value: 1 } });
assert.equal(target.system.health.condition, 'finalDeath');
console.log('✓ sheet healing/rest/cancel/ownership and real chat damage flow on both Foundry hooks');
// No automatic die when wound penalties remove the entire action/defense pool.
sheet.document = actor(Array(6).fill(2));
sheet._resolveTraitOption = key => ({ label: key, value: 1 });
sheet._consumeMultipleAction = async () => 0;
const before = messages.length;
await sheet._rollWeaponAttackAndDamage({ system: { weapon: {} } }, { firstTrait: 'attribute.physical.dexterity', secondTrait: 'ability.skills.melee' });
assert.equal(messages.length, before);
assert.equal((await sheet._rollTargetDefense(sheet.actor)).successes, 0);
const form = new Element({ firstTrait: { value: 'attribute.physical.dexterity' }, secondTrait: { value: 'ability.skills.melee' }, difficulty: { value: 6 }, label: { value: 'Test' } });
form.querySelectorAll = () => [];
await sheet._rollFromForm(form);
assert.equal(messages.length, before);
// Actual Actor pre-update: blood depletion persists torpor, feeding does not wake it.
globalThis.Actor = class { async _preUpdate() {} };
foundry.utils.expandObject = object => { const out = {}; for (const [key, value] of Object.entries(object)) setProperty(out, key, value); return out; };
foundry.utils.hasProperty = (object, path) => getProperty(object, path) !== undefined;
foundry.utils.mergeObject = (base, patch) => {
  const merge = (a, b) => { for (const [key, value] of Object.entries(b)) { if (value && typeof value === 'object' && !Array.isArray(value)) merge(a[key] ??= {}, value); else a[key] = value; } return a; };
  return merge(structuredClone(base), patch);
};
const { VTMActor } = await import('../scripts/documents/vtm-actor.mjs');
const document = Object.create(VTMActor.prototype);
Object.assign(document, { type: 'vampire', items: [], system: actor(Array(7).fill(2)).system });
Object.defineProperty(document.system, 'toObject', { value() { return structuredClone({ ...this }); } });
let update = { 'system.resources.blood.value': 0 };
await document._preUpdate(update, {}, {});
assert.equal(getProperty(update, 'system.health.condition'), 'torpor');
document.system.resources.blood.value = 0;
update = { 'system.resources.blood.value': 5 };
await document._preUpdate(update, {}, {});
assert.equal(getProperty(update, 'system.health.condition'), 'torpor');
console.log('✓ zero action pools and torpor persistence through actual Actor update hook');
