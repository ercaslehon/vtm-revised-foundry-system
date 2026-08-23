import { clearAutomationEffects } from "../utils/active-automation-effects.mjs";

export const VTM_STATUS_EFFECTS = [
  { id: "vtm-stunned", name: "Оглушён", icon: "icons/svg/daze.svg", scope: "turn", scopeLabel: "до конца хода", description: "Штраф −2 кубика ко всем действиям.", dice: -2, physicalOnly: false },
  { id: "vtm-prone", name: "Сбит с ног", icon: "icons/svg/falling.svg", scope: "turn", scopeLabel: "до конца хода", description: "Штраф −2 кубика к физическим действиям.", dice: -2, physicalOnly: true },
  { id: "vtm-blinded", name: "Ослеплён", icon: "icons/svg/blind.svg", scope: "scene", scopeLabel: "до конца сцены", description: "Персонаж не видит; точные ограничения определяет Рассказчик." },
  { id: "vtm-immobilized", name: "Обездвижен", icon: "icons/svg/net.svg", scope: "manual", scopeLabel: "до ручного снятия", description: "Персонаж не может свободно перемещаться; точные ограничения определяет Рассказчик." },
  { id: "vtm-frightened", name: "Испуган", icon: "icons/svg/terror.svg", scope: "scene", scopeLabel: "до конца сцены", description: "Персонаж действует под влиянием страха; точные ограничения определяет Рассказчик." },
  { id: "vtm-possessed", name: "Одержим", icon: "icons/svg/aura.svg", scope: "manual", scopeLabel: "до ручного снятия", description: "Тело или разум контролируется внешней сущностью; точный эффект определяет Рассказчик." }
];

export function registerVtmStatusEffects() {
  const existing = new Set((CONFIG.statusEffects ?? []).map(effect => effect.id));
  for (const status of VTM_STATUS_EFFECTS) {
    if (!existing.has(status.id)) CONFIG.statusEffects.push({ id: status.id, name: status.name, img: status.icon, flags: { "vtm-revised": { scope: status.scope } } });
  }
}

export function actorHasStatus(actor, id) {
  return actor?.statuses?.has?.(id) || Array.from(actor?.effects ?? []).some(effect => effect.statuses?.has?.(id));
}

export function statusRollModifier(actor, { physical = false } = {}) {
  let dice = 0;
  const labels = [];
  for (const status of VTM_STATUS_EFFECTS) {
    if (!actorHasStatus(actor, status.id) || !status.dice || (status.physicalOnly && !physical)) continue;
    dice += Number(status.dice);
    labels.push(`${status.name} ${status.dice}`);
  }
  return { dice, label: labels.join(", ") };
}

export async function clearVtmStatuses(actor, scope) {
  const ids = new Set(VTM_STATUS_EFFECTS.filter(status => scope === "all" || status.scope === scope).map(status => status.id));
  const effects = Array.from(actor?.effects ?? []).filter(effect => Array.from(effect.statuses ?? []).some(status => ids.has(status)));
  if (effects.length) await actor.deleteEmbeddedDocuments("ActiveEffect", effects.map(effect => effect.id));
  return effects.length;
}

Hooks.on("updateCombat", async (combat, changed) => {
  if (!game.user?.isGM || !("turn" in changed || "round" in changed)) return;
  const previous = combat.previous?.combatant?.actor;
  if (!previous) return;
  await clearVtmStatuses(previous, "turn");
  await clearAutomationEffects(previous, "turn");
  const update = previous.type === "demon"
    ? { "system.automation.formExtraActionsTurn": 0 }
    : { "system.automation.bloodSpentTurn": 0, "system.automation.celerityActionsTurn": 0 };
  await previous.update(update);
});
