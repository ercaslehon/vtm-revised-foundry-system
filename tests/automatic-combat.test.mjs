import assert from "node:assert/strict";
const hooks = new Map(), messages = [], warnings = [], rolls = [], documents = new Map(), settings = new Map();
let diceQueue = [], nextId = 0;
const getProperty = (object, path) => path.split('.').reduce((value, part) => value?.[part], object);
const setProperty = (object, path, value) => { const parts = path.split('.'); let target = object; for (const part of parts.slice(0, -1)) target = target[part] ??= {}; target[parts.at(-1)] = value; };
const escapeHTML = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
class App {}
globalThis.foundry = { applications: { api: { ApplicationV2: App, HandlebarsApplicationMixin: base => base }, sheets: { ActorSheetV2: App } },
  appv1: { api: { Dialog: class { constructor() { throw new Error('Automatic combat must never open a GM dialog'); } } } },
  utils: { getProperty, setProperty, escapeHTML, deepClone: structuredClone } };
globalThis.Hooks = { on: (name, callback) => { const all = hooks.get(name) ?? []; all.push(callback); hooks.set(name, all); }, once() {} };
globalThis.ui = { notifications: { warn: message => warnings.push(message), info() {}, error: message => { throw new Error(message); } } };
const gm = { id: 'a-gm', isGM: true, active: true }, gm2 = { id: 'z-gm', isGM: true, active: true }, player = { id: 'vova', isGM: false, active: true }, stranger = { id: 'stranger', isGM: false, active: true };
const users = [gm, gm2, player, stranger]; users.get = id => users.find(user => user.id === id);
globalThis.game = { user: gm, users, actors: { contents: [] }, messages, items: [], time: { worldTime: 0 }, i18n: { lang: 'ru', localize: key => key, format: key => key },
  settings: { get: (scope, key) => settings.get(`${scope}.${key}`) ?? [], set: async (scope, key, value) => { assert.equal(game.user.isGM, true); settings.set(`${scope}.${key}`, structuredClone(value)); } } };
