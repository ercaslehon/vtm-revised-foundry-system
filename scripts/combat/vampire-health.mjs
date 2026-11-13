// Vampire: The Masquerade Revised, health/combat. Tens remain the system house rule.
export const HEALTH_KEYS = ["bruised", "hurt", "injured", "wounded", "mauled", "crippled", "incapacitated"];
export const CONDITION_LABELS = { active: "В сознании", torpor: "Торпор", finalDeath: "Окончательная Смерть" };
const number = value => Number.isFinite(Number(value)) ? Math.max(0, Math.trunc(Number(value))) : 0;
const damageValue = value => Math.min(3, number(value));
const hasHugeSize = actor => Array.from(actor.items ?? []).some(item => item.type === "merit" &&
  [item.name, item.system?.rulesId, item.system?.rawName, item.system?.slug, ...(Array.isArray(item.system?.aliases) ? item.system.aliases : [])]
    .some(value => /^(huge[ -]size|огромные размеры|огромный размер)$/i.test(String(value ?? "").trim())));
export function healthKeys(actor) {
  // Keep an occupied extra box if its merit was removed; never discard a wound.
  return hasHugeSize(actor) || number(actor.system?.health?.extraBruised) ? ["extraBruised", ...HEALTH_KEYS] : [...HEALTH_KEYS];
}
export function wounds(actor) {
  return healthKeys(actor).map(key => damageValue(actor.system?.health?.[key])).filter(Boolean)
    .sort((a, b) => Number(b === 3) - Number(a === 3));
}
export function healthCondition(actor) {
  const condition = actor.system?.health?.condition;
  if (condition === "finalDeath" || condition === "torpor") return condition;
  return wounds(actor).length >= healthKeys(actor).length && number(actor.system?.resources?.blood?.value) === 0 ? "torpor" : "active";
}
export function healthPenalty(actor) {
  const keys = healthKeys(actor), count = wounds(actor).length, condition = healthCondition(actor);
  const key = count ? keys[Math.min(count, keys.length) - 1] : "healthy";
  const incapacitated = condition !== "active" || count >= keys.length;
  const penalties = { hurt: -1, injured: -1, wounded: -2, mauled: -2, crippled: -5 };
  return { key, condition, incapacitated, value: incapacitated || actor.system?.automation?.frenzy ? 0 : penalties[key] ?? 0 };
}
function pack(actor, values, condition = healthCondition(actor)) {
  const sorted = values.filter(Boolean).sort((a, b) => Number(b === 3) - Number(a === 3));
  const update = { "system.health.condition": condition, "system.health.extraBruised": 0 };
  healthKeys(actor).forEach((key, index) => { update[`system.health.${key}`] = sorted[index] ?? 0; });
  return update;
}
export function editHealth(actor, key, value) {
  const keys = healthKeys(actor);
  if (!keys.includes(key)) throw new Error("Unknown health box");
  return pack(actor, keys.map(entry => entry === key ? damageValue(value) : damageValue(actor.system?.health?.[entry])));
}
export function planDamage(actor, levels, type) {
  if (!["bashing", "lethal", "aggravated"].includes(type)) throw new Error("Unknown damage type");
  const count = number(levels), values = wounds(actor), capacity = healthKeys(actor).length;
  let condition = healthCondition(actor);
  if (!count || condition === "finalDeath") return { update: {}, applied: 0, overflow: 0, condition };
  const applied = Math.min(count, capacity - values.length), overflow = count - applied;
  // Filling the final box is incapacitation. Only damage beyond it kills.
  if (type === "aggravated" && (overflow > 0 || condition === "torpor")) condition = "finalDeath";
  else if (overflow > 0) condition = "torpor";
  values.push(...Array(applied).fill(type === "aggravated" ? 3 : type === "lethal" ? 2 : 1));
  if (condition === "active" && values.length === capacity && number(actor.system?.resources?.blood?.value) === 0) condition = "torpor";
  return { update: { ...pack(actor, values, condition), "system.health.restStartedAt": -1, "system.health.restCompletedAt": -1 }, applied, overflow, condition };
}
export function planHealing(actor, { aggravated = false, extra = false, now = 0, restConfirmed = false, outcome = "success" } = {}) {
  if (healthCondition(actor) === "finalDeath") throw new Error("Окончательная Смерть: лечение невозможно.");
  const values = wounds(actor);
  if (aggravated && values.some(value => value !== 3)) throw new Error("Сначала исцели ударные и летальные раны.");
  const index = values.findLastIndex(value => aggravated ? value === 3 : value !== 3);
  if (index < 0) throw new Error("Повреждений выбранного типа нет.");
  const health = actor.system?.health ?? {};
  if (aggravated) {
    if (extra) {
      if (number(health.extraHealingUsed) || !(health.restCompletedAt >= 0) || now < health.restCompletedAt || now - health.restCompletedAt >= 86400)
        throw new Error("Дополнительное лечение доступно один раз после завершения дневного отдыха.");
    } else if (!(health.restStartedAt >= 0) || (!restConfirmed && now - health.restStartedAt < 86400)) {
      throw new Error("Для лечения нужен полный день отдыха.");
    }
  }
  const blood = number(actor.system?.resources?.blood?.value), cost = aggravated ? 5 : 1;
  const willpower = number(actor.system?.resources?.willpower?.value);
  if (blood < cost) throw new Error(`Недостаточно крови: нужно ${cost}.`);
  if (extra && willpower < 1) throw new Error("Для дополнительного лечения нужна 1 Сила воли.");
  const spent = number(actor.system?.automation?.bloodSpentTurn);
  const limit = number(actor.generationCaps?.bloodPerTurn ?? actor.system?.resources?.bloodPerTurn ?? 1);
  if (!aggravated && spent + cost > limit) throw new Error(`Лимит крови за ход: ${limit}; потрачено ${spent}.`);
  if (outcome === "success") values.splice(index, 1);
  const update = { ...pack(actor, values), "system.resources.blood.value": blood - cost };
  if (!aggravated) update["system.automation.bloodSpentTurn"] = spent + cost;
  else if (extra) {
    update["system.resources.willpower.value"] = willpower - 1;
    update["system.health.extraHealingUsed"] = true;
  } else {
    update["system.health.restStartedAt"] = -1;
    update["system.health.restCompletedAt"] = now;
    update["system.health.extraHealingUsed"] = false;
  }
  if (outcome === "botch") {
    const projected = structuredClone(actor.system.toObject?.() ?? actor.system);
    for (const [path, value] of Object.entries(update)) {
      const parts = path.split(".").slice(1); let target = projected;
      for (const part of parts.slice(0, -1)) target = target[part] ??= {};
      target[parts.at(-1)] = value;
    }
    Object.assign(update, planDamage({ ...actor, items: actor.items, system: projected }, 1, "lethal").update);
  }
  return { update, cost, healed: outcome === "success" ? 1 : 0 };
}
