import assert from "node:assert/strict";
import fs from "node:fs";
import { fortitudeRating, fortitudeSoakPool, isFortitudeDiscipline } from "../scripts/combat/fortitude-soak.mjs";

const dialogs = [], rolls = [], messages = [], templates = [], warnings = [];
let choice = { damageType: "bashing", difficulty: 6, ignoreArmor: false };
class ApplicationStub {
  async _prepareContext() { return {}; }
  _onRender() {}
}
class DialogStub {
  constructor(options, windowOptions) { this.options = options; options.windowOptions = windowOptions; dialogs.push(options); }
  render() {
    if (choice === "close") { this.options.close(); return this; }
    if (!choice) { this.options.buttons.cancel.callback(); return this; }
    const fields = Object.fromEntries(Object.entries(choice).map(([key, value]) => [key, {
      value, checked: value, addEventListener(event, handler) { this[event] = handler; }
    }]));
    fields.poolSummary = { value: "" };
    const root = { querySelector(selector) {
      const key = /name='([^']+)'/.exec(selector)?.[1];
      return fields[key];
    }, querySelectorAll() { return [fields.damageType, fields.ignoreArmor]; } };
    this.options.fields = fields;
    this.options.render?.([root]);
    this.options.buttons.roll.callback([root]);
    this.options.close(); // Closing after a successful callback must not cancel the roll.
    return this;
  }
}
globalThis.foundry = {
  applications: { api: { ApplicationV2: ApplicationStub, HandlebarsApplicationMixin: base => base } },
  appv1: { api: { Dialog: DialogStub } }, utils: { deepClone: structuredClone }
};
globalThis.game = { items: [], i18n: { localize: key => key } };
globalThis.ui = { notifications: { warn: message => warnings.push(message) } };
globalThis.renderTemplate = async (path, context) => { templates.push({ path, context }); return "<p>roll</p>"; };
globalThis.ChatMessage = {
  getSpeaker: ({ actor }) => ({ actor: actor.id }),
  async create(message) { messages.push(message); return message; }
};
globalThis.Roll = class {
  constructor(formula) { this.formula = formula; rolls.push(this); }
  async evaluate() { this.dice = [{ results: Array.from({ length: Number(this.formula.split("d")[0]) }, () => ({ result: 6 })) }]; return this; }
  async toMessage(message) { messages.push(message); }
};
const { VTMDisciplineCard } = await import("../scripts/apps/discipline-card.mjs");
function fixture(rating = 2, owner = true) {
  const actor = { id: "actor", name: "Test vampire", type: "vampire", isOwner: owner, items: [], effects: [],
    system: { attributes: { physical: { stamina: 3 } }, automation: { armor: { active: true, rating: 1 } },
      resources: { blood: { value: 5 } }, health: { wounded: 1 } } };
  const discipline = { id: "fortitude", uuid: "Actor.actor.Item.fortitude", type: "discipline", name: "Стойкость", parent: actor, system: { rating } };
  actor.items = [discipline];
  const power = { id: "power", uuid: "Item.power", type: "disciplinePower", name: "Сверхъестественная Стойкость",
    system: { level: 1, parentDiscipline: "Стойкость", description: { value: "Source prose" }, automation: {} } };
  game.items = [power];
  return { actor, discipline, power, card: new VTMDisciplineCard({ actor, discipline }) };
}
for (let rating = 1; rating <= 5; rating++) {
  const { actor, discipline } = fixture(rating);
  for (const type of ["bashing", "lethal"]) {
    assert.deepEqual(fortitudeSoakPool(actor, type, { discipline }), { pool: 4 + rating, stamina: 3, fortitude: rating, armor: 1 });
    assert.equal(fortitudeSoakPool(actor, type, { discipline, ignoreArmor: true }).pool, 3 + rating);
  }
  assert.deepEqual(fortitudeSoakPool(actor, "aggravated", { discipline }), { pool: rating, stamina: 0, fortitude: rating, armor: 0 });
}
assert.ok(isFortitudeDiscipline({ type: "discipline", name: "Custom title", system: { rulesId: "fortitude" } }));
assert.ok(!isFortitudeDiscipline({ type: "disciplinePower", name: "Стойкость", system: {} }));
const foreign = fixture();
assert.equal(fortitudeRating(foreign.actor, { ...foreign.discipline, parent: null, system: { rating: 10 } }), 2, "never use a library rating instead of the actor's rating");

