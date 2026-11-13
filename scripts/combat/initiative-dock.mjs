import { combatTargetCandidates, dialogRoot } from "./combat-targets.mjs";
import { isTokenlessCombat, rollActorInitiative, submitInitiativeCommand } from "./tokenless-combat.mjs";
const escape = value => foundry.utils.escapeHTML(String(value ?? ""));
const run = async task => { try { return await task(); } catch (error) { console.error("VtM | Initiative panel", error); ui.notifications?.error?.(error.message); return null; } };
let collapsed = false, renderTimer;
const externalCarousel = () => game.modules?.get("combat-tracker-dock")?.active;

export function openParticipantPicker(combat = game.combat) {
  if (!game.user.isGM) return;
  const actors = combatTargetCandidates().filter(actor => ["vampire", "npc", "demon"].includes(actor.type));
  const participants = new Set(Array.from(combat?.combatants ?? [], c => c.actorId));
  const rows = actors.map(actor => `<label class="vtm-initiative-participant" data-name="${escape(actor.name)}"><input type="checkbox" name="actorId" value="${escape(actor.id)}" ${participants.has(actor.id) ? 'checked disabled' : ''}/><span>${escape(actor.name)}</span>${participants.has(actor.id) ? '<small>В бою</small>' : ''}</label>`).join("");
  const DialogV1 = foundry.appv1?.api?.Dialog ?? globalThis.Dialog;
  return new DialogV1({
    title: "Участники боя",
    content: `<form class="vtm-target-picker"><label class="vtm-target-search"><i class="fas fa-search" aria-hidden="true"></i><input type="search" name="participantSearch" aria-label="Поиск персонажей" placeholder="Найти персонажа…" autocomplete="off"/></label><div class="vtm-target-list">${rows}</div><p class="vtm-participants-empty" ${actors.length ? 'hidden' : ''}>Персонажи не найдены.</p></form>`,
    buttons: {
      add: { label: "Добавить выбранных", callback: html => run(async () => {
        const ids = Array.from(dialogRoot(html).querySelectorAll('[name="actorId"]:checked:not(:disabled)'), input => input.value);
        if (!ids.length) return;
        await submitInitiativeCommand({ action: "add", actorIds: ids, combatId: combat?.id ?? null });
        collapsed = false; renderInitiativeDock();
      }) },
      cancel: { label: "Отмена" }
    },
    render: html => {
      const root = dialogRoot(html), search = root.querySelector('[name="participantSearch"]');
      search.addEventListener("input", () => {
        const query = search.value.trim().toLocaleLowerCase().replaceAll("ё", "е");
        const options = Array.from(root.querySelectorAll("[data-name]"));
        for (const row of options) row.hidden = !row.dataset.name.toLocaleLowerCase().replaceAll("ё", "е").includes(query);
        root.querySelector(".vtm-participants-empty").hidden = options.some(row => !row.hidden);
      });
      root.querySelector("form").addEventListener("submit", event => event.preventDefault());
      search.focus();
    }
  }, { width: 440, classes: ["vtm-themed-dialog-window", "vtm-combat-dialog-window", "vtm-target-picker-window", "vtm-initiative-participants-window"] }).render(true);
}
export async function openInitiativePanel() {
  const combat = game.combat;
  if (!combat) {
    if (game.user.isGM) return openParticipantPicker(null);
    ui.notifications?.info?.("Бросьте инициативу своего персонажа — Рассказчик добавит его в очередь.");
    return;
  }
  if (game.user.isGM && !isTokenlessCombat(combat)) await combat.setFlag("vtm-revised", "actorInitiative", true);
  collapsed = false;
  if (externalCarousel()) {
    if (CONFIG.combatTrackerDock && !ui.combatDock) new CONFIG.combatTrackerDock.CombatDock(combat).render(true);
    return ui.combat?.render(true);
  }
  renderInitiativeDock();
}
export function bindInitiativeControls(element, actor) {
  if (!element?.querySelector) return;
  element.querySelector(".vtm-initiative-roll")?.addEventListener("click", event => { event.preventDefault(); void run(() => rollActorInitiative(actor)); });
  element.querySelector(".vtm-initiative-open")?.addEventListener("click", event => { event.preventDefault(); void run(openInitiativePanel); });
}
const button = (action, icon, label, extra = "") => `<button type="button" data-action="${action}" title="${escape(label)}" aria-label="${escape(label)}" ${extra}><i class="fas ${icon}" aria-hidden="true"></i><span>${escape(label)}</span></button>`;

