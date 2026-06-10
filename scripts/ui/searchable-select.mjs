const ENHANCED_ATTR = "data-vtm-search-enhanced";
const WRAPPER_CLASS = "vtm-search-select";
const PORTAL_CLASS = "vtm-search-select-portal";

const INFERRED_GROUPS = [
  {
    label: "Физические",
    keys: ["strength", "dexterity", "stamina", "сила", "ловкость", "выносливость"]
  },
  {
    label: "Социальные",
    keys: ["charisma", "manipulation", "appearance", "обаяние", "манипуляция", "внешность"]
  },
  {
    label: "Ментальные",
    keys: ["perception", "intelligence", "wits", "восприятие", "интеллект", "смекалка"]
  },
  {
    label: "Таланты",
    keys: [
      "alertness", "athletics", "brawl", "dodge", "empathy", "expression", "intimidation", "leadership", "streetwise", "subterfuge",
      "бдительность", "атлетика", "драка", "уклонение", "эмпатия", "красноречие", "запугивание", "лидерство", "уличное чутье", "уличное чутьё", "хитрость"
    ]
  },
  {
    label: "Навыки",
    keys: [
      "animalken", "animal ken", "crafts", "drive", "etiquette", "firearms", "melee", "performance", "security", "stealth", "survival",
      "обр. с животными", "обращение с животными", "ремесло", "вождение", "этикет", "стрельба", "фехтование", "исполнение", "взлом", "скрытность", "выживание"
    ]
  },
  {
    label: "Знания",
    keys: [
      "academics", "computer", "finance", "investigation", "law", "linguistics", "medicine", "occult", "politics", "science", "technology",
      "гум. науки", "гуманитарные науки", "информатика", "финансы", "расследование", "законы", "лингвистика", "медицина", "оккультизм", "политика", "ест. науки", "естественные науки", "электроника"
    ]
  }
];

const GROUP_BY_KEY = new Map();
for (const group of INFERRED_GROUPS) {
  for (const key of group.keys) {
    GROUP_BY_KEY.set(normalize(key), group.label);
  }
}

function normalize(value = "") {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replaceAll("ё", "е")
    .replace(/\s+/g, " ");
}

function stripRating(value = "") {
  return normalize(value)
    .replace(/\s*\([^)]+\)\s*$/g, "")
    .trim();
}

function getSelectedOption(select) {
  return select.selectedOptions?.[0]
    ?? Array.from(select.options).find(option => option.selected)
    ?? select.options?.[0]
    ?? null;
}

function optionToData(option, group = "") {
  return {
    value: option.value,
    label: option.textContent?.trim() || option.value,
    disabled: option.disabled,
    selected: option.selected,
    group
  };
}

function getLabelForSelect(select) {
  const id = select.id;
  const explicitLabel = id ? select.ownerDocument.querySelector(`label[for="${CSS.escape(id)}"]`) : null;
  if (explicitLabel?.textContent?.trim()) return explicitLabel.textContent.trim();

  const closestLabel = select.closest("label");
  if (closestLabel?.textContent?.trim()) return closestLabel.textContent.trim();

  return select.getAttribute("aria-label") || select.name || "Выбор";
}

function inferGroupForOption(option) {
  const parent = option.parentElement;
  if (parent instanceof HTMLOptGroupElement && parent.label) return parent.label;

  const candidates = [
    normalize(option.value),
    stripRating(option.value),
    normalize(option.textContent),
    stripRating(option.textContent)
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (GROUP_BY_KEY.has(candidate)) return GROUP_BY_KEY.get(candidate);
  }

  return "";
}

function getOptionEntries(select) {
  const entries = [];

  for (const child of Array.from(select.children)) {
    if (child instanceof HTMLOptionElement) {
      entries.push(optionToData(child, inferGroupForOption(child)));
      continue;
    }

    if (child instanceof HTMLOptGroupElement) {
      const group = child.label || "";
      for (const option of Array.from(child.children)) {
        if (option instanceof HTMLOptionElement) entries.push(optionToData(option, group));
      }
    }
  }

  return entries;
}

function updateButtonLabel({ select, searchInput, buttonLabel, wrapper }) {
  const query = String(searchInput?.value ?? "").trim();

  if (wrapper?.classList.contains("is-open") && query) {
    buttonLabel.textContent = `Поиск: ${query}`;
    buttonLabel.classList.add("is-searching");
    return;
  }

  const selected = getSelectedOption(select);
  buttonLabel.textContent = selected?.textContent?.trim() || "Выбрать";
  buttonLabel.classList.remove("is-searching");
}

