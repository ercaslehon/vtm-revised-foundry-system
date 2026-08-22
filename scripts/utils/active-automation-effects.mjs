function plain(value) {
  return foundry.utils.deepClone(value ?? {});
}

export function automationEffectFromItem(item) {
  const configured = plain(item?.system?.automation?.effect);
  const duration = String(configured.duration || item?.system?.mechanics?.duration || "").trim();
  if (!duration) return null;
  return {
    id: foundry.utils.randomID(), name: String(configured.label || item.name || "Активный эффект"),
    itemUuid: item.uuid || "", duration, scope: String(configured.scope || "scene"),
    diceModifier: Number(configured.diceModifier || 0), difficultyModifier: Number(configured.difficultyModifier || 0),
    target: String(configured.target || ""), notes: String(configured.notes || item?.system?.mechanics?.automationNotes || ""),
    createdAt: new Date().toISOString()
  };
}

export async function registerAutomationEffect(actor, item) {
  const effect = automationEffectFromItem(item);
  if (!actor || !effect) return null;
  const current = Array.from(actor.system?.automation?.activeEffects ?? []).map(plain);
  const duplicate = current.find(entry => entry.itemUuid && entry.itemUuid === effect.itemUuid);
  const next = duplicate ? current.map(entry => entry.id === duplicate.id ? { ...effect, id: duplicate.id } : entry) : [...current, effect];
  await actor.update({ "system.automation.activeEffects": next });
  return effect;
}

export async function clearAutomationEffects(actor, scope = "all") {
  const current = Array.from(actor?.system?.automation?.activeEffects ?? []).map(plain);
  const next = scope === "all" ? [] : current.filter(effect => String(effect.scope || "scene") !== scope);
  await actor.update({ "system.automation.activeEffects": next });
  return current.length - next.length;
}
