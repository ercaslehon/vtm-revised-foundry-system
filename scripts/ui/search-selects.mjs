/**
 * Searchable selects for VtM Revised dialogs.
 *
 * Isolated from actor sheet search-select code on purpose.
 * Enhances roll dialogs and VtM-specific dialogs without touching normal Foundry forms.
 */

const SEARCHABLE_DIALOG_SELECTORS = [
  ".vtm-roll-dialog select",
  ".vtm-add-blood-path-dialog select",
  ".vtm-import-dialog select",
  ".vtm-searchable-dialog select",
  "select[data-vtm-searchable='true']",
  ".wizard-subpanel select",
  ".wizard-panel select",
  ".vtm-wizard-main select",
  ".vtm-character-wizard-form select",
  ".vtm-revised.creation-wizard select"
];

const ROLL_TITLE_RE = /бросок|куб|dice|roll/i;
const CATALOG_PICKER_TITLE_RE = /достоинств|недостат|дисциплин|магии|магия|пути|путь|дорог|дорога|ритуал|оруж|merit|flaw|discipline|blood magic|blood sorcery|path|road|ritual|weapon/i;

let openPanel = null;

function getVtmWindowTitle(element) {
  const app = element?.closest?.(".app, .application, .window-app");
  return app?.querySelector?.(".window-title, .window-header h4, header h1")?.textContent ?? "";
}

function isVtmRollWindow(select) {
  return ROLL_TITLE_RE.test(getVtmWindowTitle(select));
}

function isVtmCatalogPickerWindow(select) {
  return CATALOG_PICKER_TITLE_RE.test(getVtmWindowTitle(select));
}

function sizeCatalogPickerWindow(app) {
  if (!app) return;
  if (app.dataset.vtmCatalogSized === "1") return;
  app.dataset.vtmCatalogSized = "1";

  requestAnimationFrame(() => {
    const targetWidth = 1040;
    const targetHeight = 460;

    const currentWidth = parseFloat(app.style.width) || app.offsetWidth || 0;
    const currentHeight = parseFloat(app.style.height) || app.offsetHeight || 0;

    if (currentWidth < targetWidth) {
      app.style.width = `${targetWidth}px`;
      app.style.minWidth = `${targetWidth}px`;
    }

    if (currentHeight < targetHeight) {
      app.style.height = `${targetHeight}px`;
      app.style.minHeight = `${targetHeight}px`;
    }

    app.style.maxWidth = "96vw";
    app.style.maxHeight = "82vh";

    const content = app.querySelector(".window-content, .application-content");
    if (content) {
      content.style.minHeight = "380px";
      content.style.maxHeight = "calc(82vh - 32px)";
      content.style.overflowY = "auto";
    }
  });
}

function shouldEnhanceSelect(select) {
  if (!(select instanceof HTMLSelectElement)) return false;
  if (select.multiple) return false;
  if (select.dataset.vtmDialogSearchEnhanced === "1") return false;
  if (select.classList.contains("vtm-search-select-original")) return false;
  if (select.closest(".vtm-search-select, .vtm-dialog-search-select")) return false;

  if (SEARCHABLE_DIALOG_SELECTORS.some((selector) => select.matches(selector))) return true;
  if (select.closest(".vtm-roll-dialog, .vtm-add-blood-path-dialog, .vtm-import-dialog, .vtm-searchable-dialog")) return true;
  if (isVtmRollWindow(select)) return true;
  if (isVtmCatalogPickerWindow(select)) return true;

  return false;
}


function isRitualCatalogSelect(select) {
  const title = getVtmWindowTitle(select);
  if (/ритуал|ritual/i.test(title)) return true;
  if (select.closest?.(".vtm-add-ritual-dialog")) return true;
  return false;
}

function splitRitualOptionLabel(select, label = "") {
  const text = String(label || "").trim();
  if (!isRitualCatalogSelect(select)) return { group: "", label: text };

  const match = text.match(/^(.+?)\s*[·•]\s*(Уровень\s+\d+.*)$/i);
  if (!match) return { group: "", label: text };

  return {
    group: match[1].trim(),
    label: match[2].trim()
  };
}

