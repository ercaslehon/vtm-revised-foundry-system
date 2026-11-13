import { COMBAT_SCOPE, primaryCombatGM, isCombatGM } from "./combat-roster.mjs";
const escape = value => foundry.utils.escapeHTML(String(value ?? ""));
const TYPE = "initiativeRequest";
let queue = Promise.resolve();
const queued = new Set();
const serial = task => {
  const result = queue.then(task);
  queue = result.catch(error => console.error("VtM | Initiative", error));
  return result;
};
export const isTokenlessCombat = combat => Boolean(combat?.flags?.[COMBAT_SCOPE]?.actorInitiative);

function resolveCombat(id) {
  const combat = id ? game.combats.get(id) : game.combat;
  if (id && !combat) throw new Error("Этот бой уже завершён или удалён.");
  return combat;
}
async function ensureCombat(id) {
  let combat = resolveCombat(id);
  if (!combat) combat = await CONFIG.Combat.documentClass.create({ name: "Бой", scene: null, active: true, flags: { [COMBAT_SCOPE]: { actorInitiative: true } } });
  else if (!isTokenlessCombat(combat)) await combat.setFlag(COMBAT_SCOPE, "actorInitiative", true);
  return combat;
}
async function ensureParticipants(combat, actors) {
  const missing = actors.filter(actor => !combat.combatants.find(c => c.actorId === actor.id));
  if (missing.length) await combat.createEmbeddedDocuments("Combatant", missing.map(actor => ({ actorId: actor.id, name: actor.name,
    img: actor.img || "icons/svg/mystery-man.svg", tokenId: null, sceneId: null })));
  return actors.map(actor => combat.combatants.find(c => c.actorId === actor.id));
}
export async function executeInitiativeCommand(command, author) {
  if (!game.user.isGM || !author) throw new Error("Для управления боем нужен Рассказчик.");
  const { action } = command;
  if (!["roll", "add", "rollAll", "start", "next", "previous", "remove", "end"].includes(action)) throw new Error("Неизвестное действие боя.");
  if (!author.isGM && !["roll", "next"].includes(action)) throw new Error("Это действие доступно только Рассказчику.");
  // Resolve IDs from world documents and validate ownership on the GM, never trust client totals.
  if (action === "roll" || action === "add") {
    const ids = action === "roll" ? [command.actorId] : command.actorIds;
    if (!Array.isArray(ids) || !ids.length || ids.length > 100) throw new Error("Выберите участников боя.");
    const actors = [...new Set(ids)].map(id => game.actors.get(id));
    if (actors.some(actor => !actor || !["vampire", "npc", "demon"].includes(actor.type))) throw new Error("Персонаж больше недоступен.");
    if (!author.isGM && actors.some(actor => !actor.testUserPermission(author, "OWNER"))) throw new Error("Можно бросать инициативу только своего персонажа.");
    const combat = await ensureCombat(command.combatId);
    const participants = await ensureParticipants(combat, actors);
    if (action === "roll") await combat.rollInitiative(participants.map(c => c.id));
    return combat;
  }
  const combat = resolveCombat(command.combatId);
  if (!combat) throw new Error("Сначала добавьте участников боя.");
  if (action === "next") {
    if (combat.round !== command.round || combat.turn !== command.turn || combat.combatant?.id !== command.combatantId)
      throw new Error("Очередь уже изменилась. Проверьте текущий ход.");
    if (!author.isGM && (!combat.started || !combat.combatant?.actor?.testUserPermission(author, "OWNER")))
      throw new Error("Сейчас ход другого персонажа.");
    return combat.nextTurn();
  }
  if (action === "rollAll") return combat.rollAll();
  if (action === "start") {
    if (combat.started) return combat;
    if (!combat.combatants.size) throw new Error("Сначала добавьте участников боя.");
    await combat.rollAll();
    return combat.startCombat();
  }
  if (action === "previous") return combat.previousTurn();
  if (action === "remove") return combat.deleteEmbeddedDocuments("Combatant", [command.combatantId]);
  if (action === "end") return combat.delete();
}

export async function submitInitiativeCommand(command) {
  if (game.user.isGM && (!primaryCombatGM() || isCombatGM())) return serial(() => executeInitiativeCommand(command, game.user));
  if (!primaryCombatGM()) { ui.notifications?.warn?.("Для очереди инициативы нужен подключённый Рассказчик."); return null; }
  return ChatMessage.create({
    speaker: { alias: game.user.name },
    whisper: [...new Set([game.user.id, ...Array.from(game.users).filter(u => u.isGM).map(u => u.id)])],
    content: '<article class="vtm-chat-card"><p>Запрос инициативы передан Рассказчику.</p></article>',
    flags: { [COMBAT_SCOPE]: { type: TYPE, state: "pending", command } }
  });
}
export function rollActorInitiative(actor) {
  if (!actor || (!actor.isOwner && !game.user.isGM)) return Promise.resolve(null);
  return submitInitiativeCommand({ action: "roll", actorId: actor.id, combatId: game.combat?.id ?? null });
}
export function enqueueInitiativeRequest(message) {
  const data = message.flags?.[COMBAT_SCOPE];
  if (!isCombatGM() || data?.type !== TYPE || data.state !== "pending" || queued.has(message.id)) return queue;
  queued.add(message.id);
  return serial(async () => {
    if (!isCombatGM() || message.flags?.[COMBAT_SCOPE]?.state !== "pending") return;
    try {
      const authorId = message.author?.id ?? message.user?.id ?? (typeof message.author === "string" ? message.author : message.user);
      const author = game.users.get(authorId);
      if (!author) throw new Error("Автор запроса недоступен.");
      await message.update({ [`flags.${COMBAT_SCOPE}.state`]: "processing" });
      await executeInitiativeCommand(data.command ?? {}, author);
      await message.update({ [`flags.${COMBAT_SCOPE}.state`]: "completed", content: '<article class="vtm-chat-card"><p>Очередь инициативы обновлена.</p></article>' });
    } catch (error) {
      await message.update({ [`flags.${COMBAT_SCOPE}.state`]: "failed", content: `<article class="vtm-chat-card"><p>${escape(error.message)}</p></article>` });
    }
  }).finally(() => queued.delete(message.id));
}
function resumeRequests() {
  if (!isCombatGM()) return;
  for (const message of game.messages ?? []) if (Number(message.timestamp) >= Date.now() - 300000) void enqueueInitiativeRequest(message);
}
Hooks.on("createChatMessage", message => { void enqueueInitiativeRequest(message); });
Hooks.once?.("ready", resumeRequests);
Hooks.on("userConnected", resumeRequests);
