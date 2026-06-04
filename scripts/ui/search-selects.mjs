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

let openPanel = null;

function isVtmRollWindow(select) {
  const app = select.closest(".app, .application, .window-app");
  const title = app?.querySelector(".window-title, .window-header h4, header h1")?.textContent ?? "";
  return ROLL_TITLE_RE.test(title);
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

  return false;
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
      rows.push({
        type: "option",
        value: node.value,
        label: node.textContent?.trim() || node.value,
        disabled: node.disabled,
        selected: node.selected,
        group: ""
      });
    }
  }

  return rows;
}

function selectedLabel(select) {
  const option = select.selectedOptions?.[0];
  return option?.textContent?.trim() || select.value || "Выбрать";
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