function getOptionRows(select) {
  const rows = [];

  for (const node of Array.from(select.children)) {
    if (node instanceof HTMLOptGroupElement) {
      rows.push({
        type: "group",
        label: node.label || ""
      });

      for (const option of Array.from(node.children)) {
        if (!(option instanceof HTMLOptionElement)) continue;
        rows.push({
          type: "option",
          value: option.value,
          label: option.textContent?.trim() || option.value,
          disabled: option.disabled,
          selected: option.selected,
          group: node.label || ""
        });
      }

      continue;
    }

    if (node instanceof HTMLOptionElement) {
      const rawLabel = node.textContent?.trim() || node.value;
      const split = splitRitualOptionLabel(select, rawLabel);

      if (split.group && rows[rows.length - 1]?.label !== split.group) {
        rows.push({
          type: "group",
          label: split.group
        });
      }

      rows.push({
        type: "option",
        value: node.value,
        label: split.label || rawLabel,
        disabled: node.disabled,
        selected: node.selected,
        group: split.group || ""
      });
    }
  }

  return rows;
}

function selectedLabel(select) {
  const option = select.selectedOptions?.[0];
  const label = option?.textContent?.trim() || select.value || "Выбрать";
  return splitRitualOptionLabel(select, label).label || label;
}

function closePanel() {
  if (!openPanel) return;

  openPanel.panel.remove();
  document.removeEventListener("mousedown", openPanel.onDocumentMouseDown, true);
  window.removeEventListener("resize", openPanel.close, true);
  window.removeEventListener("scroll", openPanel.onWindowScroll, true);

  openPanel.button?.classList.remove("is-open");
  openPanel = null;
}

function positionPanel(panel, button) {
  const rect = button.getBoundingClientRect();
  const viewportGap = 10;
  const wantedHeight = 340;
  const below = window.innerHeight - rect.bottom - viewportGap;
  const above = rect.top - viewportGap;
  const openUp = below < 180 && above > below;
  const maxHeight = Math.max(160, Math.min(wantedHeight, openUp ? above : below));

  panel.style.left = `${Math.max(viewportGap, rect.left)}px`;
  panel.style.width = `${Math.max(220, rect.width)}px`;
  panel.style.maxHeight = `${maxHeight}px`;

  if (openUp) {
    panel.style.top = "";
    panel.style.bottom = `${Math.max(viewportGap, window.innerHeight - rect.top + 4)}px`;
  } else {
    panel.style.bottom = "";
    panel.style.top = `${rect.bottom + 4}px`;
  }
}

