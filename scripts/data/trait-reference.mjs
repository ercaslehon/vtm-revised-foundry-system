import { TRAIT_SOURCE_TEXT } from "./trait-source-text.generated.mjs";

export function getTraitReference(kind = "ability", key = "", label = "", { demon = false } = {}) {
  const profile = demon ? "demon" : "vampire";
  const source = TRAIT_SOURCE_TEXT[profile]?.[kind]?.[key]
    ?? TRAIT_SOURCE_TEXT.demon?.[kind]?.[key];
  if (!source) return {
    kind, key, label: label || key, summary: "Текст этой характеристики в локальном справочнике не найден.",
    examples: "", distinction: "", sourceUrl: "", sourceGame: ""
  };
  return { ...source, kind, key, label: label || source.label, distinction: source.sourceGame };
}

export function openTraitReference({ kind = "ability", key = "", label = "", demon = false } = {}) {
  const entry = getTraitReference(kind, key, label, { demon });
  const escape = value => foundry.utils.escapeHTML(String(value ?? ""));
  const DialogV1 = foundry.appv1?.api?.Dialog ?? globalThis.Dialog;
  const details = entry.examples
    ? `<section><h3>Рейтинги и специализации</h3><p style="white-space:pre-line">${escape(entry.examples)}</p></section>`
    : "";
  return new DialogV1({
    title: entry.label,
    content: `<article class="trait-reference-card${demon ? " demon-reference-card" : ""}" style="max-height:65vh;overflow:auto"><header><i class="fas fa-book-open"></i><h2>${escape(entry.label)}</h2><span>${entry.kind === "attribute" ? "Атрибут" : "Способность"}</span></header><section><h3>Описание</h3><p style="white-space:pre-line">${escape(entry.summary)}</p></section>${details}<aside>${escape(entry.distinction)}</aside></article>`,
    buttons: { close: { label: "Закрыть" } }, default: "close"
  }, { width: 560, resizable: true, classes: ["trait-reference-dialog-window", ...(demon ? ["demon-reference-dialog-window"] : [])] }).render(true);
}

export function activateTraitReferenceButtons(root, { inject = false } = {}) {
  if (!root?.querySelectorAll) return;
  if (inject) root.querySelectorAll(".wizard-dot-row").forEach(row => {
    if (row.querySelector(".trait-reference-open")) return;
    const input = row.querySelector("input[name^='system.attributes.'], input[name^='system.abilities.']");
    if (!input) return;
    const parts = String(input.name).split(".");
    const kind = parts[1] === "attributes" ? "attribute" : "ability";
    const key = parts[3];
    const button = document.createElement("button");
    button.type = "button";
    button.className = "trait-reference-open";
    button.dataset.traitKind = kind;
    button.dataset.traitKey = key;
    button.dataset.traitLabel = String(row.childNodes[0]?.textContent || key).trim();
    button.title = "Когда применять";
    button.innerHTML = '<i class="fas fa-book-open"></i>';
    row.append(button);
  });
  root.querySelectorAll(".trait-reference-open").forEach(button => {
    if (button.dataset.traitReferenceBound === "true") return;
    button.dataset.traitReferenceBound = "true";
    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      const demon = Boolean(button.closest(".demon-vampire-layout, .demon-character-wizard-form"));
      openTraitReference({ kind: button.dataset.traitKind, key: button.dataset.traitKey, label: button.dataset.traitLabel, demon });
    });
  });
}
