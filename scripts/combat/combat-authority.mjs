import { COMBAT_SCOPE, primaryCombatGM, isCombatGM } from "./combat-roster.mjs";
import { getActiveDemonFormSummary } from "../data/demon/demon-apocalyptic-mechanics.mjs";
const escape = value => foundry.utils.escapeHTML(String(value ?? ""));
const requestData = message => message.flags?.[COMBAT_SCOPE];

// Only identifiers and choices cross the client boundary. Weapon stats and dice
// pools are reconstructed on the GM from the owned actor's actual documents.
export function resolveAttackWeapon(actor, id) {
  const owned = actor.items?.get?.(id) ?? Array.from(actor.items ?? []).find(item => item.id === id);
  if (owned?.type === "weapon") return owned;
  const maneuvers = {
    "maneuver-punch": { name: "Удар кулаком", difficulty: 6, damageBonus: 0, damageType: "bashing" },
    "maneuver-kick": { name: "Удар ногой", difficulty: 7, damageBonus: 1, damageType: "bashing" },
    "maneuver-bite": { name: "Укус", difficulty: 6, damageBonus: 1, damageType: actor.type === "vampire" ? "aggravated" : "lethal" }
  };
  const maneuver = Object.hasOwn(maneuvers, id) ? maneuvers[id] : null;
  if (maneuver) return { id, name: maneuver.name, system: { weapon: { ...maneuver, category: "melee", usesStrength: true,
    attackFirstTrait: "attribute.physical.dexterity", attackSecondTrait: "ability.talents.brawl", damageDifficulty: 6, addsAttackSuccesses: true } } };
  if (actor.type === "demon" && actor.system?.apocalypticForm?.active) {
    const ability = getActiveDemonFormSummary(actor).abilities.find(entry => `form-${entry.loreKey}-${entry.tier}-${entry.index}` === id);
    const attack = ability?.mechanic?.naturalAttack;
    if (attack) return { id, name: ability.mechanic.label || "Естественная атака", system: { weapon: {
      category: "melee", attackFirstTrait: "attribute.physical.dexterity", attackSecondTrait: "ability.talents.brawl",
      difficulty: Number(attack.difficulty || 6), damageDifficulty: 6, usesStrength: attack.usesStrength !== false,
      damageBonus: Number(attack.damageBonus || 0), damageDice: Number(attack.damageDice || 0), damageType: attack.damageType || "aggravated", addsAttackSuccesses: true
    } } };
  }
  throw new Error("Оружие или боевая способность больше недоступны.");
}
export async function requestAutomaticAttack(sheet, item, options) {
  if (!primaryCombatGM()) { ui.notifications?.warn?.("Для автоматического боя нужен подключённый Рассказчик."); return null; }
  if (!sheet.actor.isOwner && !game.user.isGM) return null;
  const target = options.targetActor;
  if (!target?.uuid) return null;
  const choices = { firstTrait: options.firstTrait, secondTrait: options.secondTrait, difficulty: options.difficulty,
    damageDifficulty: options.damageDifficulty, defenseType: options.defenseType ?? "dodge", ignoreArmor: Boolean(options.ignoreArmor),
    headshot: Boolean(options.headshot), damageSource: options.damageSource ?? "unknown", goodRightHook: Boolean(options.goodRightHook) };
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: sheet.actor }),
    whisper: [...new Set([game.user.id, ...Array.from(game.users ?? []).filter(user => user.isGM).map(user => user.id)])],
    content: `<article class="vtm-chat-card"><h3>Атака: ${escape(sheet.actor.name)} → ${escape(target.name)}</h3><p>Ожидает автоматического расчёта Рассказчиком.</p></article>`,
    flags: { [COMBAT_SCOPE]: { type: "automaticAttackRequest", state: "pending", actorUuid: sheet.actor.uuid,
      targetActorUuid: target.uuid, itemId: item.id, choices } }
  });
}
export async function validateAttackRequest(message) {
  const data = requestData(message);
  if (data?.type !== "automaticAttackRequest" || data.state !== "pending") return null;
  // The server-assigned ChatMessage author is the authority, never a payload userId.
  const authorId = message.author?.id ?? message.user?.id ?? (typeof message.author === "string" ? message.author : message.user);
  const author = game.users?.get?.(authorId) ?? Array.from(game.users ?? []).find(user => user.id === authorId);
  if (!author) throw new Error("Автор атаки недоступен.");
  const actor = await fromUuid(data.actorUuid), target = await fromUuid(data.targetActorUuid);
  if (actor?.documentName !== "Actor" || target?.documentName !== "Actor") throw new Error("Персонаж или цель удалены.");
  if (!author.isGM && !actor.testUserPermission(author, "OWNER")) throw new Error("Нет права атаковать от имени этого персонажа.");
  const receipts = target.getFlag?.(COMBAT_SCOPE, "appliedAttackRequests") ?? target.flags?.[COMBAT_SCOPE]?.appliedAttackRequests ?? [];
  if (receipts.includes(message.id)) throw new Error("Урон этой атаки уже применён.");
  const item = resolveAttackWeapon(actor, data.itemId);
  const input = data.choices ?? {}, sheet = actor.sheet;
  if (!sheet?._rollWeaponAttackAndDamage || !sheet._resolveTraitOption(input.firstTrait)
    || (input.secondTrait && !sheet._resolveTraitOption(input.secondTrait))) throw new Error("Неверные параметры атаки.");
  for (const key of ["difficulty", "damageDifficulty"]) {
    if (!Number.isInteger(input[key]) || input[key] < 2 || input[key] > 10) throw new Error("Сложность должна быть от 2 до 10.");
  }
  if (!["", "dodge", "parry", "block"].includes(input.defenseType)) throw new Error("Неизвестный вид защиты.");
  return { sheet, item, options: { firstTrait: input.firstTrait, secondTrait: input.secondTrait || "", difficulty: input.difficulty,
    damageDifficulty: input.damageDifficulty, defenseType: input.defenseType, targetActor: target, automateTarget: true,
    requestId: message.id, ignoreArmor: input.ignoreArmor === true, headshot: input.headshot === true,
    damageSource: ["physical", "fire", "sunlight"].includes(input.damageSource) ? input.damageSource : "unknown",
    goodRightHook: input.goodRightHook === true } };
}
let queue = Promise.resolve();
const queued = new Set();
async function executeRequest(message) {
  if (!isCombatGM() || requestData(message)?.state !== "pending") return;
  try {
    const attack = await validateAttackRequest(message);
    if (!attack || !isCombatGM()) return;
    await message.update({ [`flags.${COMBAT_SCOPE}.state`]: "processing",
      content: '<article class="vtm-chat-card"><p>Выполняется автоматическая атака.</p></article>' });
    if (!isCombatGM()) return;
    const result = await attack.sheet._rollWeaponAttackAndDamage(attack.item, attack.options);
    if (!result) throw new Error("Атака не выполнена: проверь состояние и запас кубиков атакующего.");
    await message.update({ [`flags.${COMBAT_SCOPE}.state`]: "completed",
      content: '<article class="vtm-chat-card"><p>Атака рассчитана. Итог опубликован в чате.</p></article>' });
  } catch (error) {
    console.error("VtM | Automatic attack", error);
    if (isCombatGM()) await message.update({ [`flags.${COMBAT_SCOPE}.state`]: "failed",
      content: `<article class="vtm-chat-card"><p>Атака остановлена: ${escape(error.message)}</p></article>` });
  }
}
export function enqueueAutomaticAttack(message) {
  if (!isCombatGM() || requestData(message)?.type !== "automaticAttackRequest" || requestData(message)?.state !== "pending" || queued.has(message.id)) return queue;
  queued.add(message.id);
  // Serialize complete attacks so concurrent hits cannot overwrite the health track.
  queue = queue.then(() => executeRequest(message)).catch(error => console.error("VtM | Attack queue", error))
    .finally(() => queued.delete(message.id));
  return queue;
}
function resumePendingAttacks() {
  if (!isCombatGM()) return;
  for (const message of game.messages ?? []) {
    // Never resume a partially applied attack automatically after a GM reconnects.
    if (Number(message.timestamp) >= Date.now() - 300000) void enqueueAutomaticAttack(message);
  }
}
Hooks.on("createChatMessage", message => { void enqueueAutomaticAttack(message); });
Hooks.once?.("ready", resumePendingAttacks);
Hooks.on("userConnected", resumePendingAttacks);