function openSearchPanel(select, button) {
  closePanel();

  const panel = document.createElement("div");
  panel.className = "vtm-dialog-search-panel";
  panel.innerHTML = `
    <input class="vtm-dialog-search-input" type="search" placeholder="Поиск..." autocomplete="off">
    <div class="vtm-dialog-search-options"></div>
  `;

  const input = panel.querySelector(".vtm-dialog-search-input");
  const list = panel.querySelector(".vtm-dialog-search-options");

  const render = () => {
    const query = input.value.trim().toLowerCase();
    const rows = getOptionRows(select);

    list.innerHTML = "";

    let currentGroupVisible = false;
    let lastGroupElement = null;
    let count = 0;

    for (const row of rows) {
      if (row.type === "group") {
        const group = document.createElement("div");
        group.className = "vtm-dialog-search-group";
        group.textContent = row.label;
        group.hidden = Boolean(query);
        list.appendChild(group);
        lastGroupElement = group;
        currentGroupVisible = false;
        continue;
      }

      const haystack = `${row.label} ${row.group}`.toLowerCase();
      if (query && !haystack.includes(query)) continue;

      if (lastGroupElement && query && !currentGroupVisible) {
        lastGroupElement.hidden = false;
        currentGroupVisible = true;
      }

      const option = document.createElement("button");
      option.type = "button";
      option.className = "vtm-dialog-search-option";
      option.textContent = row.label;
      option.dataset.value = row.value;

      if (row.disabled) option.disabled = true;
      if (row.value === select.value) option.classList.add("is-selected");

      option.addEventListener("click", () => {
        select.value = row.value;
        select.dispatchEvent(new Event("input", { bubbles: true }));
        select.dispatchEvent(new Event("change", { bubbles: true }));
        button.textContent = selectedLabel(select);
        button.title = selectedLabel(select);
        closePanel();
      });

      list.appendChild(option);
      count += 1;
    }

    if (!count) {
      const empty = document.createElement("div");
      empty.className = "vtm-dialog-search-empty";
      empty.textContent = "Ничего не найдено";
      list.appendChild(empty);
    }
  };

  document.body.appendChild(panel);
  button.classList.add("is-open");

  const onDocumentMouseDown = (event) => {
    if (panel.contains(event.target) || button.contains(event.target)) return;
    closePanel();
  };

  const onWindowScroll = (event) => {
    if (panel.contains(event.target)) return;
    closePanel();
  };

  openPanel = {
    panel,
    button,
    close: closePanel,
    onDocumentMouseDown,
    onWindowScroll
  };

  positionPanel(panel, button);
  render();

  document.addEventListener("mousedown", onDocumentMouseDown, true);
  window.addEventListener("resize", closePanel, true);
  window.addEventListener("scroll", onWindowScroll, true);

  input.addEventListener("input", render);

  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closePanel();
      button.focus();
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const selected =
        list.querySelector(".vtm-dialog-search-option.is-selected:not(:disabled)") ||
        list.querySelector(".vtm-dialog-search-option:not(:disabled)");
      selected?.click();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      const first = list.querySelector(".vtm-dialog-search-option:not(:disabled)");
      first?.focus();
    }
  });

  list.addEventListener("keydown", (event) => {
    const options = Array.from(list.querySelectorAll(".vtm-dialog-search-option:not(:disabled)"));
    const index = options.indexOf(document.activeElement);

    if (event.key === "Escape") {
      event.preventDefault();
      closePanel();
      button.focus();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      options[Math.min(index + 1, options.length - 1)]?.focus();
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (index <= 0) input.focus();
      else options[index - 1]?.focus();
    }
  });

  requestAnimationFrame(() => {
    input.focus();
    input.select();
  });
}

function themeDialog(select) {
  const app = select.closest(".app, .application, .window-app");
  const form = select.closest("form, .window-content, .application-content");

  if (select.closest(".vtm-character-wizard-form, .vtm-revised.creation-wizard")) {
    app?.classList.add("vtm-themed-wizard-window");
    form?.classList.add("vtm-searchable-wizard-form");
    return;
  }

  if (isVtmCatalogPickerWindow(select)) {
    app?.classList.add("vtm-themed-dialog-window", "vtm-catalog-picker-dialog");
    form?.classList.add("vtm-searchable-dialog-form", "vtm-catalog-picker-form");
    sizeCatalogPickerWindow(app);
    return;
  }

  app?.classList.add("vtm-themed-dialog-window");
  form?.classList.add("vtm-searchable-dialog-form");
}

function hideNativeSelect(select) {
  select.hidden = true;
  select.setAttribute("aria-hidden", "true");
  select.tabIndex = -1;

  select.style.setProperty("display", "none", "important");
  select.style.setProperty("visibility", "hidden", "important");
  select.style.setProperty("opacity", "0", "important");
  select.style.setProperty("position", "absolute", "important");
  select.style.setProperty("width", "0", "important");
  select.style.setProperty("height", "0", "important");
  select.style.setProperty("min-width", "0", "important");
  select.style.setProperty("min-height", "0", "important");
  select.style.setProperty("max-width", "0", "important");
  select.style.setProperty("max-height", "0", "important");
  select.style.setProperty("margin", "0", "important");
  select.style.setProperty("padding", "0", "important");
  select.style.setProperty("border", "0", "important");
  select.style.setProperty("pointer-events", "none", "important");
}

function normalizeCatalogText(value = "") {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replaceAll("ё", "е");
}

function stripHtml(value = "") {
  const div = document.createElement("div");
  div.innerHTML = String(value ?? "");
  return div.textContent?.trim() || "";
}

