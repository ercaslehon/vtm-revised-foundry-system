function normalize(value = "") {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replaceAll("ё", "е")
    .replace(/\s+/g, " ");
}

function rootElement(html) {
  if (html instanceof HTMLElement) return html;
  if (html?.[0] instanceof HTMLElement) return html[0];
  if (html?.element instanceof HTMLElement) return html.element;
  return null;
}

function hideNativeSelect(select) {
  if (!(select instanceof HTMLSelectElement)) return;

  select.classList.add("vtm-trait-search-select__native");
  select.setAttribute("aria-hidden", "true");
  select.tabIndex = -1;

  select.style.setProperty("display", "none", "important");
  select.style.setProperty("visibility", "hidden", "important");
  select.style.setProperty("pointer-events", "none", "important");
  select.style.setProperty("position", "absolute", "important");
  select.style.setProperty("width", "0", "important");
  select.style.setProperty("height", "0", "important");
  select.style.setProperty("min-width", "0", "important");
  select.style.setProperty("min-height", "0", "important");
  select.style.setProperty("margin", "0", "important");
  select.style.setProperty("padding", "0", "important");
  select.style.setProperty("border", "0", "important");
  select.style.setProperty("opacity", "0", "important");
}

function cleanupForeignDialogSearchWrappers(root = document) {
  const scope = rootElement(root) ?? root;
  if (!scope?.querySelectorAll) return;

  scope.querySelectorAll(".vtm-dialog-search-select").forEach(wrapper => {
    const select = wrapper.querySelector("select");
    const name = String(select?.name || "").toLowerCase();
    const rollField = String(select?.dataset?.rollField || "").toLowerCase();

    const isRollTrait = Boolean(
      select?.classList?.contains("vtm-trait-roll-select")
      || select?.dataset?.vtmSearchableSelect === "true"
      || name === "firsttrait"
      || name === "secondtrait"
      || rollField === "firsttrait"
      || rollField === "secondtrait"
    );

    if (!isRollTrait) return;

    if (select && wrapper.parentElement) {
      select.dataset.vtmDialogSearchEnhanced = "";
      wrapper.after(select);
    }

    wrapper.remove();
  });
}

function cleanupDuplicateTraitSearchWrappers(root = document) {
  const scope = rootElement(root) ?? root;
  if (!scope?.querySelectorAll) return;

  const groups = new Map();

  scope.querySelectorAll(".vtm-trait-search-select").forEach(wrapper => {
    const select = wrapper.querySelector("select");
    const key = [
      select?.name || "",
      select?.dataset?.rollField || "",
      wrapper.closest(".form-group, label, .vtm-roll-row, .vtm-roll-panel, .dialog-content") || wrapper.parentElement
    ];

    const mapKey = `${key[0]}::${key[1]}::${key[2] ? Array.from(scope.querySelectorAll("*")).indexOf(key[2]) : "root"}`;
    if (!groups.has(mapKey)) groups.set(mapKey, []);
    groups.get(mapKey).push(wrapper);
  });

  for (const wrappers of groups.values()) {
    if (wrappers.length <= 1) continue;

    // Keep the last wrapper because it usually belongs to the final rendered dialog DOM.
    for (const wrapper of wrappers.slice(0, -1)) {
      const select = wrapper.querySelector("select");
      if (select && wrapper.parentElement) {
        select.dataset.vtmTraitSearchEnhanced = "";
        wrapper.after(select);
      }
      wrapper.remove();
    }
  }
}

function closeOpenTraitSearchSelects(except = null) {
  document.querySelectorAll(".vtm-trait-search-select.is-open").forEach(wrapper => {
    if (except && wrapper === except) return;

    wrapper.classList.remove("is-open", "opens-up");

    const panel = wrapper.querySelector(".vtm-trait-search-select__panel");
    if (panel) panel.hidden = true;

    const button = wrapper.querySelector(".vtm-trait-search-select__button");
    if (button) button.setAttribute("aria-expanded", "false");
  });
}

