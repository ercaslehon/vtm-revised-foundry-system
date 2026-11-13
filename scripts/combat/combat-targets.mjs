import { sharedCombatNames } from "./combat-roster.mjs";
const escape = value => foundry.utils.escapeHTML(String(value ?? ""));
export const dialogRoot = html => html?.querySelector ? html : html?.[0];
export function canManageTarget(actor) {
  return Boolean(actor && (game.user?.isGM || actor.isOwner));
}
export function canSelectTarget(actor, { requireOwner = false } = {}) {
  if (!actor || actor.documentName !== "Actor") return false;
  if (requireOwner) return canManageTarget(actor);
  return Boolean(canManageTarget(actor) || actor.testUserPermission?.(game.user, "LIMITED") || sharedCombatNames().some(row => row.uuid === actor.uuid));
}
export function combatTargetCandidates({ requireOwner = false } = {}) {
  const actors = [...(requireOwner ? [] : sharedCombatNames()), ...(game.actors?.contents ?? game.actors?.values?.() ?? game.actors ?? []), ...Array.from(game.user?.targets ?? [], token => token.actor)];
  return [...new Map(actors.filter(actor => canSelectTarget(actor, { requireOwner })).map(actor => [actor.uuid, actor])).values()]
    .sort((a, b) => String(a.name).localeCompare(String(b.name), game.i18n?.lang));
}
export async function resolveCombatTarget(uuid, options = {}) {
  if (!uuid) return null;
  let actor;
  try { actor = await fromUuid(uuid); } catch { /* An unshared actor is resolved through the names roster. */ }
  if (actor && (canManageTarget(actor) || actor.testUserPermission?.(game.user, "LIMITED")))
    return options.requireOwner && !canManageTarget(actor) ? null : actor;
  if (!options.requireOwner && !game.user.isGM) return sharedCombatNames().find(row => row.uuid === uuid) ?? null;
  return null;
}

export function combatTargetMarkup(actor) {
  if (!actor) return '<span class="vtm-target-empty">Цель не выбрана</span>';
  if (!game.user?.isGM) return `<span><strong>${escape(actor.name)}</strong></span>`;
  return `<img src="${escape(actor.img || "icons/svg/mystery-man.svg")}" alt=""/><span><strong>${escape(actor.name)}</strong>${actor.token ? '<small>Токен на сцене</small>' : ''}</span>`;
}

// Cancellation is undefined; it never replaces the selection in the attack dialog.
export function chooseCombatTarget({ selectedUuid = null, requireOwner = false, theme = "vampire" } = {}) {
  const candidates = combatTargetCandidates({ requireOwner });
  const rows = candidates.map(actor => {
    const selected = actor.uuid === selectedUuid;
    return `<button type="button" class="vtm-target-option${selected ? " is-selected" : ""}" aria-pressed="${selected}" data-target-uuid="${escape(actor.uuid)}" data-target-name="${escape(actor.name)}">${combatTargetMarkup(actor)}<i class="vtm-target-indicator fa-solid ${selected ? "fa-check" : "fa-chevron-right"}" aria-hidden="true"></i></button>`;
  }).join("");
  const DialogV1 = foundry.appv1?.api?.Dialog ?? globalThis.Dialog;
  return new Promise(resolve => {
    let choosing = false, closed = false;
    const dialog = new DialogV1({
      title: requireOwner ? "Получатель урона" : "Выбрать цель",
      content: `<form class="vtm-target-picker">
        <label class="vtm-target-search"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i><input type="search" name="targetSearch" aria-label="Поиск персонажа по имени" placeholder="Найти персонажа…" autocomplete="off"/></label>
        <div class="vtm-target-list-heading"><span>Персонажи</span><span class="vtm-target-count" aria-live="polite">${candidates.length}</span></div>
        <div class="vtm-target-list" role="group" aria-label="Персонажи">${rows}</div>
        <p class="vtm-target-no-results" ${candidates.length ? "hidden" : ""}>${candidates.length ? 'Никого не нашли.<small>Попробуйте другое имя.</small>' : 'Нет доступных персонажей.'}</p>
      </form>`,
      buttons: { cancel: { label: "Отмена", callback: () => resolve(undefined) } },
      close: () => { closed = true; resolve(undefined); },
      render: html => {
        const root = dialogRoot(html);
        const search = root?.querySelector("[name='targetSearch']");
        const options = [...(root?.querySelectorAll("[data-target-uuid]") ?? [])];
        search?.addEventListener("input", () => {
          const query = search.value.trim().toLocaleLowerCase().replaceAll("ё", "е");
          for (const option of options) option.hidden = !option.dataset.targetName.toLocaleLowerCase().replaceAll("ё", "е").includes(query);
          const empty = root.querySelector(".vtm-target-no-results");
          if (empty) empty.hidden = options.some(option => !option.hidden);
          const count = root.querySelector(".vtm-target-count");
          if (count) count.textContent = options.filter(option => !option.hidden).length;
        });
        root?.querySelector("form")?.addEventListener("submit", event => event.preventDefault());
        for (const option of options) option.addEventListener("click", async event => {
          event.preventDefault();
          if (choosing || closed) return;
          choosing = true;
          const actor = await resolveCombatTarget(option.dataset.targetUuid, { requireOwner });
          choosing = false;
          if (closed) return;
          if (!actor) { ui.notifications?.warn?.("Персонаж удалён или больше недоступен."); return; }
          resolve(actor);
          await dialog.close();
        });
        search?.focus();
      }
    }, { width: 420, classes: ["vtm-themed-dialog-window", "vtm-combat-dialog-window", `${theme}-roll-dialog-window`, "vtm-target-picker-window"] });
    dialog.render(true);
  });
}
