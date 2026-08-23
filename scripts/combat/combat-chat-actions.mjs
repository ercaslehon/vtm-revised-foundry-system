import { rollDicePool } from "../dice/dice-pool.mjs";
import { DEMON_APOCALYPTIC_FORMS } from "../data/demon/demon-apocalyptic-forms.mjs";
import { getActiveDemonFormSummary, getDemonFormAbilityMechanic } from "../data/demon/demon-apocalyptic-mechanics.mjs";
import { activeDemonHighTormentIndexes, damageAfterSoak } from "./combat-math.mjs";

const DialogV1 = foundry.appv1?.api?.Dialog ?? globalThis.Dialog;
const HEALTH_LEVELS = ["bruised", "hurt", "injured", "wounded", "mauled", "crippled", "incapacitated"];

function rootElement(html) {
  if (html instanceof HTMLElement) return html;
  if (html?.[0] instanceof HTMLElement) return html[0];
  return null;
}

function selectedTargetActor() {
  const targets = Array.from(game.user?.targets ?? []);
  if (targets.length !== 1) {
    ui.notifications?.warn?.("Выбери ровно один токен-цель.");
    return null;
  }
  return targets[0].actor ?? null;
}

function disciplineRating(actor, names) {
  const normalized = names.map(name => name.toLowerCase());
  const item = Array.from(actor.items ?? []).find(entry => entry.type === "discipline" && normalized.includes(String(entry.name || "").trim().toLowerCase()));
  return Number(item?.system?.rating || 0);
}

function demonFormArmor(actor, damageType) {
  if (actor.type !== "demon" || !actor.system?.apocalypticForm?.active) return 0;
  const form = DEMON_APOCALYPTIC_FORMS[String(actor.system?.creation?.primaryLore || "")];
  if (!form) return 0;
  const selected = new Set(activeDemonHighTormentIndexes(actor.system?.resources?.torment?.max, actor.system?.apocalypticForm?.highTormentSelected));
  const mechanics = [
    ...(form.abilities ?? []).map((_ability, index) => getDemonFormAbilityMechanic(loreKey, "low", index)),
    ...(form.highTormentAbilities ?? []).map((_ability, index) => selected.has(String(index)) ? getDemonFormAbilityMechanic(loreKey, "high", index) : null)
  ].filter(Boolean);
  return mechanics.reduce((total, mechanic) => {
    if (!mechanic.armor || (damageType === "aggravated" && !mechanic.armor.aggravated)) return total;
    return total + Number(mechanic.armor.dice || 0);
  }, 0);
}

function soakPool(actor, damageType, { ignoreArmor = false, demonBase = "stamina" } = {}) {
  const stamina = Number(actor.system?.attributes?.physical?.stamina || 0);
  if (actor.type === "demon") {
    const faith = Number(actor.system?.resources?.faith?.max || actor.system?.resources?.faith?.value || 0);
    const base = damageType === "lethal" && demonBase === "faith" ? faith : stamina;
    const formArmor = ignoreArmor ? 0 : demonFormArmor(actor, damageType);
    const worn = !ignoreArmor && damageType !== "aggravated" && actor.system?.automation?.armor?.active ? Number(actor.system.automation.armor.rating || 0) : 0;
    return { pool: damageType === "aggravated" ? formArmor : base + formArmor + worn, stamina: demonBase === "stamina" && damageType !== "aggravated" ? base : 0, faith: demonBase === "faith" && damageType === "lethal" ? base : 0, fortitude: 0, armor: formArmor + worn };
  }
  const fortitude = disciplineRating(actor, ["Стойкость", "Fortitude"]);
  const armorData = actor.system?.automation?.armor ?? {};
  const armor = !ignoreArmor && armorData.active && damageType !== "aggravated" ? Number(armorData.rating || 0) : 0;
  if (damageType === "aggravated") return { pool: fortitude, stamina: 0, fortitude, armor: 0 };
  return { pool: stamina + fortitude + armor, stamina, fortitude, armor };
}

function currentHealth(actor) {
  const bonusCount = actor.type === "demon" ? Number(getActiveDemonFormSummary(actor).healthLevels || 0) : 0;
  const bonus = Array.from({ length: bonusCount }, (_, index) => ({ key: `formBonusDamage.${index}`, value: Number(actor.system?.health?.formBonusDamage?.[index] || 0), bonus: true }));
  return [...bonus, ...HEALTH_LEVELS.map(key => ({ key, value: Number(actor.system?.health?.[key] || 0) }))];
}

async function applyDamage(actor, levels, damageType) {
  const state = currentHealth(actor);
  const value = damageType === "aggravated" ? 3 : damageType === "lethal" ? 2 : 1;
  let remaining = Math.max(0, Math.trunc(Number(levels || 0)));
  const update = {};
  for (const box of state) {
    if (remaining <= 0) break;
    if (box.value > 0) continue;
    update[`system.health.${box.key}`] = box.key === "incapacitated" ? 1 : value;
    remaining -= 1;
  }
  if (Object.keys(update).length) await actor.update(update);
  return { applied: Math.max(0, Math.trunc(Number(levels || 0))) - remaining, overflow: remaining };
}

