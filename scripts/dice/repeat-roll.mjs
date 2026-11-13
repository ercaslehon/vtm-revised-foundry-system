import { rollDicePool } from "./dice-pool.mjs";

const SYSTEM = "vtm-revised";
const escape = value => foundry.utils.escapeHTML(String(value ?? ""));

// Resolve the original synthetic actor, even when a different scene is active.
// Never substitute a world actor for a deleted token or a stale UUID.
export async function resolveRollActor(message) {
  const uuid = message.flags?.[SYSTEM]?.actorUuid;
  if (uuid) return (await fromUuid(uuid)) ?? null;
  const speaker = message.speaker ?? {};
  if (speaker.token) {
    return game.scenes?.get(speaker.scene)?.tokens?.get(speaker.token)?.actor ?? null;
  }
  return game.actors?.get(speaker.actor) ?? null;
}

function canRepeat(message, actor) {
  return Boolean(actor && (game.user.isGM || actor.isOwner) && message.visible !== false
    && (game.user.isGM || message.isContentVisible !== false));
}

export function getRepeatParameters(message) {
  const data = message.flags?.[SYSTEM];
  if (data?.type !== "dicePool" || !Number.isInteger(data.pool) || data.pool < 1
    || !Number.isInteger(data.difficulty) || data.difficulty < 2 || data.difficulty > 10) return null;
  return {
    pool: data.pool,
    basePool: data.basePool ?? data.pool,
    healthPenalty: data.healthPenalty ?? 0,
    healthPenaltyLabel: data.healthPenaltyLabel ?? "",
    automaticSuccesses: data.automaticSuccesses ?? 0,
    difficulty: data.difficulty,
    label: String(data.label ?? message.flavor ?? "Бросок"),
    flavor: String(data.flavor ?? ""),
    components: (Array.isArray(data.components) ? data.components : []).map(component => ({
      label: String(component.label ?? ""), value: component.value
    })),
    messageVisibility: {
      whisper: Array.from(message.whisper ?? [], user => typeof user === "string" ? user : user.id),
      blind: Boolean(message.blind)
    }
  };
}

export async function openRepeatRollDialog(message) {
  const parameters = getRepeatParameters(message);
  if (!parameters) return false;
  const actor = await resolveRollActor(message);
  if (!canRepeat(message, actor)) {
    ui.notifications?.warn?.(actor ? "Нет прав на бросок этого персонажа." : "Персонаж или токен исходного броска удалён.");
    return false;
  }
  const DialogV1 = foundry.appv1?.api?.Dialog ?? globalThis.Dialog;
  const components = parameters.components.map(component => `<li>${escape(component.label)}: ${escape(component.value)}</li>`).join("");
  const content = `<form class="vtm-roll-dialog vtm-repeat-roll-dialog">
    <p><strong>${escape(actor.name)}</strong></p>
    ${components ? `<ul>${components}</ul>` : ""}
    <p>Базовый пул: ${escape(parameters.basePool)}. Штраф здоровья: ${escape(parameters.healthPenalty)} ${escape(parameters.healthPenaltyLabel)}.</p>
    <div class="form-group"><label>Название броска</label><input name="label" type="text" value="${escape(parameters.label)}"></div>
    <div class="form-group"><label>Кубики</label><input name="pool" type="number" min="1" step="1" value="${parameters.pool}"></div>
    <div class="form-group"><label>Сложность</label><input name="difficulty" type="number" min="2" max="10" step="1" value="${parameters.difficulty}"></div>
    ${Object.hasOwn(message.flags[SYSTEM], "automaticSuccesses") ? `<div class="form-group"><label>Автоматические успехи</label><input name="automaticSuccesses" type="number" min="0" step="1" value="${parameters.automaticSuccesses}"></div>` : ""}
  </form>`;
  return new Promise(resolve => {
    let submitted = false;
    new DialogV1({
      title: `Повторить бросок: ${actor.name}`,
      content,
      buttons: {
        roll: {
          icon: '<i class="fas fa-dice-d10"></i>', label: "Бросить",
          callback: async html => {
            if (submitted) return;
            submitted = true;
            try {
              const currentActor = await resolveRollActor(message);
              if (!canRepeat(message, currentActor)) {
                ui.notifications?.warn?.("Персонаж недоступен или права на бросок изменились.");
                return resolve(false);
              }
              const root = html?.[0] ?? html;
              const value = name => root.querySelector(`[name='${name}']`)?.value;
              const pool = Number(value("pool"));
              const difficulty = Number(value("difficulty"));
              const automaticSuccesses = Number(value("automaticSuccesses") ?? 0);
              if (!Number.isInteger(pool) || pool < 1 || !Number.isInteger(difficulty) || difficulty < 2 || difficulty > 10
                || !Number.isInteger(automaticSuccesses) || automaticSuccesses < 0) {
                ui.notifications?.warn?.("Укажи целое число кубиков от 1, сложность от 2 до 10 и неотрицательное число автоматических успехов.");
                return resolve(false);
              }
              const delta = pool - parameters.pool;
              resolve(await rollDicePool({
                ...parameters, actor: currentActor, pool, difficulty, automaticSuccesses,
                label: String(value("label") ?? parameters.label),
                components: [...parameters.components, ...(delta ? [{ label: "Поправка при повторе", value: delta }] : [])]
              }));
            } catch (error) {
              console.error("VtM Revised | Repeat roll failed", error);
              ui.notifications?.error?.("Не удалось повторить бросок.");
              resolve(false);
            }
          }
        },
        cancel: { label: "Отмена", callback: () => resolve(false) }
      },
      default: "roll",
      close: () => { if (!submitted) resolve(false); }
    }, {
      width: 480,
      classes: ["vtm-themed-dialog-window", "vtm-roll-dialog-window", actor.type === "demon" ? "demon-roll-dialog-window" : "vampire-roll-dialog-window"]
    }).render(true);
  });
}

export async function renderRepeatRollButton(message, html) {
  const root = html?.[0] ?? html;
  const card = root?.querySelector?.(".vtm-chat-card.roll-card");
  if (!card || !getRepeatParameters(message)) return;
  const actor = await resolveRollActor(message);
  if (!canRepeat(message, actor) || card.querySelector(".vtm-repeat-roll")) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "vtm-repeat-roll";
  button.innerHTML = '<i class="fas fa-redo" aria-hidden="true"></i> Повторить бросок';
  button.addEventListener("click", async event => {
    event.preventDefault();
    if (button.disabled) return;
    button.disabled = true;
    try { await openRepeatRollDialog(message); }
    finally { button.disabled = false; }
  });
  card.append(button);
}

// V13 uses HTMLElement with renderChatMessageHTML; support the legacy hook too.
for (const hook of ["renderChatMessage", "renderChatMessageHTML"]) {
  Hooks.on(hook, (message, html) => {
    void renderRepeatRollButton(message, html).catch(error => console.error("VtM Revised | Repeat button failed", error));
  });
}