export function initiativeDockMarkup(combat) {
  const active = combat.started ? combat.combatant : null;
  const visible = Array.from(combat.turns ?? []).filter(c => c.visible !== false);
  const cards = visible.map(c => {
    const isActive = c.id === active?.id;
    const canOpen = c.actor && (game.user.isGM || c.actor.testUserPermission?.(game.user, "LIMITED"));
    return `<article class="vtm-initiative-card ${isActive ? 'is-current' : ''} ${c.isDefeated ? 'is-defeated' : ''}" data-combatant-id="${escape(c.id)}" ${isActive ? 'aria-current="step"' : ''}>
      <div class="vtm-initiative-portrait"><img src="${escape(c.img || 'icons/svg/mystery-man.svg')}" alt=""/><span class="vtm-initiative-score">${c.initiative == null ? '—' : escape(c.initiative)}</span></div>
      <div class="vtm-initiative-identity"><span class="vtm-initiative-card-status">${isActive ? 'Сейчас ходит' : c.isDefeated ? 'Выбыл' : c.initiative == null ? 'Ожидает броска' : 'Инициатива'}</span><strong>${escape(c.name)}</strong></div>
      <div class="vtm-initiative-card-actions">${c.isOwner ? button('roll', 'fa-dice-d10', 'Бросить инициативу') : ''}${canOpen ? button('sheet', 'fa-address-card', 'Открыть лист') : ''}${game.user.isGM ? button('remove', 'fa-minus', 'Убрать из боя') : ''}</div>
    </article>`;
  }).join("");
  const canPass = combat.started && (game.user.isGM || active?.isOwner);
  return `<header class="vtm-initiative-header"><div class="vtm-initiative-round"><i class="fas fa-swords" aria-hidden="true"></i><strong>${combat.started ? `Раунд ${combat.round}` : 'Подготовка боя'}</strong></div><nav aria-label="Управление боем">
    ${game.user.isGM ? button('participants', 'fa-user-plus', 'Участники') + button('rollAll', 'fa-dice-d10', 'Бросить всем') + (combat.started ? button('previous', 'fa-chevron-left', 'Назад') : button('start', 'fa-play', 'Начать бой', !visible.length ? 'disabled' : '')) : ''}
    ${canPass ? button('next', 'fa-chevron-right', game.user.isGM ? 'Следующий ход' : 'Завершить ход') : ''}
    ${game.user.isGM ? button('end', 'fa-flag-checkered', 'Завершить бой') : ''}
    ${button('collapse', collapsed ? 'fa-chevron-up' : 'fa-chevron-down', collapsed ? 'Развернуть' : 'Свернуть', `aria-expanded="${!collapsed}"`)}
  </nav></header><div class="vtm-initiative-cards" ${collapsed ? 'hidden' : ''}>${cards || '<p class="vtm-initiative-empty">Добавьте персонажей, чтобы определить порядок ходов.</p>'}</div>`;
}
export function renderInitiativeDock() {
  if (!globalThis.document || !game.ready) return;
  const combat = game.combat;
  let dock = document.getElementById("vtm-initiative-dock");
  if (!isTokenlessCombat(combat) || externalCarousel()) { dock?.remove(); return; }
  const scroll = dock?.querySelector(".vtm-initiative-cards")?.scrollLeft ?? 0;
  const focus = dock?.contains(document.activeElement) ? { action: document.activeElement.dataset.action, id: document.activeElement.closest('[data-combatant-id]')?.dataset.combatantId } : null;
  if (!dock) {
    dock = document.createElement("section"); dock.id = "vtm-initiative-dock";
    dock.setAttribute("aria-label", "Порядок ходов"); document.body.append(dock);
    dock.addEventListener("click", onDockClick);
  }
  const oldTurn = dock.dataset.turn;
  dock.dataset.combatId = combat.id;
  dock.dataset.turn = combat.started ? String(combat.combatant?.id ?? '') : '';
  dock.innerHTML = initiativeDockMarkup(combat);
  dock.querySelector(".vtm-initiative-cards").scrollLeft = scroll;
  if (focus?.action) {
    const area = focus.id ? Array.from(dock.querySelectorAll('[data-combatant-id]')).find(el => el.dataset.combatantId === focus.id) : dock.querySelector("header");
    Array.from(area?.querySelectorAll('[data-action]') ?? []).find(el => el.dataset.action === focus.action)?.focus({ preventScroll: true });
  }
  if (!collapsed && oldTurn !== dock.dataset.turn) dock.querySelector(".is-current")?.scrollIntoView({ block: "nearest", inline: "center", behavior: "auto" });
}
async function onDockClick(event) {
  const control = event.target.closest("button[data-action]");
  if (!control || control.disabled) return;
  event.preventDefault();
  const combat = game.combats.get(event.currentTarget.dataset.combatId);
  if (!combat) return;
  const action = control.dataset.action;
  const combatant = combat.combatants.get(control.closest('[data-combatant-id]')?.dataset.combatantId);
  if (action === "collapse") { collapsed = !collapsed; renderInitiativeDock(); return; }
  if (action === "participants") return openParticipantPicker(combat);
  if (action === "sheet") {
    if (combatant?.actor && (game.user.isGM || combatant.actor.testUserPermission(game.user, "LIMITED"))) combatant.actor.sheet.render(true);
    return;
  }
  control.disabled = true;
  await run(async () => {
    if (action === "end") {
      const DialogV1 = foundry.appv1?.api?.Dialog ?? globalThis.Dialog;
      const confirmed = await DialogV1.confirm({ title: "Завершить бой?", content: "<p>Очередь ходов будет закрыта. Персонажи и сообщения с бросками сохранятся.</p>", defaultYes: false });
      if (!confirmed) return;
    }
    await submitInitiativeCommand({ action, combatId: combat.id, actorId: combatant?.actorId,
      combatantId: action === "next" ? combat.combatant?.id : combatant?.id, round: combat.round, turn: combat.turn });
  });
  control.disabled = false;
}
function scheduleRender() { clearTimeout(renderTimer); renderTimer = setTimeout(renderInitiativeDock, 40); }
for (const hook of ["ready", "createCombat", "updateCombat", "deleteCombat", "createCombatant", "updateCombatant", "deleteCombatant", "updateActor", "updateUser", "canvasReady", "renderCombatTracker"]) Hooks.on(hook, scheduleRender);
function addParticipantsButton(app, html) {
  if (!game.user.isGM) return;
  const root = dialogRoot(html);
  if (!root?.querySelector || root.querySelector(".vtm-add-combat-participants")) return;
  const control = document.createElement("button"); control.type = "button"; control.className = "vtm-add-combat-participants";
  control.innerHTML = '<i class="fas fa-user-plus" aria-hidden="true"></i> Добавить персонажей';
  control.addEventListener("click", () => openParticipantPicker(app.combat ?? app.viewed ?? game.combat));
  (root.querySelector(".buttons-container.left, .directory-header") ?? root).prepend(control);
}
Hooks.on("renderCombatTracker", addParticipantsButton);
Hooks.on("renderCombatDock", addParticipantsButton);