async function confirmDamage({ target, incoming, soakSuccesses, damageType }) {
  const afterSoak = Math.max(0, incoming - soakSuccesses);
  const defaultApplied = damageAfterSoak(incoming, soakSuccesses, { halveBashing: damageType === "bashing" && target.type === "vampire" });
  const content = `<form class="vtm-apply-damage-dialog">
    <p><strong>${foundry.utils.escapeHTML(target.name)}</strong></p>
    <p>Получено: ${incoming} · Поглощено: ${soakSuccesses} · После поглощения: ${afterSoak}</p>
    ${damageType === "bashing" && target.type === "vampire" ? "<p class='muted'>Поверхностный урон вампира уменьшен вдвое.</p>" : ""}
    <label>Применить уровней <input type="number" name="levels" min="0" max="20" value="${defaultApplied}"/></label>
  </form>`;
  return new Promise(resolve => new DialogV1({
    title: "Применить урон",
    content,
    buttons: {
      apply: { icon: '<i class="fas fa-heart-crack"></i>', label: "Применить", callback: html => {
        const root = rootElement(html);
        resolve(Number(root?.querySelector("[name='levels']")?.value || 0));
      } },
      cancel: { label: game.i18n.localize("Cancel"), callback: () => resolve(null) }
    }, default: "apply", close: () => resolve(null)
  }, { width: 440 }).render(true));
}

async function resolveWeaponDamage(message) {
  const data = message.flags?.["vtm-revised"] ?? {};
  const storedTarget = data.targetActorUuid ? await fromUuid(data.targetActorUuid) : null;
  const target = storedTarget?.documentName === "Actor" ? storedTarget : selectedTargetActor();
  if (!target) return;
  if (!target.isOwner && !game.user.isGM) {
    ui.notifications?.warn?.("У тебя нет прав изменять здоровье выбранной цели.");
    return;
  }
  const incoming = Math.max(0, Number(data.damageSuccesses || 0));
  const damageType = String(data.damageType || "bashing");
  const formSummary = target.type === "demon" ? getActiveDemonFormSummary(target) : null;
  if (formSummary?.immunities?.includes(damageType)) {
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: target }), content: `<div class="vtm-chat-card demon-chat-card"><h3>Иммунитет апокалиптической формы</h3><p><strong>${foundry.utils.escapeHTML(target.name)}</strong> не получает ${foundry.utils.escapeHTML(data.damageTypeLabel || damageType)} урон.</p></div>` });
    return;
  }
  let demonBase = "stamina";
  if (target.type === "demon" && damageType === "lethal") {
    demonBase = await new Promise(resolve => new DialogV1({
      title: "Поглощение Падшего", content: "<p>Выбери основу запаса поглощения летального урона.</p>",
      buttons: { stamina: { label: "Выносливость", callback: () => resolve("stamina") }, faith: { label: "Вера", callback: () => resolve("faith") }, cancel: { label: game.i18n.localize("Cancel"), callback: () => resolve(null) } },
      default: "stamina", close: () => resolve(null)
    }, { width: 420 }).render(true));
    if (!demonBase) return;
  }
  const armorChoice = await new Promise(resolve => new DialogV1({
    title: "Защита цели", content: `<form><label><input type="checkbox" name="ignoreArmor"/> Игнорировать броню (прицельная или особая атака)</label></form>`,
    buttons: { next: { label: "Продолжить", callback: html => resolve(Boolean(rootElement(html)?.querySelector("[name='ignoreArmor']")?.checked)) }, cancel: { label: game.i18n.localize("Cancel"), callback: () => resolve(null) } },
    default: "next", close: () => resolve(null)
  }, { width: 430 }).render(true));
  if (armorChoice === null) return;
  const ignoreArmor = Boolean(armorChoice);
  const soak = soakPool(target, damageType, { ignoreArmor, demonBase });
  let soakSuccesses = 0;
  if (soak.pool > 0) {
    const components = [];
    if (soak.stamina) components.push({ label: "Выносливость", value: soak.stamina });
    if (soak.faith) components.push({ label: "Вера", value: soak.faith });
    if (soak.fortitude) components.push({ label: "Стойкость", value: soak.fortitude });
    if (soak.armor) components.push({ label: target.system?.automation?.armor?.name || "Броня", value: soak.armor });
    const result = await rollDicePool({ actor: target, pool: soak.pool, basePool: soak.pool, difficulty: 6, label: `Поглощение: ${target.name}`, components });
    soakSuccesses = Number(result.successes || 0);
  } else if (damageType === "aggravated") {
    ui.notifications?.info?.(target.type === "demon" ? "У апокалиптической формы нет защиты от усиливающегося урона." : "У цели нет Стойкости: тяжёлый урон поглотить нельзя.");
  }
  const levels = await confirmDamage({ target, incoming, soakSuccesses, damageType });
  if (levels === null) return;
  const applied = await applyDamage(target, levels, damageType);
  const overflow = applied.overflow ? ` Не поместилось в шкалу: ${applied.overflow}.` : "";
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: target }), content: `<div class="vtm-chat-card"><h3>Получен урон</h3><p><strong>${foundry.utils.escapeHTML(target.name)}</strong>: ${applied.applied} ур. (${foundry.utils.escapeHTML(data.damageTypeLabel || damageType)}).${overflow}</p></div>` });
}

Hooks.on("renderChatMessage", (message, html) => {
  if (message.flags?.["vtm-revised"]?.type !== "weaponDamage") return;
  rootElement(html)?.querySelector(".weapon-damage-apply")?.addEventListener("click", event => {
    event.preventDefault();
    void resolveWeaponDamage(message);
  });
});