globalThis.fromUuid = async uuid => { const doc = documents.get(uuid); if (doc && !game.user.isGM && !doc.isOwner) throw new Error('No access'); return doc; };
globalThis.renderTemplate = async (_path, context) => JSON.stringify({ target: context.targetActorName, result: context.successes });
globalThis.Roll = class {
  constructor(formula) { this.formula = formula; rolls.push(formula); }
  async evaluate() { const values = diceQueue.shift(); assert.ok(values, `Unexpected roll ${this.formula}`); assert.equal(values.length, Number(this.formula.split('d')[0])); this.dice = [{ results: values.map(result => ({ result })) }]; return this; }
  async toMessage(data) { return ChatMessage.create(data); }
};
globalThis.ChatMessage = { getSpeaker: ({ actor }) => ({ actor: actor.id }), create: async data => {
  const message = { ...data, id: `message-${++nextId}`, timestamp: Date.now(), author: game.user,
    async update(update) { for (const [path, value] of Object.entries(update)) setProperty(this, path, value); return this; } };
  messages.push(message); return message;
} };
const { VTMVampireActorSheet } = await import('../scripts/sheets/vampire-actor-sheet.mjs');
const { requestAutomaticAttack, enqueueAutomaticAttack, validateAttackRequest, resolveAttackWeapon } = await import('../scripts/combat/combat-authority.mjs');
const { publishCombatNames, sharedCombatNames } = await import('../scripts/combat/combat-roster.mjs');
const { combatTargetCandidates, combatTargetMarkup, resolveCombatTarget } = await import('../scripts/combat/combat-targets.mjs');
function actor(id, owner = '') {
  const a = { id, uuid: `Actor.${id}`, documentName: 'Actor', name: id, img: `secret-${id}.webp`, type: 'vampire', items: [], effects: [], flags: {}, generationCaps: { bloodPerTurn: 1 }, updates: [],
    get isOwner() { return game.user.isGM || game.user.id === owner; },
    testUserPermission(user, permission) { return user.isGM || user.id === owner; },
    system: { health: { condition: 'active', bruised: 0, hurt: 0, injured: 0, wounded: 0, mauled: 0, crippled: 0, incapacitated: 0 },
      attributes: { physical: { strength: 3, dexterity: 3, stamina: 3 } }, abilities: { skills: { melee: { value: 2 } }, talents: { dodge: { value: 2 } } },
      resources: { blood: { value: 10 } }, automation: {} },
    getFlag(scope, key) { return this.flags?.[scope]?.[key]; },
    async update(update) { assert.equal(game.user.isGM, true, 'only GM writes hidden target'); this.updates.push(update); for (const [path, value] of Object.entries(update)) setProperty(this, path, value); return this; }
  };
  a.sheet = Object.create(VTMVampireActorSheet.prototype); a.sheet.document = a;
  a.items.get = id => a.items.find(item => item.id === id);
  documents.set(a.uuid, a); game.actors.contents.push(a); return a;
}
const attacker = actor('Вова', player.id), victim = actor('Скрытый персонаж'), other = actor('Третий');
const sword = { id: 'sword', type: 'weapon', name: 'Меч', system: { weapon: { category: 'melee', usesStrength: true, damageBonus: 2, damageType: 'lethal' } } };
attacker.items.push(sword);
await publishCombatNames();
const roster = settings.get('vtm-revised.combatTargetNames');
assert.equal(roster.length, 3);
for (const row of roster) assert.deepEqual(Object.keys(row).sort(), ['name', 'uuid']);
game.user = player;
assert.equal(sharedCombatNames().length, 3);
const proxy = await resolveCombatTarget(victim.uuid);
assert.equal(proxy.name, victim.name); assert.equal(proxy.combatNameOnly, true); assert.equal(proxy.system, undefined); assert.equal(proxy.img, undefined);
assert.equal(combatTargetCandidates().length, 3);
for (const a of combatTargetCandidates()) assert.equal(combatTargetMarkup(a).includes('<img'), false);
const options = { firstTrait: 'attribute.physical.dexterity', secondTrait: 'ability.skills.melee', difficulty: 6, damageDifficulty: 6, targetActor: proxy, defenseType: 'dodge' };
let request = await requestAutomaticAttack(attacker.sheet, sword, options);
assert.equal(request.author, player);
assert.equal(request.flags['vtm-revised'].type, 'automaticAttackRequest');
assert.equal(rolls.length, 0); assert.equal(victim.updates.length, 0);
// Second GM does not execute. Primary performs the actual sheet attack, dodge,
// damage, soak and one atomic health write, then publishes a final result.
game.user = gm2; await enqueueAutomaticAttack(request); assert.equal(rolls.length, 0);
game.user = gm;
diceQueue = [[10, 10, 6, 2, 2], [6, 2, 2, 2, 2], [10, 10, 6, 2, 2, 2, 2, 2], [6, 6, 2]];
await Promise.all([enqueueAutomaticAttack(request), enqueueAutomaticAttack(request)]);
assert.equal(request.flags['vtm-revised'].state, 'completed');
assert.deepEqual(rolls, ['5d10', '5d10', '8d10', '3d10']);
assert.equal(victim.updates.length, 1);
assert.equal(victim.system.health.injured, 2);
let result = messages.findLast(m => m.flags?.['vtm-revised']?.type === 'automaticAttackResult');
assert.equal(result.flags['vtm-revised'].finalDamage, 3);
assert.equal(result.flags['vtm-revised'].soakSuccesses, 2);
assert.equal(result.flags['vtm-revised'].defenseSuccesses, 1);
assert.ok(!result.content.includes('weapon-damage-apply'));
await enqueueAutomaticAttack(request); assert.equal(rolls.length, 4);
request.flags['vtm-revised'].state = 'pending';
await assert.rejects(validateAttackRequest(request), /уже применён/);
request.flags['vtm-revised'].state = 'completed';
// Server-assigned author permission wins over any supplied IDs or fake item stats.
const forged = { ...request, id: 'forged', author: stranger, flags: { 'vtm-revised': { ...request.flags['vtm-revised'], state: 'pending', requesterId: player.id } } };
await assert.rejects(validateAttackRequest(forged), /Нет права/);
assert.throws(() => resolveAttackWeapon(attacker, 'invented-weapon'), /недоступны/);
assert.equal(resolveAttackWeapon(attacker, 'maneuver-bite').system.weapon.damageType, 'aggravated');
// Miss ends with zero damage and no damage/soak roll.
game.user = player; request = await requestAutomaticAttack(attacker.sheet, sword, { ...options, targetActor: await resolveCombatTarget(other.uuid) });
game.user = gm; diceQueue = [[6, 2, 2, 2, 2], [10, 2, 2, 2, 2]];
await enqueueAutomaticAttack(request);
result = messages.findLast(m => m.flags?.['vtm-revised']?.type === 'automaticAttackResult');
assert.equal(result.flags['vtm-revised'].finalDamage, 0);
assert.equal(other.system.health.bruised, 0);
assert.equal(diceQueue.length, 0);
// Firearms against vampires become bashing; a single unsoaked success rounds to zero.
const gun = { id: 'gun', type: 'weapon', name: 'Пистолет', system: { weapon: { category: 'firearm', usesStrength: false, damageDice: 1, damageType: 'lethal', addsAttackSuccesses: false } } }; attacker.items.push(gun);
game.user = player; request = await requestAutomaticAttack(attacker.sheet, gun, { ...options, targetActor: await resolveCombatTarget(other.uuid), defenseType: '' });
game.user = gm; diceQueue = [[6, 2, 2, 2, 2], [6], [1, 1, 1]];
await enqueueAutomaticAttack(request);
result = messages.findLast(m => m.flags?.['vtm-revised']?.type === 'automaticAttackResult');
assert.equal(result.flags['vtm-revised'].damageType, 'bashing'); assert.equal(result.flags['vtm-revised'].finalDamage, 0);
const soak = messages.findLast(m => m.flags?.['vtm-revised']?.rollKind === 'soak');
assert.equal(soak.flags['vtm-revised'].botch, false);
// Two different attacks queued together must retain both wounds.
const concurrent = actor('Очередь'); await publishCombatNames();
game.user = player;
const concurrentOptions = { ...options, targetActor: await resolveCombatTarget(concurrent.uuid), defenseType: '' };
const firstRequest = await requestAutomaticAttack(attacker.sheet, sword, concurrentOptions);
const secondRequest = await requestAutomaticAttack(attacker.sheet, sword, concurrentOptions);
game.user = gm;
diceQueue = [[6,2,2,2,2], [6,2,2,2,2], [2,2,2], [6,2,2,2,2], [6,2,2,2,2], [2,2,2]];
await Promise.all([enqueueAutomaticAttack(firstRequest), enqueueAutomaticAttack(secondRequest)]);
assert.equal(concurrent.system.health.bruised, 2); assert.equal(concurrent.system.health.hurt, 2);
assert.equal(concurrent.updates.length, 2);
// A partial request is not retried when another GM reconnects.
firstRequest.flags['vtm-revised'].state = 'processing';
const beforeRetry = rolls.length;
await enqueueAutomaticAttack(firstRequest); assert.equal(rolls.length, beforeRetry);
// Demon attackers use the same automatic pipeline without a modal on the GM.
const { DemonActorSheet } = await import('../scripts/sheets/demon-actor-sheet.mjs');
const demon = actor('Падший', player.id); demon.type = 'demon';
demon.sheet = Object.create(DemonActorSheet.prototype); demon.sheet.document = demon; demon.items.push(sword);
const demonTarget = actor('Цель Падшего'); await publishCombatNames();
game.user = player;
const demonRequest = await requestAutomaticAttack(demon.sheet, sword, { ...options, targetActor: await resolveCombatTarget(demonTarget.uuid), defenseType: '' });
game.user = gm; diceQueue = [[6,2,2,2,2], [6,2,2,2,2], [2,2,2]];
await enqueueAutomaticAttack(demonRequest);
assert.equal(demonRequest.flags['vtm-revised'].state, 'completed');
assert.equal(demonTarget.system.health.bruised, 2);
console.log('✓ concurrent attacks preserve both wounds; partial requests do not replay; Demon attack resolves without GM dialogs');
// Missing GM prevents all rolls/updates, while the last names roster stays usable.
game.user = player; gm.active = gm2.active = false;
const before = messages.length;
assert.equal(await requestAutomaticAttack(attacker.sheet, sword, options), null);
assert.equal(messages.length, before); assert.ok(warnings.at(-1).includes('Рассказчик'));
assert.equal(sharedCombatNames().length, 6);
console.log('✓ name-only roster for player; authoritative ownership; primary GM; real attack→dodge→damage→soak→health; final chat; zero damage; no botches; idempotency; no-GM handling');
