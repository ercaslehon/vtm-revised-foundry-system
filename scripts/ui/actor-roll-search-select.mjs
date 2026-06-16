function normalize(value = "") {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replaceAll("ё", "е")
    .replace(/\s+/g, " ");
}

function closeOpenTraitSearchSelects(except = null) {
  document.querySelectorAll(".vtm-trait-search-select.is-open").forEach(wrapper => {
    if (except && wrapper === except) return;
    wrapper.classList.remove("is-open");

    const panel = wrapper.querySelector(".vtm-trait-search-select__panel");
    if (panel) panel.hidden = true;

    const button = wrapper.querySelector(".vtm-trait-search-select__button");
    if (button) button.setAttribute("aria-expanded", "false");
  });
}

function getOptionRows(select) {
  const rows = [];

  for (const child of Array.from(select.children)) {
    if (child.tagName === "OPTGROUP") {
      const groupLabel = child.label || "";
      rows.push({ type: "group", label: groupLabel });

      for (const option of Array.from(child.children).filter(node => node.tagName === "OPTION")) {
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

    if (child.tagName === "OPTION") {
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
  if (select.dataset.vtmTraitSearchEnhanced === "1") return false;

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
      || name.includes("trait")
      || className.includes("trait")
      || select.closest(".vtm-roll-dialog")
      || select.closest(".vtm-dice-dialog")
      || select.closest(".vtm-combo-roll")
    )
  );
}

function enhanceTraitSelect(select) {
  if (!shouldEnhanceTraitSelect(select)) return;

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
  wrapper.append(button, panel);
  wrapper.append(select);

  select.classList.add("vtm-trait-search-select__native");

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

  const choose = value => {
    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    label.textContent = selectedText();
    close();
  };

  const renderList = query => {
    const q = normalize(query);
    list.innerHTML = "";

    let visibleInCurrentGroup = 0;
    let currentGroupElement = null;

    for (const row of rows) {
      if (row.type === "group") {
        currentGroupElement = document.createElement("div");
        currentGroupElement.className = "vtm-trait-search-select__group";
        currentGroupElement.textContent = row.label;
        currentGroupElement.dataset.visibleCount = "0";
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
      item.addEventListener("click", () => choose(row.value));
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

  label.textContent = selectedText();

  button.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    panel.hidden ? open() : close();
  });

  search.addEventListener("input", () => renderList(search.value));

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
  });
}

export function enhanceActorRollSearchSelects(root = document) {
  const scope = root instanceof HTMLElement ? root : document;
  scope.querySelectorAll("select").forEach(select => enhanceTraitSelect(select));
}

Hooks.on("renderApplication", (_app, html) => {
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root) return;
  enhanceActorRollSearchSelects(root);
});

Hooks.on("renderActorSheet", (_app, html) => {
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root) return;
  enhanceActorRollSearchSelects(root);
});