const { actor, discipline, power, card } = fixture();
const before = structuredClone(actor.system);
const originalPower = structuredClone(power.system);
for (const [type, expected] of [["bashing", 6], ["lethal", 6], ["aggravated", 2]]) {
  choice = { damageType: type, difficulty: 6, ignoreArmor: false };
  const result = await card._useItemAutomation(power);
  assert.equal(rolls.at(-1).formula, `${expected}d10`);
  assert.equal(result.pool, expected);
  assert.equal(result.automaticSuccesses, 0);
  assert.equal(result.healthPenalty, 0, "wound penalties must not affect soak");
  assert.equal(messages.at(-1).flags["vtm-revised"].type, "dicePool", "Use produces an actual dice roll, not an item-description message");
  assert.ok(result.components.some(component => component.label === "Стойкость" && component.value === 2));
  const dialog = dialogs.at(-1);
  assert.match(dialog.content, /class="vtm-roll-dialog vtm-fortitude-soak-dialog"/);
  assert.match(dialog.content, /class="form-group"/);
  assert.match(dialog.title, /Бросок/);
  assert.equal(dialog.windowOptions.width, 460);
  assert.deepEqual(dialog.windowOptions.classes, ["vtm-themed-dialog-window", "vtm-roll-dialog-window", "vampire-roll-dialog-window"]);
  assert.ok(dialog.fields.poolSummary.value.endsWith(`= ${expected} куб.`));
}
const preview = dialogs.at(-1).fields;
preview.damageType.value = "lethal";
preview.damageType.change();
assert.equal(preview.poolSummary.value, "Выносливость 3 + Стойкость 2 + Броня 1 = 6 куб.");
preview.ignoreArmor.checked = true;
preview.ignoreArmor.change();
assert.equal(preview.poolSummary.value, "Выносливость 3 + Стойкость 2 = 5 куб.");
preview.damageType.value = "aggravated";
preview.damageType.change();
assert.equal(preview.poolSummary.value, "Стойкость 2 = 2 куб.");
choice = { damageType: "lethal", difficulty: 8, ignoreArmor: true };
const ignored = await card._rollFortitudeSoak();
assert.equal(ignored.pool, 5);
assert.equal(messages.at(-1).flags["vtm-revised"].difficulty, 8);
assert.equal(ignored.components.some(component => component.label === "Броня"), false);
assert.deepEqual(actor.system, before, "no spending, health changes, active effects or persistent mutation");
assert.deepEqual(power.system, originalPower);

for (const canceled of [null, "close"]) {
  choice = canceled;
  const count = messages.length;
  await card._rollFortitudeSoak();
  assert.equal(messages.length, count);
}
let count = dialogs.length;
await fixture(2, false).card._useItemAutomation(power);
assert.equal(dialogs.length, count, "non-owner cannot roll from the card");
await fixture(0).card._useItemAutomation(power);
assert.equal(dialogs.length, count, "zero Fortitude must not create a fake one-die aggravated roll");
assert.ok(warnings.length);

const own = fixture();
const context = await own.card._prepareContext({});
assert.equal(context.isFortitude, true);
assert.equal(context.canRollFortitude, true);
assert.equal((await fixture(0).card._prepareContext({})).canRollFortitude, false);
assert.equal((await fixture(2, false).card._prepareContext({})).canRollFortitude, false);
const listeners = {};
own.card.element = {
  querySelector: selector => selector === ".discipline-fortitude-soak" ? { addEventListener: (_event, handler) => listeners.soak = handler } : null,
  querySelectorAll: () => []
};
own.card._onRender(context, {});
choice = { damageType: "aggravated", difficulty: 6, ignoreArmor: false };
await listeners.soak({ preventDefault() {} });
assert.equal(rolls.at(-1).formula, "2d10", "the new button is wired to the actual roll");

const template = fs.readFileSync(new URL("../templates/apps/discipline-card.hbs", import.meta.url), "utf8");
assert.match(template, /\{\{#if isFortitude\}\}[\s\S]*class="discipline-fortitude-soak"/);
assert.match(template, /class="discipline-fortitude-soak" \{\{#unless canRollFortitude\}\}disabled/);

// Elder powers and unrelated disciplines retain their normal automation route.
const elder = fixture();
elder.power.system.level = 6;
count = rolls.length;
await elder.card._useItemAutomation(elder.power);
assert.equal(rolls.length, count);
assert.equal(messages.at(-1).flags["vtm-revised"].type, "itemUse");
elder.power.system.level = 1;
elder.discipline.name = "Могущество";
await elder.card._useItemAutomation(elder.power);
assert.equal(rolls.length, count);
assert.equal(messages.at(-1).flags["vtm-revised"].type, "itemUse");
console.log("Fortitude card: standard themed roll dialog and live pool preview; 1–5 dots, damage types, armor, cancellation, permissions and no resource/health mutation");
