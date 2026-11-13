import { requestAutomaticAttack } from "./combat-authority.mjs";
import { canManageTarget, canSelectTarget, chooseCombatTarget, combatTargetMarkup, dialogRoot, resolveCombatTarget } from "./combat-targets.mjs";

export async function openWeaponAttackDialog(sheet, item) {
  if (!canManageTarget(sheet.actor)) return null;
  const weapon = item.system?.weapon ?? {};
  const firstTrait = weapon.attackFirstTrait || "attribute.physical.dexterity";
  const secondTrait = weapon.attackSecondTrait || (weapon.category === "firearm" ? "ability.skills.firearms" : "ability.skills.melee");
  const difficulty = Number(weapon.difficulty || 6), damageDifficulty = Number(weapon.damageDifficulty || 6);
  const theme = sheet.actor.type === "demon" ? "demon" : "vampire";
  const escape = value => foundry.utils.escapeHTML(String(value ?? ""));
  let target = null;
  if (sheet._weaponTargetUuid !== undefined) {
    target = await resolveCombatTarget(sheet._weaponTargetUuid);
    sheet._weaponTargetUuid = target?.uuid ?? null;
  } else {
    const tokens = Array.from(game.user?.targets ?? []);
    target = tokens.length === 1 && canSelectTarget(tokens[0].actor) ? tokens[0].actor : null;
  }
  const content = `<form class="vtm-weapon-attack-dialog ${theme === "demon" ? "demon-roll-dialog" : "vtm-roll-dialog"}">
    <div class="vtm-weapon-heading"><i class="fas fa-khanda" aria-hidden="true"></i><strong>${escape(item.name)}</strong></div>
    <section class="vtm-attack-target"><label>Цель</label><div class="vtm-target-current">${combatTargetMarkup(target)}</div>
      <div class="vtm-target-actions"><button type="button" class="vtm-target-choose"><i class="fas fa-crosshairs"></i> Выбрать цель</button><button type="button" class="vtm-target-clear" ${target ? "" : "disabled"}>Сбросить</button></div>
    </section>
    <div class="form-group"><label>Первый параметр</label>${sheet._buildRollSelectHtml("firstTrait", firstTrait, false)}</div>
    <div class="form-group"><label>Второй параметр</label>${sheet._buildRollSelectHtml("secondTrait", secondTrait, true)}</div>
    <div class="vtm-weapon-difficulties"><label>Сложность атаки<input type="number" name="difficulty" min="2" max="10" value="${difficulty}"/></label><label>Сложность урона<input type="number" name="damageDifficulty" min="2" max="10" value="${damageDifficulty}"/></label></div>
    <div class="form-group vtm-weapon-defense"><label class="vtm-defense-check"><input type="checkbox" name="useDefense" ${target ? "checked" : "disabled"}/> Автоматическая защита цели</label>
      <select name="defenseType" ${target ? "" : "disabled"}><option value="dodge">Уклонение: Ловкость + Уклонение</option><option value="parry">Парирование: Ловкость + Холодное оружие</option><option value="block">Блок: Ловкость + Драка</option></select>
      <small>Уворот, поглощение и запись урона выполняются автоматически через подключённого Рассказчика.</small>
    </div>
    <details class="vtm-weapon-special-options"><summary>Особенности попадания</summary>
      <label class="vtm-defense-check"><input type="checkbox" name="ignoreArmor"/> Игнорировать броню цели</label>
      ${weapon.category === "firearm" ? '<label class="vtm-defense-check"><input type="checkbox" name="headshot"/> Попадание в голову</label>' : ''}
      ${weapon.damageType === "aggravated" ? '<label>Источник урона<select name="damageSource"><option value="physical">Клыки / когти / физическая атака</option><option value="fire">Огонь</option><option value="sunlight">Солнечный свет</option><option value="unknown">Иной источник (без обычной брони)</option></select></label>' : ''}
      ${theme === "demon" && sheet.actor.getFlag?.("vtm-revised", "demonSelections")?.merits?.includes("good-right-hook") ? '<label class="vtm-defense-check"><input type="checkbox" name="goodRightHook"/> Хороший хук справа (+2 к урону атаки Дракой вне формы)</label>' : ''}
    </details>
    <p class="vtm-weapon-damage-preview">Урон: ${escape(sheet._weaponDamageLabel?.(item) ?? `${weapon.usesStrength ? "Сила + " + Number(weapon.damageBonus || 0) : Number(weapon.damageDice || 0)} · ${sheet._damageTypeLabel(weapon.damageType)}`)}</p>
  </form>`;
  const DialogV1 = foundry.appv1?.api?.Dialog ?? globalThis.Dialog;
  return new Promise(resolve => {
    let submitted = false, closed = false;
    new DialogV1({
      title: `Атака: ${item.name}`, content,
      buttons: {
        attack: { icon: '<i class="fas fa-dice-d10"></i>', label: "Атака и урон", callback: async html => {
          if (submitted) return;
          submitted = true;
          try {
            if (!canManageTarget(sheet.actor)) return resolve(null);
            const currentTarget = target ? await resolveCombatTarget(target.uuid) : null;
            if (target && !currentTarget) { ui.notifications?.warn?.("Цель удалена или больше недоступна. Выбери цель заново."); return resolve(null); }
            const form = sheet._getFormElement(html);
            sheet._weaponTargetUuid = currentTarget?.uuid ?? null;
            const selectedSecond = form?.querySelector("[name='secondTrait']");
            const rollOptions = {
              firstTrait: form?.querySelector("[name='firstTrait']")?.value || firstTrait,
              secondTrait: selectedSecond ? selectedSecond.value : secondTrait,
              difficulty: Number(form?.querySelector("[name='difficulty']")?.value || difficulty),
              damageDifficulty: Number(form?.querySelector("[name='damageDifficulty']")?.value || damageDifficulty),
              targetActor: currentTarget,
              defenseType: currentTarget && form?.querySelector("[name='useDefense']")?.checked ? form?.querySelector("[name='defenseType']")?.value || "dodge" : "",
              ignoreArmor: Boolean(form?.querySelector("[name='ignoreArmor']")?.checked),
              headshot: Boolean(form?.querySelector("[name='headshot']")?.checked),
              damageSource: form?.querySelector("[name='damageSource']")?.value || "unknown",
              goodRightHook: Boolean(form?.querySelector("[name='goodRightHook']")?.checked)
            };
            resolve(currentTarget ? await requestAutomaticAttack(sheet, item, rollOptions) : await sheet._rollWeaponAttackAndDamage(item, rollOptions));
          } catch (error) {
            console.error("VtM Revised | Weapon attack failed", error);
            ui.notifications?.error?.("Не удалось выполнить атаку."); resolve(null);
          }
        } },
        cancel: { label: "Отмена", callback: () => resolve(null) }
      }, default: "attack", close: () => { closed = true; if (!submitted) resolve(null); },
      render: html => {
        const root = dialogRoot(html);
        const useDefense = root?.querySelector("[name='useDefense']");
        const defenseType = root?.querySelector("[name='defenseType']");
        const refresh = () => {
          const current = root?.querySelector(".vtm-target-current");
          if (current) current.innerHTML = combatTargetMarkup(target);
          const clear = root?.querySelector(".vtm-target-clear");
          if (clear) clear.disabled = !target;
          if (useDefense) { useDefense.disabled = !target; if (useDefense.disabled) useDefense.checked = false; }
          if (defenseType) defenseType.disabled = !target || !useDefense?.checked;
        };
        useDefense?.addEventListener("change", refresh);
        root?.querySelector(".vtm-target-choose")?.addEventListener("click", async event => {
          event.preventDefault();
          const button = event.currentTarget;
          if (button.disabled || closed) return;
          button.disabled = true;
          try {
            const selected = await chooseCombatTarget({ selectedUuid: target?.uuid, theme });
            if (selected === undefined || closed) return;
            target = selected; sheet._weaponTargetUuid = target.uuid;
            if (useDefense) useDefense.checked = Boolean(target);
            refresh();
          } finally { button.disabled = false; }
        });
        root?.querySelector(".vtm-target-clear")?.addEventListener("click", event => {
          event.preventDefault(); target = null; sheet._weaponTargetUuid = null; refresh();
        });
        refresh();
      }
    }, { width: 560, classes: ["vtm-themed-dialog-window", "vtm-roll-dialog-window", `${theme}-roll-dialog-window`, "vtm-combat-dialog-window", "vtm-weapon-dialog-window"] }).render(true);
  });
}