function catalogOptionCandidateNames(option) {
  const raw = option?.textContent?.trim() || option?.value || "";
  const clean = raw.replace(/\s+/g, " ").trim();

  const candidates = new Set();
  if (clean) candidates.add(clean);

  const dotParts = clean.split(/\s*[·•]\s*/).map((x) => x.trim()).filter(Boolean);
  if (dotParts.length) candidates.add(dotParts[dotParts.length - 1]);

  const dashParts = clean.split(/\s+-\s+/).map((x) => x.trim()).filter(Boolean);
  if (dashParts.length) candidates.add(dashParts[dashParts.length - 1]);

  const colonParts = clean.split(/\s*:\s*/).map((x) => x.trim()).filter(Boolean);
  if (colonParts.length) candidates.add(colonParts[colonParts.length - 1]);

  const withoutMeta = clean
    .replace(/^(физические|социальные|ментальные|таланты|навыки|познания|достоинства|недостатки|дисциплины|магия крови|пути|дороги|ритуалы|оружие)\s*[·•:-]\s*/i, "")
    .replace(/^\d+\s*[·•:-]\s*/i, "")
    .trim();

  if (withoutMeta) candidates.add(withoutMeta);

  return [...candidates].filter(Boolean);
}

function readDeepValue(object, path) {
  if (!object || !path) return null;

  let current = object;
  for (const part of path.split(".")) {
    if (current == null) return null;
    current = current[part];
  }

  return current;
}

function normalizePreviewValue(value) {
  if (value == null) return "";

  if (typeof value === "string") return value.trim();

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (typeof value === "object") {
    for (const key of ["value", "html", "text", "description", "summary", "label"]) {
      const nested = normalizePreviewValue(value[key]);
      if (nested) return nested;
    }
  }

  return "";
}

function itemField(item, paths) {
  for (const path of paths) {
    const value = normalizePreviewValue(readDeepValue(item, path));
    if (value) return value;
  }

  return "";
}

async function enrichPreviewHtml(value) {
  const raw = normalizePreviewValue(value);
  if (!raw) return "";

  try {
    if (globalThis.TextEditor?.enrichHTML) {
      return await TextEditor.enrichHTML(raw, { async: true });
    }
  } catch (error) {
    console.warn("VtM Revised | Failed to enrich catalog preview html", error);
  }

  return foundry.utils.escapeHTML(stripHtml(raw));
}

async function resolveCatalogOptionItem(select) {
  const option = select?.selectedOptions?.[0];
  if (!option) return null;

  const value = option.value || "";

  if (value) {
    try {
      if (/^(Item|Actor|Compendium)\./.test(value) && globalThis.fromUuid) {
        const doc = await fromUuid(value);
        if (doc) return doc;
      }
    } catch (error) {
      console.warn("VtM Revised | Failed to resolve selected catalog uuid", value, error);
    }

    const byId = game?.items?.get?.(value);
    if (byId) return byId;
  }

  const allItems = game?.items?.contents ?? Array.from(game?.items ?? []);
  const candidates = catalogOptionCandidateNames(option).map(normalizeCatalogText);

  for (const candidate of candidates) {
    const exact = allItems.find((item) => normalizeCatalogText(item?.name) === candidate);
    if (exact) return exact;
  }

  for (const candidate of candidates) {
    const partial = allItems.find((item) => {
      const name = normalizeCatalogText(item?.name);
      return name && (name.includes(candidate) || candidate.includes(name));
    });

    if (partial) return partial;
  }

  return null;
}

