import assert from "node:assert/strict";
const dialogs = [], warnings = [], attacks = [], requests = [], hooks = new Map();
class Node {
  constructor(data = {}) { Object.assign(this, { value: '', checked: false, disabled: false, hidden: false, dataset: {}, listeners: {} }, data); }
  addEventListener(name, callback) { this.listeners[name] = callback; }
  async fire(name = 'click') { return this.listeners[name]?.({ preventDefault() {}, currentTarget: this }); }
  focus() {}
}
class Root extends Node {
  constructor(fields = {}, options = []) { super(); this.fields = fields; this.options = options; }
  querySelector(selector) { if (selector === 'form') return this; return this.fields[/name='([^']+)'/.exec(selector)?.[1] ?? selector] ?? null; }
  querySelectorAll(selector) { return selector === '[data-target-uuid]' ? this.options : []; }
}
class DialogStub {
  constructor(options, windowOptions) { Object.assign(this, { options, windowOptions }); dialogs.push(this); }
  render() { return this; }
  async close() { this.options.close?.(); }
  mount(root) { this.root = root; this.options.render?.(root); return root; }
}
const escapeHTML = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
globalThis.HTMLElement = Root;
globalThis.foundry = { utils: { escapeHTML }, appv1: { api: { Dialog: DialogStub } } };
globalThis.Hooks = { on: (name, callback) => { const list = hooks.get(name) ?? []; list.push(callback); hooks.set(name, list); } };
globalThis.ui = { notifications: { warn: message => warnings.push(message), info() {}, error: message => { throw new Error(message); } } };
globalThis.ChatMessage = { getSpeaker: () => ({}), create: async data => { requests.push(data); return data; } };
globalThis.game = { users: [{ id: 'gm', isGM: true, active: true }], user: { id: 'player', isGM: false, targets: new Set() }, actors: { contents: [] }, i18n: { lang: 'ru', localize: key => key } };
const documents = new Map();
globalThis.fromUuid = async uuid => documents.get(uuid);
function actor(id, { owner = false, visible = false, name = id, token = null } = {}) {
  const a = { id, uuid: token ? `Scene.scene.Token.${id}.Actor.${id}` : `Actor.${id}`, documentName: 'Actor', type: 'vampire', name, img: 'icons/svg/mystery-man.svg', isOwner: owner, token,
    testUserPermission: (_user, level) => { assert.equal(level, 'LIMITED'); return visible; }, items: [], system: { health: {}, resources: { blood: { value: 10 } }, attributes: { physical: { stamina: 0 } } },
    async update(update) { this.lastUpdate = update; } };
  documents.set(a.uuid, a); return a;
}
const attacker = actor('attacker', { owner: true });
const owned = actor('owned', { owner: true, name: 'Ёж' });
const visible = actor('visible', { visible: true, name: 'Видимый <NPC>' });
const hidden = actor('hidden', { name: 'Секретный' });
const synthetic = actor('token', { owner: true, token: {} });
game.actors.contents = [attacker, owned, visible, hidden];
game.user.targets.add({ actor: synthetic });
const { combatTargetCandidates, resolveCombatTarget, chooseCombatTarget, combatTargetMarkup } = await import('../scripts/combat/combat-targets.mjs');
const { openWeaponAttackDialog } = await import('../scripts/combat/weapon-attack-dialog.mjs');
assert.deepEqual(new Set(combatTargetCandidates().map(a => a.id)), new Set(['attacker', 'owned', 'visible', 'token']));
assert.ok(!combatTargetCandidates({ requireOwner: true }).includes(visible));
assert.equal(await resolveCombatTarget(hidden.uuid), null);
assert.equal(await resolveCombatTarget('Actor.deleted'), null);
assert.equal(await resolveCombatTarget(synthetic.uuid), synthetic);
assert.ok(combatTargetMarkup(visible).includes('&lt;NPC&gt;'));
game.user.isGM = true;
assert.ok(combatTargetCandidates().includes(hidden));
game.user.isGM = false;
game.user.targets.clear();
const picker = chooseCombatTarget();
let pickerDialog = dialogs.at(-1);
assert.ok(!pickerDialog.options.content.includes('Секретный'));
const search = new Node();
const rows = [owned, visible].map(a => new Node({ dataset: { targetUuid: a.uuid, targetName: a.name } }));
const pickerRoot = pickerDialog.mount(new Root({ targetSearch: search, '.vtm-target-no-results': new Node() }, rows));
search.value = 'еж'; await search.fire('input');
assert.equal(rows[0].hidden, false); assert.equal(rows[1].hidden, true);
search.value = 'нет совпадения'; await search.fire('input');
assert.equal(pickerRoot.fields['.vtm-target-no-results'].hidden, false);
await rows[0].fire(); assert.equal(await picker, owned);
const canceled = chooseCombatTarget(); await dialogs.at(-1).close(); assert.equal(await canceled, undefined);
const revoked = chooseCombatTarget(); pickerDialog = dialogs.at(-1);
const revokedRow = new Node({ dataset: { targetUuid: visible.uuid, targetName: visible.name } });
pickerDialog.mount(new Root({}, [revokedRow]));
visible.testUserPermission = () => false;
await revokedRow.fire(); assert.ok(warnings.at(-1).includes('недоступен'));
await pickerDialog.close(); assert.equal(await revoked, undefined);
visible.testUserPermission = () => true;
const sheet = { actor: attacker, _buildRollSelectHtml: name => `<select name="${name}"></select>`, _damageTypeLabel: () => 'Летальный', _getFormElement: html => html,
  async _rollWeaponAttackAndDamage(item, options) { attacks.push({ item, options }); return options; } };