function positionDropdown(wrapper) {
  const button = wrapper._vtmSearchButton;
  const dropdown = wrapper._vtmSearchDropdown;
  const list = wrapper._vtmSearchList;
  if (!button || !dropdown || !list) return;

  const rect = button.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const gap = 4;
  const margin = 8;

  const minWidth = Math.max(rect.width, 220);
  const width = Math.min(Math.max(rect.width, 340), viewportWidth - margin * 2);

  let left = rect.left;
  if (left + width > viewportWidth - margin) left = viewportWidth - margin - width;
  left = Math.max(margin, left);

  const spaceBelow = viewportHeight - rect.bottom - margin;
  const spaceAbove = rect.top - margin;
  const openUp = spaceBelow < 260 && spaceAbove > spaceBelow;

  const maxHeight = Math.max(180, Math.min(420, openUp ? spaceAbove - gap : spaceBelow - gap));

  dropdown.style.position = "fixed";
  dropdown.style.left = `${left}px`;
  dropdown.style.minWidth = `${minWidth}px`;
  dropdown.style.width = `${width}px`;
  dropdown.style.maxHeight = `${maxHeight}px`;

  const dropdownStyles = window.getComputedStyle(dropdown);
  const search = wrapper._vtmSearchInput;
  const searchHeight = search ? search.getBoundingClientRect().height : 32;
  const paddingTop = Number.parseFloat(dropdownStyles.paddingTop) || 0;
  const paddingBottom = Number.parseFloat(dropdownStyles.paddingBottom) || 0;
  const listGap = 8;
  const listMaxHeight = Math.max(120, maxHeight - searchHeight - paddingTop - paddingBottom - listGap);

  list.style.maxHeight = `${listMaxHeight}px`;
  list.style.overflowY = "auto";

  if (openUp) {
    dropdown.style.top = "";
    dropdown.style.bottom = `${viewportHeight - rect.top + gap}px`;
  } else {
    dropdown.style.bottom = "";
    dropdown.style.top = `${rect.bottom + gap}px`;
  }
}

function closeWrapper(wrapper) {
  if (!wrapper) return;

  wrapper.classList.remove("is-open");

  const button = wrapper._vtmSearchButton;
  const dropdown = wrapper._vtmSearchDropdown;
  const searchInput = wrapper._vtmSearchInput;
  const buttonLabel = wrapper._vtmSearchLabel;
  const select = wrapper._vtmOriginalSelect;

  if (button) button.setAttribute("aria-expanded", "false");
  if (dropdown) dropdown.classList.remove("is-open");
  if (searchInput) searchInput.value = "";

  if (select && buttonLabel) {
    updateButtonLabel({ select, searchInput, buttonLabel, wrapper });
  }
}

function closeAllExcept(currentWrapper = null) {
  for (const wrapper of document.querySelectorAll(`.${WRAPPER_CLASS}.is-open`)) {
    if (wrapper === currentWrapper) continue;
    closeWrapper(wrapper);
  }
}

function addGroupHeader(list, group) {
  const header = document.createElement("div");
  header.className = "vtm-search-select-group";
  header.textContent = group;
  list.appendChild(header);
}