function getOptionRows(select) {
  const rows = [];

  for (const child of Array.from(select.children)) {
    if (child instanceof HTMLOptGroupElement) {
      const groupLabel = child.label || "";
      rows.push({ type: "group", label: groupLabel });

      for (const option of Array.from(child.children).filter(node => node instanceof HTMLOptionElement)) {
        rows.push({
          type: "option",
          label: option.textContent?.trim() || option.value,
          value: option.value,
          group: groupLabel,
          selected: option.selected,
          disabled: option.disabled
        });
      }

      continue;
    }

    if (child instanceof HTMLOptionElement) {
      rows.push({
        type: "option",
        label: child.textContent?.trim() || child.value,
        value: child.value,
        group: "",
        selected: child.selected,
        disabled: child.disabled
      });
    }
  }

  return rows;
}

function shouldEnhanceTraitSelect(select) {
  if (!(select instanceof HTMLSelectElement)) return false;
  if (select.closest?.(".window-app.dialog, .dialog, .application.dialog")) return false;
  if (select.dataset.vtmTraitSearchEnhanced === "1") return false;
  if (select.closest(".vtm-trait-search-select")) return false;

  const hasGroups = Boolean(select.querySelector("optgroup"));
  const hasEnoughOptions = Number(select.options?.length ?? 0) >= 6;
  const name = String(select.name || "").toLowerCase();
  const className = String(select.className || "").toLowerCase();
  const rollField = String(select.dataset?.rollField || "").toLowerCase();
  const explicit = select.dataset?.vtmSearchableSelect === "true";

  return Boolean(
    (hasGroups || hasEnoughOptions)
    && (
      explicit
      || rollField.includes("trait")
      || name === "firsttrait"
      || name === "secondtrait"
      || name.includes("trait")
      || className.includes("trait-roll-select")
      || select.closest(".vtm-roll-dialog")
      || select.closest(".vtm-dice-dialog")
      || select.closest(".vtm-combo-roll")
    )
  );
}

