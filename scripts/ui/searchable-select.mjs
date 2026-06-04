const ENHANCED_ATTR = "data-vtm-search-enhanced";
const WRAPPER_CLASS = "vtm-search-select";

function getLabelForSelect(select) {
  const explicitLabel = select.id ? select.ownerDocument.querySelector(`label[for="${CSS.escape(select.id)}"]`) : null;
  if (explicitLabel?.textContent?.trim()) return explicitLabel.textContent.trim();

  const closestLabel = select.closest("label");
  if (closestLabel?.textContent?.trim()) return closestLabel.textContent.trim();

  return select.getAttribute("aria-label") || select.name || "Выбор";
}

function optionToData(option) {
  return {
    value: option.value,
    label: option.textContent?.trim() || option.value,
    disabled: option.disabled,
    selected: option.selected
  };
}

function getSelectedOption(select) {
  return select.selectedOptions?.[0] ?? Array.from(select.options).find(option => option.selected) ?? select.options?.[0] ?? null;
}

function closeAllExcept(currentWrapper) {
  for (const wrapper of document.querySelectorAll(`.${WRAPPER_CLASS}.is-open`)) {
    if (wrapper !== currentWrapper) wrapper.classList.remove("is-open");
  }
}

function normalize(value = "") {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replaceAll("ё", "е");
}

function buildList({ select, wrapper, list, searchInput, buttonLabel }) {
  const query = normalize(searchInput.value);
  const options = Array.from(select.options).map(optionToData);
  const selectedValue = select.value;

  list.innerHTML = "";

  let visibleCount = 0;

  for (const option of options) {
    if (query && !normalize(option.label).includes(query) && !normalize(option.value).includes(query)) continue;

    visibleCount += 1;

    const row = document.createElement("button");
    row.type = "button";
    row.className = "vtm-search-select-option";
    row.dataset.value = option.value;
    row.textContent = option.label;
    row.disabled = option.disabled;
    row.setAttribute("role", "option");
    row.setAttribute("aria-selected", option.value === selectedValue ? "true" : "false");

    if (option.value === selectedValue) row.classList.add("is-selected");

    row.addEventListener("click", () => {
      if (option.disabled) return;

      select.value = option.value;

      const selected = getSelectedOption(select);
      buttonLabel.textContent = selected?.textContent?.trim() || "Выбрать";

      select.dispatchEvent(new Event("input", { bubbles: true }));
      select.dispatchEvent(new Event("change", { bubbles: true }));

      wrapper.classList.remove("is-open");
      searchInput.value = "";
      buildList({ select, wrapper, list, searchInput, buttonLabel });
    });

    list.appendChild(row);
  }

  if (!visibleCount) {
    const empty = document.createElement("div");
    empty.className = "vtm-search-select-empty";
    empty.textContent = "Ничего не найдено";
    list.appendChild(empty);
  }
}

function enhanceSelect(select) {
  if (!(select instanceof HTMLSelectElement)) return;
  if (select.multiple) return;
  if (select.hasAttribute(ENHANCED_ATTR)) return;
  if (select.dataset.vtmNativeSelect === "true") return;
  if (!select.closest(".vtm-revised")) return;

  select.setAttribute(ENHANCED_ATTR, "1");

  const selected = getSelectedOption(select);
  const label = getLabelForSelect(select);

  const wrapper = document.createElement("div");
  wrapper.className = WRAPPER_CLASS;
  if (select.disabled) wrapper.classList.add("is-disabled");

  const button = document.createElement("button");
  button.type = "button";
  button.className = "vtm-search-select-button";
  button.disabled = select.disabled;
  button.setAttribute("aria-haspopup", "listbox");
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("title", label);

  const buttonLabel = document.createElement("span");
  buttonLabel.className = "vtm-search-select-value";
  buttonLabel.textContent = selected?.textContent?.trim() || "Выбрать";

  const arrow = document.createElement("span");
  arrow.className = "vtm-search-select-arrow";
  arrow.textContent = "▾";

  button.append(buttonLabel, arrow);

  const dropdown = document.createElement("div");
  dropdown.className = "vtm-search-select-dropdown";

  const searchInput = document.createElement("input");
  searchInput.type = "search";
  searchInput.className = "vtm-search-select-search";
  searchInput.placeholder = "Поиск...";
  searchInput.autocomplete = "off";

  const list = document.createElement("div");
  list.className = "vtm-search-select-list";
  list.setAttribute("role", "listbox");

  dropdown.append(searchInput, list);
  wrapper.append(button, dropdown);

  select.classList.add("vtm-search-select-original");
  select.insertAdjacentElement("afterend", wrapper);

  buildList({ select, wrapper, list, searchInput, buttonLabel });

  button.addEventListener("click", () => {
    if (select.disabled) return;

    const willOpen = !wrapper.classList.contains("is-open");
    closeAllExcept(wrapper);
    wrapper.classList.toggle("is-open", willOpen);
    button.setAttribute("aria-expanded", willOpen ? "true" : "false");

    if (willOpen) {
      buildList({ select, wrapper, list, searchInput, buttonLabel });
      setTimeout(() => searchInput.focus(), 0);
    }
  });

  searchInput.addEventListener("input", () => {
    buildList({ select, wrapper, list, searchInput, buttonLabel });
  });

  searchInput.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      wrapper.classList.remove("is-open");
      button.focus();
      return;
    }

    if (event.key !== "Enter") return;

    const first = list.querySelector(".vtm-search-select-option:not(:disabled)");
    if (first) {
      event.preventDefault();
      first.click();
    }
  });

  select.addEventListener("change", () => {
    const selectedOption = getSelectedOption(select);
    buttonLabel.textContent = selectedOption?.textContent?.trim() || "Выбрать";
    buildList({ select, wrapper, list, searchInput, buttonLabel });
  });
}

export function enhanceSearchableSelects(root = document) {
  const element = root instanceof HTMLElement || root instanceof Document ? root : document;
  const selects = element.matches?.("select") ? [element] : Array.from(element.querySelectorAll?.("select") ?? []);

  for (const select of selects) {
    enhanceSelect(select);
  }
}

export function registerSearchableSelects() {
  Hooks.on("renderApplication", (_app, html) => {
    const root = html instanceof HTMLElement ? html : html?.[0];
    if (!root) return;
    window.requestAnimationFrame(() => enhanceSearchableSelects(root));
  });

  Hooks.once("ready", () => {
    enhanceSearchableSelects(document);

    const observer = new MutationObserver(entries => {
      for (const entry of entries) {
        for (const node of entry.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          if (!node.matches(".vtm-revised, .vtm-revised *")) continue;
          enhanceSearchableSelects(node);
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    document.addEventListener("click", event => {
      if (event.target?.closest?.(`.${WRAPPER_CLASS}`)) return;
      closeAllExcept(null);
    });

    document.addEventListener("keydown", event => {
      if (event.key !== "Escape") return;
      closeAllExcept(null);
    });
  });
}