function buildList({ select, wrapper, list, searchInput, buttonLabel }) {
  const query = normalize(searchInput.value);
  const selectedValue = select.value;
  const entries = getOptionEntries(select);

  list.innerHTML = "";

  let visibleCount = 0;
  let lastGroup = null;

  for (const option of entries) {
    const searchable = `${option.label} ${option.value} ${option.group}`;

    if (query && !normalize(searchable).includes(query)) continue;

    if (option.group && option.group !== lastGroup) {
      addGroupHeader(list, option.group);
      lastGroup = option.group;
    }

    visibleCount += 1;

    const row = document.createElement("button");
    row.type = "button";
    row.className = "vtm-search-select-option";
    row.dataset.value = option.value;
    row.textContent = option.label;
    row.disabled = option.disabled;
    row.setAttribute("role", "option");
    row.setAttribute("aria-selected", option.value === selectedValue ? "true" : "false");

    if (option.group) row.dataset.group = option.group;
    if (option.value === selectedValue) row.classList.add("is-selected");

    row.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();

      if (option.disabled) return;

      select.value = option.value;
      closeWrapper(wrapper);

      select.dispatchEvent(new Event("input", { bubbles: true }));
      select.dispatchEvent(new Event("change", { bubbles: true }));

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

  positionDropdown(wrapper);
}

function enhanceSelect(select) {
  // Do not enhance selects inside the main actor sheet.
  // Actor sheet re-renders frequently and custom wrappers break the layout.
  if (select?.closest?.(".vtm-sheet, .vtm-sheet-v2, .vtm-vampire-shell")) return;
  if (!(select instanceof HTMLSelectElement)) return;
  if (select.multiple) return;
  if (select.hasAttribute(ENHANCED_ATTR)) return;
  if (select.dataset.vtmNativeSelect === "true") return;
  if (!select.closest(".vtm-revised")) return;

  select.setAttribute(ENHANCED_ATTR, "1");

  const wrapper = document.createElement("div");
  wrapper.className = WRAPPER_CLASS;
  if (select.disabled) wrapper.classList.add("is-disabled");

  const button = document.createElement("button");
  button.type = "button";
  button.className = "vtm-search-select-button";
  button.disabled = select.disabled;
  button.setAttribute("aria-haspopup", "listbox");
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("title", getLabelForSelect(select));

  const buttonLabel = document.createElement("span");
  buttonLabel.className = "vtm-search-select-value";

  const arrow = document.createElement("span");
  arrow.className = "vtm-search-select-arrow";
  arrow.textContent = "▾";

  button.append(buttonLabel, arrow);

  const dropdown = document.createElement("div");
  dropdown.className = `${PORTAL_CLASS} vtm-revised`;

  const searchInput = document.createElement("input");
  searchInput.type = "search";
  searchInput.className = "vtm-search-select-search";
  searchInput.placeholder = "Поиск...";
  searchInput.autocomplete = "off";
  searchInput.spellcheck = false;

  const list = document.createElement("div");
  list.className = "vtm-search-select-list";
  list.setAttribute("role", "listbox");

  dropdown.append(searchInput, list);
  document.body.appendChild(dropdown);

  wrapper.append(button);
  select.classList.add("vtm-search-select-original");
  select.insertAdjacentElement("afterend", wrapper);

  wrapper._vtmOriginalSelect = select;
  wrapper._vtmSearchButton = button;
  wrapper._vtmSearchDropdown = dropdown;
  wrapper._vtmSearchInput = searchInput;
  wrapper._vtmSearchList = list;
  wrapper._vtmSearchLabel = buttonLabel;

  updateButtonLabel({ select, searchInput, buttonLabel, wrapper });
  buildList({ select, wrapper, list, searchInput, buttonLabel });

  button.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();

    if (select.disabled) return;

    const willOpen = !wrapper.classList.contains("is-open");

    closeAllExcept(wrapper);

    wrapper.classList.toggle("is-open", willOpen);
    dropdown.classList.toggle("is-open", willOpen);
    button.setAttribute("aria-expanded", willOpen ? "true" : "false");

    updateButtonLabel({ select, searchInput, buttonLabel, wrapper });
    buildList({ select, wrapper, list, searchInput, buttonLabel });

    if (willOpen) {
      positionDropdown(wrapper);
      setTimeout(() => {
        positionDropdown(wrapper);
        searchInput.focus();
        searchInput.select();
      }, 0);
    }
  });

  dropdown.addEventListener("click", event => {
    event.stopPropagation();
  });

  searchInput.addEventListener("input", () => {
    updateButtonLabel({ select, searchInput, buttonLabel, wrapper });
    buildList({ select, wrapper, list, searchInput, buttonLabel });
    positionDropdown(wrapper);
  });

  searchInput.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeWrapper(wrapper);
      button.focus();
      return;
    }

    if (event.key === "Enter") {
      const first = list.querySelector(".vtm-search-select-option:not(:disabled)");
      if (first) {
        event.preventDefault();
        first.click();
      }
    }
  });

  select.addEventListener("change", () => {
    updateButtonLabel({ select, searchInput, buttonLabel, wrapper });
    buildList({ select, wrapper, list, searchInput, buttonLabel });
  });
}

export function enhanceSearchableSelects(root = document) {
  if (!root) return;

  const roots = [];

  if (root instanceof Document) {
    roots.push(root);
  } else if (root instanceof HTMLElement) {
    roots.push(root);
  } else if (root?.[0] instanceof HTMLElement) {
    roots.push(root[0]);
  }

  for (const element of roots) {
    const selects = element.matches?.("select")
      ? [element]
      : Array.from(element.querySelectorAll?.("select") ?? []);

    for (const select of selects) {
      enhanceSelect(select);
    }
  }
}

function scheduleEnhance(root) {
  window.requestAnimationFrame(() => enhanceSearchableSelects(root));
}

function repositionOpenDropdowns() {
  for (const wrapper of document.querySelectorAll(`.${WRAPPER_CLASS}.is-open`)) {
    positionDropdown(wrapper);
  }
}

export function registerSearchableSelects() {
  const hookNames = [
    "renderApplication",
    "renderActorSheet",
    "renderItemSheet",
    "renderVTMVampireActorSheet",
    "renderVTMItemSheet",
    "renderVTMCharacterCreationWizard"
  ];

  for (const hookName of hookNames) {
    Hooks.on(hookName, (_app, html) => {
      scheduleEnhance(html);
    });
  }

  Hooks.once("ready", () => {
    scheduleEnhance(document.body);

    const observer = new MutationObserver(entries => {
      for (const entry of entries) {
        for (const node of entry.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          scheduleEnhance(node);
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    document.addEventListener("click", event => {
      if (event.target?.closest?.(`.${WRAPPER_CLASS}, .${PORTAL_CLASS}`)) return;
      closeAllExcept(null);
    });

    document.addEventListener("keydown", event => {
      if (event.key !== "Escape") return;
      closeAllExcept(null);
    });

    window.addEventListener("resize", repositionOpenDropdowns);
    window.addEventListener("scroll", repositionOpenDropdowns, true);
  });
}
