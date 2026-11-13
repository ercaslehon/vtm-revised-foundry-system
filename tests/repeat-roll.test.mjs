import assert from "node:assert/strict";
import { rollDicePool } from "../scripts/dice/dice-pool.mjs";

const dialogs = [], rolls = [], messages = [], warnings = [], hooks = new Map();
const escapeHTML = value => String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
globalThis.foundry = { utils: { escapeHTML }, appv1: { api: { Dialog: class {
  constructor(options, windowOptions) { dialogs.push({ ...options, windowOptions }); }
  render() { return this; }
} } } };
globalThis.Hooks = { on: (name, handler) => hooks.set(name, handler) };
globalThis.ui = { notifications: { warn: value => warnings.push(value), error: value => warnings.push(value) } };
globalThis.renderTemplate = async () => "<div>roll</div>";
globalThis.Roll = class {
  constructor(formula) { this.formula = formula; rolls.push(formula); }
  async evaluate() { this.dice = [{ results: [{ result: 10 }, { result: 1 }] }]; return this; }
  async toMessage(data, options = {}) {
    const prepared = { ...structuredClone(data), rolls: [this.formula], whisper: ["current-default-recipient"], blind: true };
    if (options.create === false) return prepared;
    messages.push(prepared);
    return prepared;
  }
};
globalThis.ChatMessage = {
  getSpeaker: ({ actor }) => ({ actor: actor.id, scene: actor.token?.parent?.id, token: actor.token?.id }),
  create: async data => { messages.push(structuredClone(data)); return data; }
};
const actor = { id: "hero", uuid: "Actor.hero", name: '<Hero "test">', type: "vampire", isOwner: true };
const tokenActor = { ...actor, uuid: "Scene.other.Token.token.Actor.hero", token: { id: "token", parent: { id: "other" } } };
const actors = new Map([[actor.id, actor]]);
const tokens = new Map([["token", { actor: tokenActor }]]);
const documents = new Map([[actor.uuid, actor], [tokenActor.uuid, tokenActor]]);
globalThis.game = { user: { isGM: false }, actors, scenes: new Map([["other", { tokens }]]) };
globalThis.fromUuid = async uuid => documents.get(uuid);
const { openRepeatRollDialog, renderRepeatRollButton, resolveRollActor, getRepeatParameters } = await import("../scripts/dice/repeat-roll.mjs");
assert.ok(hooks.has("renderChatMessageHTML") && hooks.has("renderChatMessage"));

await rollDicePool({ actor: tokenActor, pool: 7, basePool: 9, healthPenalty: -2, healthPenaltyLabel: "Ранен",
  automaticSuccesses: 2, difficulty: 8, label: "Сила + Атлетика", flavor: "Исходная причина",
  components: [{ label: "Сила", value: 4 }, { label: "Атлетика", value: 5 }] });
const source = structuredClone(messages.at(-1));
source.visible = source.isContentVisible = true;
source.whisper = ["original-gm"];
source.blind = false;
assert.equal(source.flags["vtm-revised"].actorUuid, tokenActor.uuid);
assert.equal(await resolveRollActor(source), tokenActor);
const baseline = structuredClone(source);
const beforeRolls = rolls.length;
const pending = openRepeatRollDialog(source);
await new Promise(resolve => setImmediate(resolve));
assert.equal(rolls.length, beforeRolls, "opening a dialog never rolls");
let dialog = dialogs.at(-1);
assert.match(dialog.content, /name="pool"[^>]*value="7"/);
assert.match(dialog.content, /name="difficulty"[^>]*value="8"/);
assert.match(dialog.content, /&lt;Hero &quot;test&quot;&gt;/);
assert.match(dialog.content, /Ранен/);

