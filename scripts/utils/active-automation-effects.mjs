function plain(value) {
  return globalThis.foundry?.utils?.deepClone ? foundry.utils.deepClone(value ?? {}) : structuredClone(value ?? {});
}

const FLAG_SCOPE = "vtm-revised";
const FLAG_TYPE = "automationEffect";

function selectorMatches(selector = "", trait = "") {
  const normalized = String(selector || "*").trim();
  return !normalized || normalized === "*" || normalized === "all"
    || (normalized.endsWith(".*") ? String(trait).startsWith(normalized.slice(0, -1)) : normalized === trait);
}

function foundryEffectData(effect) {
  const flag = effect?.flags?.[FLAG_SCOPE];
  if (flag?.type !== FLAG_TYPE) return null;
  return { ...plain(flag), id: effect.id, name: effect.name, img: effect.img, disabled: Boolean(effect.disabled) };
}

export function activeAutomationEffects(actor) {
  const modern = Array.from(actor?.effects ?? []).map(foundryEffectData).filter(effect => effect && !effect.disabled);
  const legacy = Array.from(actor?.system?.automation?.activeEffects ?? []).map(effect => ({ ...plain(effect), legacy: true }));
  const modernItems = new Set(modern.map(effect => effect.itemUuid).filter(Boolean));
  return [...modern, ...legacy.filter(effect => !effect.itemUuid || !modernItems.has(effect.itemUuid))];
}

export function activeAutomationRollModifier(actor, traits = []) {
  const matching = activeAutomationEffects(actor).filter(effect => {
    if (!Number(effect.diceModifier || 0) && !Number(effect.difficultyModifier || 0)) return false;
    const selectors = String(effect.target || "*").split(",").map(value => value.trim()).filter(Boolean);
    return (selectors.length ? selectors : ["*"]).some(selector => traits.some(trait => selectorMatches(selector, trait)));
  });
  return {
    dice: matching.reduce((total, effect) => total + Number(effect.diceModifier || 0), 0),
    difficulty: matching.reduce((total, effect) => total + Number(effect.difficultyModifier || 0), 0),
    effects: matching
  };
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
  const duplicate = Array.from(actor.effects ?? []).find(entry => entry.flags?.[FLAG_SCOPE]?.type === FLAG_TYPE && effect.itemUuid && entry.flags?.[FLAG_SCOPE]?.itemUuid === effect.itemUuid);
  const data = {
    name: effect.name,
    img: item.img || "icons/svg/aura.svg",
    disabled: false,
    changes: [],
    duration: {},
    description: effect.notes,
    flags: { [FLAG_SCOPE]: { type: FLAG_TYPE, ...effect } }
  };
  if (duplicate) {
    await duplicate.update(data);
    return foundryEffectData(duplicate) ?? effect;
  }
  const [created] = await actor.createEmbeddedDocuments("ActiveEffect", [data]);
  return foundryEffectData(created) ?? effect;
}

export async function clearAutomationEffects(actor, scope = "all") {
  const modern = Array.from(actor?.effects ?? []).filter(effect => {
    const flag = effect.flags?.[FLAG_SCOPE];
    return flag?.type === FLAG_TYPE && (scope === "all" || String(flag.scope || "scene") === scope);
  });
  if (modern.length) await actor.deleteEmbeddedDocuments("ActiveEffect", modern.map(effect => effect.id));
  const current = Array.from(actor?.system?.automation?.activeEffects ?? []).map(plain);
  const next = scope === "all" ? [] : current.filter(effect => String(effect.scope || "scene") !== scope);
  if (current.length !== next.length) await actor.update({ "system.automation.activeEffects": next });
  return modern.length + current.length - next.length;
}