function enhanceTraitSelect(select) {
  if (!shouldEnhanceTraitSelect(select)) return;

  const existingWrapper = select.closest(".vtm-trait-search-select");
  if (existingWrapper) {
    hideNativeSelect(select);
    return;
  }

  select.dataset.vtmTraitSearchEnhanced = "1";

  const wrapper = document.createElement("div");
  wrapper.className = "vtm-trait-search-select";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "vtm-trait-search-select__button";
  button.setAttribute("aria-haspopup", "listbox");
  button.setAttribute("aria-expanded", "false");

  const label = document.createElement("span");
  label.className = "vtm-trait-search-select__label";

  const caret = document.createElement("span");
  caret.className = "vtm-trait-search-select__caret";
  caret.textContent = "▾";

  button.append(label, caret);

  const panel = document.createElement("div");
  panel.className = "vtm-trait-search-select__panel";
  panel.hidden = true;

  const search = document.createElement("input");
  search.type = "search";
  search.className = "vtm-trait-search-select__search";
  search.placeholder = "Поиск...";
  search.autocomplete = "off";

  const list = document.createElement("div");
  list.className = "vtm-trait-search-select__list";

  panel.append(search, list);

  select.after(wrapper);
  wrapper.append(button, panel, select);

  hideNativeSelect(select);

  const rows = getOptionRows(select);

  const selectedText = () => select.selectedOptions?.[0]?.textContent?.trim() || "Выберите значение";

  const positionPanel = () => {
    const rect = button.getBoundingClientRect();
    const gap = 6;
    const viewportPadding = 14;
    const preferredHeight = 300;
    const minHeight = 150;

    const availableBelow = window.innerHeight - rect.bottom - gap - viewportPadding;
    const availableAbove = rect.top - gap - viewportPadding;
    const shouldOpenUp = availableBelow < 210 && availableAbove > availableBelow;

    const available = Math.max(
      minHeight,
      Math.min(preferredHeight, shouldOpenUp ? availableAbove : availableBelow)
    );

    wrapper.classList.toggle("opens-up", shouldOpenUp);
    wrapper.style.setProperty("--vtm-trait-search-panel-max-height", `${available}px`);
    wrapper.style.setProperty("--vtm-trait-search-list-max-height", `${Math.max(95, available - 52)}px`);
  };

  const close = () => {
    panel.hidden = true;
    wrapper.classList.remove("is-open", "opens-up");
    button.setAttribute("aria-expanded", "false");
  };

  const renderList = query => {
    const q = normalize(query);
    list.innerHTML = "";

    let currentGroupElement = null;
    let visibleInCurrentGroup = 0;

    for (const row of rows) {
      if (row.type === "group") {
        currentGroupElement = document.createElement("div");
        currentGroupElement.className = "vtm-trait-search-select__group";
        currentGroupElement.textContent = row.label;
        currentGroupElement.dataset.visibleCount = "0";
        currentGroupElement.hidden = true;
        list.append(currentGroupElement);
        visibleInCurrentGroup = 0;
        continue;
      }

      const haystack = normalize(`${row.label} ${row.group}`);
      if (q && !haystack.includes(q)) continue;

      if (currentGroupElement) {
        visibleInCurrentGroup += 1;
        currentGroupElement.dataset.visibleCount = String(visibleInCurrentGroup);
        currentGroupElement.hidden = false;
      }

      const item = document.createElement("button");
      item.type = "button";
      item.className = "vtm-trait-search-select__option";
      if (row.value === select.value) item.classList.add("is-selected");
      item.disabled = row.disabled;
      item.textContent = row.label;
      item.addEventListener("click", event => {
        event.preventDefault();
        select.value = row.value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        label.textContent = selectedText();
        close();
      });
      list.append(item);
    }

    list.querySelectorAll(".vtm-trait-search-select__group").forEach(group => {
      group.hidden = group.dataset.visibleCount === "0";
    });

    if (!list.querySelector(".vtm-trait-search-select__option")) {
      const empty = document.createElement("div");
      empty.className = "vtm-trait-search-select__empty";
      empty.textContent = "Ничего не найдено";
      list.append(empty);
    }
  };

  const open = () => {
    closeOpenTraitSearchSelects(wrapper);
    panel.hidden = false;
    wrapper.classList.add("is-open");
    button.setAttribute("aria-expanded", "true");
    search.value = "";
    renderList("");
    positionPanel();
    requestAnimationFrame(() => search.focus());
  };

  label.textContent = selectedText();

  button.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    panel.hidden ? open() : close();
  });

  search.addEventListener("input", () => {
    renderList(search.value);
    positionPanel();
  });

  search.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      button.focus();
    }
  });

  document.addEventListener("click", event => {
    if (!wrapper.contains(event.target)) close();
  });

  window.addEventListener("resize", () => {
    if (wrapper.classList.contains("is-open")) positionPanel();
  });

  document.addEventListener("scroll", () => {
    if (wrapper.classList.contains("is-open")) positionPanel();
  }, true);

  select.addEventListener("change", () => {
    label.textContent = selectedText();
    renderList(search.value);
  });
}

export function enhanceActorRollSearchSelects(root = document) {
  const scope = rootElement(root) ?? root;
  if (!scope?.querySelectorAll) return;

  cleanupForeignDialogSearchWrappers(scope);

  scope.querySelectorAll("select[data-vtm-trait-search-enhanced='1'], select.vtm-trait-search-select__native")
    .forEach(select => hideNativeSelect(select));

  scope.querySelectorAll("select").forEach(select => enhanceTraitSelect(select));
  cleanupForeignDialogSearchWrappers(scope);
  cleanupDuplicateTraitSearchWrappers(scope);
}

Hooks.on("renderActorSheet", (_app, html) => {
  enhanceActorRollSearchSelects(html);
});