const weapon = { name: 'Меч <test>', system: { weapon: { damageDice: 4, damageType: 'lethal' } } };
function attackRoot(dialog) {
  return dialog.mount(new Root({
    '.vtm-target-current': new Node(), '.vtm-target-clear': new Node(), '.vtm-target-choose': new Node(),
    firstTrait: new Node({ value: 'attribute.physical.dexterity' }), secondTrait: new Node({ value: '' }),
    useDefense: new Node(), defenseType: new Node({ value: 'dodge' }), difficulty: new Node({ value: '6' }), damageDifficulty: new Node({ value: '6' })
  }));
}
let pending = openWeaponAttackDialog(sheet, weapon);
let dialog = dialogs.at(-1), root = attackRoot(dialog);
assert.ok(dialog.windowOptions.classes.includes('vtm-combat-dialog-window'));
assert.ok(dialog.options.content.includes('Меч &lt;test&gt;'));
assert.equal(root.fields.useDefense.disabled, true);
let selecting = root.fields['.vtm-target-choose'].fire();
pickerDialog = dialogs.at(-1);
const chosenRow = new Node({ dataset: { targetUuid: owned.uuid, targetName: owned.name } });
pickerDialog.mount(new Root({}, [chosenRow])); await chosenRow.fire(); await selecting;
assert.equal(sheet._weaponTargetUuid, owned.uuid);
assert.equal(root.fields.useDefense.disabled, false);
assert.equal(root.fields.useDefense.checked, true);
let submission = dialog.options.buttons.attack.callback(root); await dialog.close(); await submission;
assert.equal((await pending).flags['vtm-revised'].targetActorUuid, owned.uuid);
assert.equal(requests.at(-1).flags['vtm-revised'].choices.secondTrait, '', 'explicit empty second trait is respected');
assert.equal(requests.at(-1).flags['vtm-revised'].choices.defenseType, 'dodge');
// Memorized actor wins over a later token selection; clearing persists as no target.
game.user.targets.add({ actor: synthetic });
pending = openWeaponAttackDialog(sheet, weapon); await new Promise(resolve => setImmediate(resolve));
dialog = dialogs.at(-1); root = attackRoot(dialog);
assert.ok(dialog.options.content.includes('Ёж'));
await root.fields['.vtm-target-clear'].fire();
assert.equal(sheet._weaponTargetUuid, null);
assert.equal(root.fields.useDefense.disabled, true);
await dialog.options.buttons.attack.callback(root); assert.equal((await pending).targetActor, null);
pending = openWeaponAttackDialog(sheet, weapon); await new Promise(resolve => setImmediate(resolve));
dialog = dialogs.at(-1); assert.ok(dialog.options.content.includes('Цель не выбрана')); await dialog.close(); await pending;
// A player's defense choice is delegated to the GM, never performed with local permissions.
sheet._weaponTargetUuid = visible.uuid;
pending = openWeaponAttackDialog(sheet, weapon); await new Promise(resolve => setImmediate(resolve));
dialog = dialogs.at(-1); root = attackRoot(dialog); root.fields.useDefense.checked = true;
await dialog.options.buttons.attack.callback(root); assert.equal((await pending).flags['vtm-revised'].choices.defenseType, 'dodge');
// Deletion during an open attack never silently fires at another actor.
sheet._weaponTargetUuid = owned.uuid;
pending = openWeaponAttackDialog(sheet, weapon); await new Promise(resolve => setImmediate(resolve));
dialog = dialogs.at(-1); root = attackRoot(dialog); documents.delete(owned.uuid);
const count = attacks.length;
await dialog.options.buttons.attack.callback(root); assert.equal(await pending, null); assert.equal(attacks.length, count);
documents.set(owned.uuid, owned);
// Real chat action: no UUID opens the actor picker; a stale UUID never falls back.
globalThis.ChatMessage = { getSpeaker: () => ({}), create: async () => ({}) };
await import('../scripts/combat/combat-chat-actions.mjs');
function chatClick(data) {
  const button = new Node(); const chatRoot = new Root({ '.weapon-damage-apply': button });
  for (const hook of ['renderChatMessage', 'renderChatMessageHTML']) for (const callback of hooks.get(hook) ?? []) callback({ id: 'message', flags: { 'vtm-revised': { type: 'weaponDamage', damageSuccesses: 1, damageType: 'aggravated', ...data } } }, chatRoot);
  return button.fire();
}
let clicks = chatClick({ targetActorUuid: 'Actor.missing' }); await clicks;
assert.ok(warnings.at(-1).includes('Цель этого броска'));
clicks = chatClick({}); pickerDialog = dialogs.at(-1);
assert.equal(pickerDialog.options.title, 'Получатель урона');
assert.ok(!pickerDialog.options.content.includes('Видимый'));
await pickerDialog.close(); await clicks;
console.log('✓ target visibility/search/portraits, cancellation, ownership, sheet memory/reset, snapshot, deletion and legacy chat picker');
clicks = chatClick({ targetActorUuid: owned.uuid });
await new Promise(resolve => setImmediate(resolve));
let damageDialog = dialogs.at(-1);
assert.equal(damageDialog.options.title, 'Защита цели');
damageDialog.options.buttons.next.callback(new Root());
await new Promise(resolve => setImmediate(resolve));
damageDialog = dialogs.at(-1);
assert.equal(damageDialog.options.title, 'Применить урон');
assert.ok(damageDialog.options.content.includes('Ёж'));
damageDialog.options.buttons.apply.callback(new Root({ levels: new Node({ value: '1' }) }));
await clicks;
assert.equal(owned.lastUpdate['system.health.bruised'], 3);
assert.equal(synthetic.lastUpdate, undefined, 'changing token target never redirects stored damage');
console.log('✓ stored chat target receives damage after the current selection changes');
