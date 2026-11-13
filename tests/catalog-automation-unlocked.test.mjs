import assert from "node:assert/strict";
import fs from "node:fs";

class ApplicationStub {
  constructor() {}
  async _prepareContext() { return {}; }
}
let nextId = 0;
const messages = [], warnings = [], rendered = [];
globalThis.foundry = {
  applications: { api: { ApplicationV2: ApplicationStub, HandlebarsApplicationMixin: base => base } },
  appv1: {},
  utils: { deepClone: structuredClone, randomID: () => `effect-${++nextId}` }
};
globalThis.ui = { notifications: { warn: message => warnings.push(message) } };
globalThis.game = { items: [], i18n: { localize: key => key } };
globalThis.renderTemplate = async (path, context) => { rendered.push({ path, context }); return "<p>item-use</p>"; };
globalThis.ChatMessage = {
  getSpeaker: ({ actor }) => ({ actor: actor.id }),
  async create(data) { messages.push(data); return data; }
};
const { VTMDisciplineCard } = await import("../scripts/apps/discipline-card.mjs");

function fixture(status, { owner = true, hasRoll = true } = {}) {
  const spending = [], rolls = [];
  const actor = {
    id: "actor", name: "Test actor", isOwner: owner, items: [], effects: [],
    system: { resources: { blood: { value: 3 }, willpower: { value: 3 } } },
    async changeResource(path, amount, reason) {
      spending.push({ path, amount, reason });
      this.system.resources[path.split(".")[1]].value += amount;
    },
    async createEmbeddedDocuments(type, data) {
      assert.equal(type, "ActiveEffect");
      const effects = data.map(entry => ({ ...entry, id: `active-${++nextId}` }));
      this.effects.push(...effects); return effects;
    }
  };
  const discipline = { id: "discipline", type: "discipline", name: "Test discipline", system: { rating: 1 } };
  const item = {
    id: "power", uuid: "Item.power", type: "disciplinePower", name: "Test power",
    system: {
      level: 1, parentDiscipline: discipline.name,
      description: { value: "Source description", system: "Source rules" },
      ...(status === undefined ? {} : { audit: { status, notes: "Historical audit note" } }),
      automation: {
        roll: hasRoll ? { firstTrait: "attribute.physical.strength", secondTrait: "ability.talents.athletics", difficulty: 7, label: "Power roll" } : {},
        cost: { blood: 1, willpower: 1 },
        effect: { duration: "scene", diceModifier: 2, target: "attribute.physical.*" }
      }
    }
  };
  game.items = [item];
  const card = new VTMDisciplineCard({ actor, discipline });
  card._openRollDialog = async roll => { rolls.push(roll); return true; };
  return { actor, item, card, spending, rolls };
}

for (const status of ["needs-review", "draft", "verified", "", undefined]) {
  messages.length = warnings.length = rendered.length = 0;
  const { actor, item, card, spending, rolls } = fixture(status);
  const originalSystem = structuredClone(item.system);
  const context = await card._prepareContext({});
  assert.equal(context.powers.length, 1);
  assert.equal(context.powers[0].canUse, true, `${status}: use button enabled`);
  assert.ok(!("auditStatus" in context.powers[0]));
  assert.ok(!("auditStatusLabel" in context.powers[0]));
  await card._useItemAutomation(item);
  assert.deepEqual(rolls, [{ firstTrait: "attribute.physical.strength", secondTrait: "ability.talents.athletics", difficulty: 7, label: "Power roll" }]);
  assert.deepEqual(spending.map(({ path, amount }) => ({ path, amount })), [
    { path: "resources.blood", amount: -1 }, { path: "resources.willpower", amount: -1 }
  ]);
  assert.equal(actor.system.resources.blood.value, 2);
  assert.equal(actor.system.resources.willpower.value, 2);
  assert.equal(actor.effects.length, 1);
  assert.equal(actor.effects[0].flags["vtm-revised"].diceModifier, 2);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].flags["vtm-revised"].hadRoll, true);
  assert.equal(rendered[0].context.description, "Source rules");
  assert.equal(warnings.length, 0);
  assert.deepEqual(item.system, originalSystem, "testing does not pretend an audit was passed");
}

messages.length = 0;
const canceled = fixture("needs-review");
canceled.card._openRollDialog = async () => false;
await canceled.card._useItemAutomation(canceled.item);
assert.equal(canceled.spending.length, 0);
assert.equal(canceled.actor.effects.length, 0);
assert.equal(messages.length, 0, "cancelled roll has no side effects");

const nonOwner = fixture("needs-review", { owner: false });
assert.equal((await nonOwner.card._prepareContext({})).powers[0].canUse, false);
await nonOwner.card._useItemAutomation(nonOwner.item);
assert.equal(nonOwner.rolls.length, 0);
assert.equal(nonOwner.spending.length, 0);
assert.equal(messages.length, 0, "actor permissions are retained");

const noRoll = fixture("needs-review", { hasRoll: false });
await noRoll.card._useItemAutomation(noRoll.item);
assert.equal(noRoll.rolls.length, 0);
assert.equal(noRoll.spending.length, 2);
assert.equal(messages[0].flags["vtm-revised"].hadRoll, false);

for (const name of ["discipline", "ritual", "merit-flaw"]) {
  const template = fs.readFileSync(new URL(`../templates/apps/${name}-card.hbs`, import.meta.url), "utf8");
  assert.ok(!/auditStatus|audit\.status|auditNotes|vtm-audit-badge|Непроверено/.test(template), `${name}: no audit labels in the card`);
}
console.log("catalog automation unlocked: all audit states; roll, costs, active effect and chat; cancellation and permissions retained");