async function buildCatalogPreviewHtml(select) {
  const item = await resolveCatalogOptionItem(select);

  if (!item) {
    return `
      <div class="vtm-catalog-preview-empty">
        Описание не найдено для выбранной записи.
      </div>
    `;
  }

  const system = item.system ?? {};

  const title = foundry.utils.escapeHTML(item.name ?? "Без названия");

  const typeParts = [
    normalizePreviewValue(system.category),
    normalizePreviewValue(system.points ?? system.cost ?? system.rating),
    normalizePreviewValue(system.kind ?? system.group)
  ].filter(Boolean);

  const meta = typeParts.length
    ? `<div class="vtm-catalog-preview-meta">${foundry.utils.escapeHTML(typeParts.join(" · "))}</div>`
    : "";

  const description = await enrichPreviewHtml(itemField(item, [
    "system.description",
    "system.description.value",
    "system.profile.description",
    "system.details.description",
    "system.text.description",
    "system.longDescription",
    "system.flavor",
    "system.flavour",
    "system.lore",
    "system.notes",
    "description"
  ]));

  const short = await enrichPreviewHtml(itemField(item, [
    "system.summary",
    "system.short",
    "system.shortDescription",
    "system.brief",
    "system.details.summary",
    "system.text.summary",
    "system.system",
    "system.systemText",
    "system.effectSummary"
  ]));

  const mechanics = await enrichPreviewHtml(itemField(item, [
    "system.mechanics",
    "system.mechanics.value",
    "system.effect",
    "system.effect.value",
    "system.effects",
    "system.power",
    "system.power.value",
    "system.system",
    "system.rules",
    "system.rulesText",
    "system.damage",
    "system.damage.value",
    "system.difficulty",
    "system.pool",
    "system.roll",
    "system.automation.description"
  ]));

  const sections = [];

  if (description) {
    sections.push(`
      <section class="vtm-catalog-preview-section">
        <h4>Описание</h4>
        <div>${description}</div>
      </section>
    `);
  }

  if (short) {
    sections.push(`
      <section class="vtm-catalog-preview-section">
        <h4>Кратко</h4>
        <div>${short}</div>
      </section>
    `);
  }

  if (mechanics) {
    sections.push(`
      <section class="vtm-catalog-preview-section">
        <h4>Механика</h4>
        <div>${mechanics}</div>
      </section>
    `);
  }

  if (!sections.length) {
    sections.push(`
      <div class="vtm-catalog-preview-empty">
        У записи есть карточка, но описание в ней не найдено.
      </div>
    `);
  }

  return `
    <div class="vtm-catalog-preview-title">${title}</div>
    ${meta}
    ${sections.join("")}
  `;
}

function installCatalogPickerPreview(select, wrapper) {
  if (!isVtmCatalogPickerWindow(select)) return;

  const formGroup = wrapper.closest(".form-group") ?? wrapper.parentElement;
  if (!formGroup) return;

  if (formGroup.querySelector(".vtm-catalog-preview")) return;

  const preview = document.createElement("div");
  preview.className = "vtm-catalog-preview";
  preview.innerHTML = `<div class="vtm-catalog-preview-empty">Выберите запись из справочника.</div>`;

  formGroup.appendChild(preview);

  let token = 0;

  const update = async () => {
    const currentToken = ++token;
    preview.classList.add("is-loading");

    const html = await buildCatalogPreviewHtml(select);

    if (currentToken !== token) return;

    preview.innerHTML = html;
    preview.classList.remove("is-loading");

  };

  select.addEventListener("change", update);
  requestAnimationFrame(update);
}

function enhanceSelect(select) {
  if (!shouldEnhanceSelect(select)) return;

  select.dataset.vtmDialogSearchEnhanced = "1";
  select.classList.add("vtm-dialog-native-select");
  hideNativeSelect(select);

  themeDialog(select);

  const wrapper = document.createElement("div");
  wrapper.className = "vtm-dialog-search-select";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "vtm-dialog-search-button";
  button.textContent = selectedLabel(select);
  button.title = selectedLabel(select);
  button.setAttribute("aria-haspopup", "listbox");

  select.parentNode.insertBefore(wrapper, select);
  wrapper.appendChild(select);
  hideNativeSelect(select);
  wrapper.appendChild(button);

  installCatalogPickerPreview(select, wrapper);


  button.addEventListener("click", () => openSearchPanel(select, button));

  button.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " " || event.key === "ArrowDown") {
      event.preventDefault();
      openSearchPanel(select, button);
    }
  });

  select.addEventListener("change", () => {
    button.textContent = selectedLabel(select);
    button.title = selectedLabel(select);
  });

  const observer = new MutationObserver(() => {
    button.textContent = selectedLabel(select);
    button.title = selectedLabel(select);
  });

  observer.observe(select, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["selected", "disabled", "label"]
  });
}

function scan(root = document) {
  const base = root instanceof Element || root instanceof Document ? root : document;

  if (base instanceof HTMLSelectElement) {
    enhanceSelect(base);
    return;
  }

  base.querySelectorAll?.("select")?.forEach(enhanceSelect);
}

function startSearchableDialogs() {
  scan(document);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) continue;
        scan(node);
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

if (globalThis.Hooks?.once) {
  Hooks.once("ready", startSearchableDialogs);
} else if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startSearchableDialogs, { once: true });
} else {
  startSearchableDialogs();
}