function form(overrides = {}) {
  const values = { pool: "7", difficulty: "8", automaticSuccesses: String(source.flags["vtm-revised"].automaticSuccesses ?? 0), label: "Сила + Атлетика", ...overrides };
  return [{ querySelector: selector => ({ value: values[/name='([^']+)'/.exec(selector)[1]] }) }];
}
const callback = dialog.buttons.roll.callback(form());
dialog.close();
await callback;
assert.ok(await pending, "dialog close after submit must not cancel the result");
assert.equal(rolls.length, beforeRolls + 1);
assert.equal(rolls.at(-1), "7d10");
const repeated = messages.at(-1);
for (const key of ["actorUuid", "pool", "basePool", "healthPenalty", "healthPenaltyLabel", "automaticSuccesses", "difficulty", "label", "flavor", "components"]) {
  assert.deepEqual(repeated.flags["vtm-revised"][key], source.flags["vtm-revised"][key], key);
}
assert.deepEqual(repeated.speaker, source.speaker);
assert.deepEqual(repeated.whisper, ["original-gm"]);
assert.equal(repeated.blind, false);
assert.deepEqual(source, baseline, "original message is immutable");
await dialog.buttons.roll.callback(form());
assert.equal(rolls.length, beforeRolls + 1, "duplicate submit cannot produce a second roll");

async function start(message = source) {
  const promise = openRepeatRollDialog(message);
  await new Promise(resolve => setImmediate(resolve));
  return { promise, dialog: dialogs.at(-1) };
}
const count = rolls.length;
for (const cancel of ["button", "close"]) {
  const opened = await start();
  if (cancel === "button") opened.dialog.buttons.cancel.callback();
  else opened.dialog.close();
  assert.equal(await opened.promise, false);
}
assert.equal(rolls.length, count);

const changed = await start();
await changed.dialog.buttons.roll.callback(form({ pool: "10", difficulty: "5", label: "Новый бросок" }));
await changed.promise;
assert.equal(rolls.at(-1), "10d10");
assert.equal(messages.at(-1).flags["vtm-revised"].difficulty, 5);
assert.deepEqual(messages.at(-1).flags["vtm-revised"].components.at(-1), { label: "Поправка при повторе", value: 3 });
for (const overrides of [{ pool: "NaN" }, { pool: "0" }, { pool: "2.5" }, { difficulty: "11" }, { automaticSuccesses: "-1" }]) {
  const opened = await start();
  const count = rolls.length;
  await opened.dialog.buttons.roll.callback(form(overrides));
  assert.equal(await opened.promise, false);
  assert.equal(rolls.length, count);
}

const revoked = await start();
tokenActor.isOwner = false;
await revoked.dialog.buttons.roll.callback(form());
assert.equal(await revoked.promise, false);
const dialogCount = dialogs.length;
assert.equal(await openRepeatRollDialog(source), false);
assert.equal(dialogs.length, dialogCount);
game.user.isGM = true;
const gm = await start();
gm.dialog.close();
assert.equal(await gm.promise, false);
game.user.isGM = false;
tokenActor.isOwner = true;
documents.delete(tokenActor.uuid);
assert.equal(await resolveRollActor(source), null, "stale token UUID must not fall back to world actor");
assert.equal(await openRepeatRollDialog(source), false);
documents.set(tokenActor.uuid, tokenActor);

const legacy = structuredClone(source);
delete legacy.flags["vtm-revised"].actorUuid;
delete legacy.flags["vtm-revised"].label;
delete legacy.flags["vtm-revised"].flavor;
assert.equal(await resolveRollActor(legacy), tokenActor);
tokens.delete("token");
assert.equal(await resolveRollActor(legacy), null);
tokens.set("token", { actor: tokenActor });
legacy.speaker = { actor: actor.id };
assert.equal(await resolveRollActor(legacy), actor);
assert.equal(getRepeatParameters(legacy).label, source.flavor);
assert.equal(getRepeatParameters({ flags: { "vtm-revised": { type: "weaponDamage" } } }), null);

for (const visibility of [{ whisper: [], blind: false }, { whisper: ["gm"], blind: true }, { whisper: ["self"], blind: false }]) {
  game.user.isGM = true;
  const opened = await start({ ...source, ...visibility });
  await opened.dialog.buttons.roll.callback(form());
  await opened.promise;
  assert.deepEqual(messages.at(-1).whisper, visibility.whisper);
  assert.equal(messages.at(-1).blind, visibility.blind);
}
game.user.isGM = false;
assert.equal(await openRepeatRollDialog({ ...source, isContentVisible: false }), false);

const buttons = [];
const card = { querySelector: () => buttons[0], append: button => buttons.push(button) };
const html = { querySelector: () => card };
globalThis.document = { createElement: () => ({ addEventListener(event, callback) { this[event] = callback; } }) };
await Promise.all([renderRepeatRollButton(source, html), renderRepeatRollButton(source, [html])]);
assert.equal(buttons.length, 1, "both hooks together must produce only one button");
assert.equal(buttons[0].type, "button");
const clicking = buttons[0].click({ preventDefault() {} });
await new Promise(resolve => setImmediate(resolve));
assert.equal(buttons[0].disabled, true);
const dialogsBeforeDuplicate = dialogs.length;
await buttons[0].click({ preventDefault() {} });
assert.equal(dialogs.length, dialogsBeforeDuplicate);
dialogs.at(-1).close();
await clicking;
assert.equal(buttons[0].disabled, false);
buttons.length = 0;
tokenActor.isOwner = false;
await renderRepeatRollButton(source, html);
assert.equal(buttons.length, 0);
console.log("Repeat roll: snapshot, legacy messages, token identity, permissions, cancellation, duplicate clicks, input validation and visibility passed.");
