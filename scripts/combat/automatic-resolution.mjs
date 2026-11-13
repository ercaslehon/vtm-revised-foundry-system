import { rollDicePool } from "../dice/dice-pool.mjs";
import { soakPool, applyDamage } from "./combat-chat-actions.mjs";
import { damageAfterSoak } from "./combat-math.mjs";
import { healthCondition, healthPenalty, CONDITION_LABELS } from "./vampire-health.mjs";
import { getActiveDemonFormSummary } from "../data/demon/demon-apocalyptic-mechanics.mjs";
import { isCombatGM } from "./combat-roster.mjs";
const escape = value => foundry.utils.escapeHTML(String(value ?? ""));
export async function finishAutomaticAttack({ actor, item, options, attackResult, defenseResult = null, damageResult = null }) {
  if (!isCombatGM()) throw new Error("Расчёт атаки передан другому Рассказчику.");
  const target = await fromUuid(options.targetActor.uuid);
  if (target?.documentName !== "Actor") throw new Error("Цель удалена до применения урона.");
  const weapon = item.system?.weapon ?? {};
  let damageType = weapon.damageType || "bashing";
  if (target.type === "vampire" && weapon.category === "firearm" && damageType === "lethal" && !options.headshot) damageType = "bashing";
  const incoming = Math.max(0, Number(damageResult?.successes || 0));
  const immune = target.type === "demon" && getActiveDemonFormSummary(target).immunities?.includes(damageType);
  let soakSuccesses = 0;
  if (incoming > 0 && !immune) {
    const soak = soakPool(target, damageType, { ignoreArmor: options.ignoreArmor, damageSource: options.damageSource });
    if (soak.pool > 0) {
      const components = [["Выносливость", soak.stamina], ["Вера", soak.faith], ["Стойкость", soak.fortitude], ["Броня", soak.armor]]
        .filter(([, value]) => value).map(([label, value]) => ({ label, value }));
      const result = await rollDicePool({ rollKind: "soak", actor: target, pool: soak.pool, basePool: soak.pool,
        healthPenalty: 0, difficulty: 6, label: `Поглощение: ${target.name}`, components });
      soakSuccesses = result.successes;
    }
  }
  const finalDamage = immune ? 0 : damageAfterSoak(incoming, soakSuccesses, { halveBashing: target.type === "vampire" && damageType === "bashing" });
  if (!isCombatGM()) throw new Error("Рассказчик сменился до записи урона; проверь итог атаки.");
  const applied = await applyDamage(target, finalDamage, damageType, { requestId: options.requestId });
  const label = { bashing: "ударный", lethal: "летальный", aggravated: "аггравированный" }[damageType] ?? damageType;
  const condition = target.type === "vampire" ? healthCondition(target) : null;
  const state = condition ? (condition === "active" && healthPenalty(target).incapacitated ? "Обездвижен" : CONDITION_LABELS[condition]) : "";
  const reason = attackResult.botch ? "Критический провал атаки." : !damageResult ? "Атака не прошла защиту." : immune ? "Цель невосприимчива к этому урону." : "";
  const content = `<article class="vtm-chat-card${actor.type === "demon" ? " demon-chat-card" : ""}"><h3>Итог атаки: ${escape(item.name)}</h3>
    <p><strong>${escape(actor.name)} → ${escape(target.name)}</strong></p>
    <p>Атака: ${Number(attackResult.successes || 0)} · Защита: ${Number(defenseResult?.successes || 0)}</p>
    <p>Урон до поглощения: ${incoming} · Поглощено: ${soakSuccesses}</p>
    <p class="result">Итоговый урон: <strong>${finalDamage}</strong> (${escape(label)}).</p>
    ${reason ? `<p>${reason}</p>` : ""}
    <p>${finalDamage ? `В здоровье записано: ${applied.applied} ур.${applied.overflow ? ` Урон сверх шкалы: ${applied.overflow}.` : ""}` : "Здоровье не изменилось."}${state ? ` Состояние: ${escape(state)}.` : ""}</p>
    </article>`;
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content,
    flags: { "vtm-revised": { type: "automaticAttackResult", requestId: options.requestId, actorUuid: actor.uuid,
      targetActorUuid: target.uuid, targetActorName: target.name, attackSuccesses: attackResult.successes,
      defenseSuccesses: defenseResult?.successes ?? 0, incoming, soakSuccesses, finalDamage, damageType, applied: applied.applied, overflow: applied.overflow, condition } } });
  return { attackResult, defenseResult, damageResult, finalDamage, applied };
}
