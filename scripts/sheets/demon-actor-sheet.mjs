import { rollDicePool } from "../dice/dice-pool.mjs";
import { VTM_REVISED } from "../config.mjs";
import { VTMArchetypeCard, findArchetypeForName } from "../apps/archetype-card.mjs";
import { enhanceActorRollSearchSelects } from "../ui/actor-roll-search-select.mjs";
import { DEMON_CATALOGS } from "../data/demon/demon-catalogs.mjs";
import { getDemonRollEffects } from "../data/demon/demon-roll-effects.mjs";
import { DEMON_ARCHETYPES } from "../data/demon/demon-archetypes.mjs";
import { VTMDemonCharacterCreationWizard } from "../apps/demon-character-creation-wizard.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const ActorSheetV2 = foundry.applications.sheets.ActorSheetV2;
const DialogV1 = foundry.appv1?.api?.Dialog ?? globalThis.Dialog;

const DEMON_TEMPLATE_PARTIALS = [
  "systems/vtm-revised/templates/actors/parts/item-list.hbs",
  "systems/vtm-revised/templates/actors/parts/weapons.hbs",
  "systems/vtm-revised/templates/actors/parts/experience-journal.hbs"
];

const DEMON_HOUSES = [
  { key: "devils", label: "Намару", hint: "Дом Сияния, власти, веры и повеления." },
  { key: "scourges", label: "Ашару", hint: "Дом Ветра, исцеления, небес и движения." },
  { key: "malefactors", label: "Ануннаки", hint: "Дом Земли, ремесла, материи и создания." },
  { key: "defilers", label: "Ламмасу", hint: "Дом Моря, желания, вдохновения и иллюзий." },
  { key: "devourers", label: "Рабису", hint: "Дом Дикой природы, плоти и зверей." },
  { key: "slayers", label: "Халаку", hint: "Дом Смерти, духов и границы миров." },
  { key: "fiends", label: "Неберу", hint: "Дом Светил, пророчеств, узоров и времени." }
];

const DEMON_FACTIONS = [
  { key: "faustians", label: "Фаустианцы", hint: "Люди должны верить, служить и строить новый порядок." },
  { key: "luciferans", label: "Люцифериане", hint: "Поиск Люцифера и продолжение войны." },
  { key: "reconcilers", label: "Примирители", hint: "Искупление, восстановление и попытка понять Творца." },
  { key: "cryptics", label: "Криптики", hint: "Истина важнее догм, ответов и старых знамен." },
  { key: "ravagers", label: "Опустошители", hint: "Мир сломан, и его надо добить." }
];

const ATTRIBUTE_LABELS = {
  physical: "Физические",
  social: "Социальные",
  mental: "Ментальные",
  strength: "Сила",
  dexterity: "Ловкость",
  stamina: "Выносливость",
  charisma: "Харизма",
  manipulation: "Манипулирование",
  appearance: "Внешность",
  perception: "Восприятие",
  intelligence: "Интеллект",
  wits: "Смекалка"
};

const ABILITY_LABELS = {
  talents: "Таланты",
  skills: "Навыки",
  knowledges: "Познания",

  athletics: "Атлетика",
  alertness: "Бдительность",
  brawl: "Драка",
  intimidation: "Запугивание",
  expression: "Красноречие",
  leadership: "Лидерство",
  dodge: "Уклонение",
  streetwise: "Уличное чутьё",
  subterfuge: "Хитрость",
  empathy: "Эмпатия",

  security: "Взлом",
  drive: "Вождение",
  survival: "Выживание",
  performance: "Исполнение",
  animalken: "Обр. с животными",
  crafts: "Ремесло",
  stealth: "Скрытность",
  firearms: "Стрельба",
  melee: "Фехтование",
  etiquette: "Этикет",

  academics: "Гум. науки",
  science: "Ест. науки",
  law: "Законы",
  computer: "Информатика",
  linguistics: "Лингвистика",
  medicine: "Медицина",
  occult: "Оккультизм",
  politics: "Политика",
  investigation: "Расследование",
  finance: "Финансы"
};


const VIRTUE_LABELS = {
  conscience: "Совесть",
  conviction: "Убеждённость",
  courage: "Мужество"
};

const BACKGROUND_LABELS = {
  allies: "Союзники",
  contacts: "Контакты",
  eminence: "Высокое положение",
  fame: "Слава",
  followers: "Последователи",
  influence: "Влияние",
  legacy: "Наследие",
  mentor: "Наставник",
  pacts: "Договоры",
  paragon: "Совершенство",
  resources: "Ресурсы"
};

const LORE_ORDER = [
  ["awakening", "Знание Пробуждения"],
  ["beast", "Знание Зверей", "beasts"],
  ["celestials", "Знание Небожителей"],
  ["chaos", "Знание Хаоса"],
  ["contamination", "Знание Нечистоты"],
  ["death", "Знание Смерти"],
  ["earth", "Знание Земли"],
  ["firmament", "Знание Небесного Свода"],
  ["flame", "Знание Пламени"],
  ["flesh", "Знание Плоти"],
  ["forge", "Знание Кузнечного Дела"],
  ["fundament", "Знание Основания", "foundation"],
  ["humanity", "Знание Человечества"],
  ["light", "Знание Света"],
  ["longing", "Знание Желания"],
  ["paths", "Знание Путей"],
  ["patterns", "Знание Узоров"],
  ["portals", "Знание Порталов"],
  ["radiance", "Знание Сияния"],
  ["realms", "Знание Сфер"],
  ["spirit", "Знание Душ"],
  ["storms", "Знание Бурь"],
  ["transfiguration", "Знание Метаморфоз"],
  ["violation", "Знание Насилия"],
  ["wild", "Знание Дикой природы", "pathsOfTheWild"],
  ["winds", "Знание Ветра"]
];

const HEALTH_LABELS = {
  bruised: "Синяки",
  hurt: "Ушиблен",
  injured: "Ранен",
  wounded: "Тяжело ранен",
  mauled: "Искалечен",
  crippled: "Покалечен",
  incapacitated: "Недееспособен"
};

const HEALTH_DAMAGE_LABELS = {
  0: "Нет урона",
  1: "Поверхностный",
  2: "Летальный",
  3: "Тяжёлый"
};

const HEALTH_DAMAGE_TYPES = {
  0: "none",
  1: "bashing",
  2: "lethal",
  3: "aggravated"
};

function getProperty(object, path, fallback = undefined) {
  return foundry.utils.getProperty(object, path) ?? fallback;
}

function numberValue(value, fallback = 0) {
  const n = Number(value ?? fallback);
  return Number.isFinite(n) ? n : fallback;
}

function buildTraitGroups(system, categories, labels, rootPath, { named = false } = {}) {
  return Object.entries(categories).map(([categoryKey, traits]) => ({
    key: categoryKey,
    label: labels[categoryKey] || categoryKey,
    rows: traits.map(traitKey => {
      const rollPath = named
        ? `${rootPath}.${categoryKey}.${traitKey}.value`
        : `${rootPath}.${categoryKey}.${traitKey}`;

      const valuePath = `system.${rollPath}`;
      const specializationPath = named
        ? `system.${rootPath}.${categoryKey}.${traitKey}.specialization`
        : "";

      return {
        key: traitKey,
        label: labels[traitKey] || traitKey,
        valuePath,
        rollPath,
        specializationPath,
        value: numberValue(getProperty(system, rollPath, named ? 0 : 1), named ? 0 : 1),
        specialization: specializationPath ? getProperty(system, specializationPath.replace(/^system\./, ""), "") : ""
      };
    })
  }));
}


function buildVirtueRows(system) {
  const virtueRules = VTM_REVISED.demonRules?.virtues ?? [];
  const hints = Object.fromEntries(virtueRules.map(row => [row.key, row.hint]));

  return Object.entries(VIRTUE_LABELS).map(([key, label]) => ({
    key,
    label,
    hint: hints[key] || "",
    valuePath: `system.virtues.${key}`,
    rollPath: `virtue.${key}`,
    value: numberValue(system.virtues?.[key], 1)
  }));
}

function buildBackgroundRows(system) {
  const backgroundRules = VTM_REVISED.demonRules?.backgrounds ?? [];
  const hints = Object.fromEntries(backgroundRules.map(row => [row.key, row.hint]));

  return Object.entries(BACKGROUND_LABELS).map(([key, label]) => {
    const background = system.backgrounds?.[key] ?? {};
    return {
      key,
      label: background.label || label,
      hint: hints[key] || "",
      labelPath: `system.backgrounds.${key}.label`,
      valuePath: `system.backgrounds.${key}.value`,
      specializationPath: `system.backgrounds.${key}.specialization`,
      rollPath: `background.${key}`,
      value: numberValue(background.value, 0),
      specialization: background.specialization || ""
    };
  });
}

function calculateSuggestedWillpower(system) {
  const values = ["conscience", "conviction", "courage"]
    .map(key => numberValue(system.virtues?.[key], 0))
    .sort((a, b) => b - a);

  return Math.max(1, Math.min(10, Number(values[0] || 0) + Number(values[1] || 0)));
}

function buildLoreRows(system) {
  return LORE_ORDER.map(([key, fallbackLabel, legacyKey]) => {
    const canonicalLore = system.lores?.[key] ?? {};
    const legacyLore = legacyKey ? (system.lores?.[legacyKey] ?? {}) : {};
    const useLegacy = Number(canonicalLore.value || 0) <= 0 && Number(legacyLore.value || 0) > 0;
    const storageKey = useLegacy ? legacyKey : key;
    const lore = useLegacy ? legacyLore : canonicalLore;
    return {
      key,
      label: lore.label || fallbackLabel,
      labelPath: `system.lores.${storageKey}.label`,
      valuePath: `system.lores.${storageKey}.value`,
      rollPath: `lores.${storageKey}.value`,
      notePath: `system.lores.${storageKey}.note`,
      value: numberValue(lore.value, 0),
      note: lore.note || ""
    };
  });
}

function healthDamageStyle(type = "none") {
  if (type === "bashing") {
    return "background: radial-gradient(circle at 14% 10%, rgba(136, 150, 255, 0.24), transparent 48%), linear-gradient(180deg, rgba(18, 22, 70, 0.86), rgba(6, 8, 28, 0.94)) !important; border-color: rgba(122, 136, 245, 0.92) !important;";
  }

  if (type === "lethal") {
    return "background: radial-gradient(circle at 14% 10%, rgba(112, 72, 220, 0.32), transparent 50%), linear-gradient(180deg, rgba(34, 22, 88, 0.94), rgba(9, 7, 34, 0.98)) !important; border-color: rgba(154, 130, 255, 0.98) !important;";
  }

  if (type === "aggravated") {
    return "background: radial-gradient(circle at 14% 10%, rgba(178, 188, 255, 0.30), transparent 52%), linear-gradient(180deg, rgba(18, 22, 104, 0.98), rgba(4, 5, 26, 1)) !important; border-color: rgba(196, 204, 255, 1) !important; box-shadow: 0 0 14px rgba(122, 136, 245, 0.24) !important;";
  }

  if (type === "out") {
    return "background: radial-gradient(circle at 14% 10%, rgba(80, 90, 210, 0.34), transparent 52%), linear-gradient(180deg, rgba(12, 16, 74, 1), rgba(2, 3, 16, 1)) !important; border-color: rgba(170, 180, 255, 1) !important; box-shadow: 0 0 16px rgba(112, 128, 255, 0.30) !important;";
  }

  return "background: linear-gradient(180deg, rgba(8, 10, 28, 0.82), rgba(2, 3, 12, 0.94)) !important; border-color: rgba(76, 86, 172, 0.70) !important; box-shadow: none !important;";
}

export class DemonActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    id: "vtm-revised-demon-sheet-{id}",
    classes: ["vtm-revised", "sheet", "actor", "demon"],
    position: {
      width: 1460,
      height: 980
    },
    window: {
      resizable: true
    },
    form: {
      submitOnChange: true,
      closeOnSubmit: false,
      handler: DemonActorSheet._onSubmitForm
    }
  };

  static PARTS = {
    sheet: {
      template: "systems/vtm-revised/templates/actors/demon-sheet.hbs",
      templates: DEMON_TEMPLATE_PARTIALS,
      scrollable: [".demon-sheet-body"]
    }
  };

  get actor() {
    return this.document;
  }

  get title() {
    return this.actor?.name ?? game.i18n.localize("TYPES.Actor.demon");
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.actor;
    const system = actor.system ?? {};
    const items = Array.from(actor.items ?? []);
    const traitMax = Math.max(5, Number(system.resources?.traitMax || 5));
    const selectedNature = this._resolveArchetype(system.profile?.nature);
    const selectedDemeanor = this._resolveArchetype(system.profile?.demeanor);

    const resourceCards = [
      {
        key: "faith",
        label: "Вера",
        value: numberValue(system.resources?.faith?.value, 0),
        max: numberValue(system.resources?.faith?.max, 10),
        valuePath: "system.resources.faith.value",
        maxPath: "system.resources.faith.max"
      },
      {
        key: "willpower",
        label: "Сила Воли",
        value: numberValue(system.resources?.willpower?.value, 0),
        max: numberValue(system.resources?.willpower?.max, 10),
        valuePath: "system.resources.willpower.value",
        maxPath: "system.resources.willpower.max"
      }
    ];

    for (const card of resourceCards) {
      const pipCount = Math.max(0, Math.min(20, Math.trunc(card.max)));
      card.pips = Array.from({ length: pipCount }, (_, index) => index + 1);
    }
    const tormentScales = [
      {
        key: "permanent",
        label: "Постоянная Мука",
        value: numberValue(system.resources?.torment?.max, 0),
        valuePath: "system.resources.torment.max",
        pips: Array.from({ length: 10 }, (_, index) => index + 1)
      },
      {
        key: "temporary",
        label: "Временная Мука",
        value: numberValue(system.resources?.torment?.value, 0),
        valuePath: "system.resources.torment.value",
        pips: Array.from({ length: 10 }, (_, index) => index + 1)
      }
    ];

    const attributeGroupsView = buildTraitGroups(system, VTM_REVISED.attributeCategories, ATTRIBUTE_LABELS, "attributes");
    const abilityGroupsView = buildTraitGroups(system, VTM_REVISED.abilityCategories, ABILITY_LABELS, "abilities", { named: true });
    const loreRows = buildLoreRows(system);
    const virtueRows = buildVirtueRows(system);
    const backgroundRows = buildBackgroundRows(system);
    const suggestedWillpower = calculateSuggestedWillpower(system);
    const healthRows = this._buildHealthRows();

    return {
      ...context,
      actor,
      document: actor,
      system,
      editable: this.isEditable,
      cssClass: "vtm-revised sheet actor demon",
      config: VTM_REVISED,
      houses: DEMON_HOUSES,
      factions: DEMON_FACTIONS,
      archetypeOptions: DEMON_ARCHETYPES,
      selectedNature,
      selectedDemeanor,
      resourceCards,
      tormentScales,
      weapons: items.filter(item => item.type === "weapon"),
      experienceJournal: this._buildExperienceJournalContext(),
      creationAudit: this._buildCreationAudit(),
      attributeGroupsView,
      abilityGroupsView,
      loreRows,
      virtueRows,
      backgroundRows,
      suggestedWillpower,
      demonRules: VTM_REVISED.demonRules,
      healthRows,
      activeHealthPenalty: this._resolveHealthPenalty(),
      traitPips: Array.from({ length: traitMax }, (_, index) => index + 1),
      lorePips: Array.from({ length: 5 }, (_, index) => index + 1),
      rollTraitOptionGroups: this._buildRollTraitOptionGroups(),
      activeSheetTab: this._activeSheetTab || "main"
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const element = this.element;
    if (!element) return;

    const scrollBody = element.querySelector(".demon-sheet-body");
    if (scrollBody) {
      const restoreScroll = () => {
        if (Number.isFinite(this._sheetScrollTop)) scrollBody.scrollTop = this._sheetScrollTop;
      };
      requestAnimationFrame(restoreScroll);
      scrollBody.addEventListener("scroll", () => {
        this._sheetScrollTop = scrollBody.scrollTop;
      }, { passive: true });
    }

    this._restoreRollNativePanel(element);
    this._enhanceDemonSelects(element);
    this._injectDemonCatalogControls(element);

    element.querySelectorAll(".trait-value-input").forEach(input => {
      input.addEventListener("change", async event => {
        event.preventDefault();
        event.stopPropagation();

        const fieldName = input.getAttribute("name");
        if (!fieldName?.startsWith("system.")) return;

        const value = Number(input.value || 0);
        if (!Number.isFinite(value)) return;

        await this.actor.update({ [fieldName]: value }, { render: false });

        this._restoreRollNativePanel(element);
        this._enhanceDemonSelects(element.querySelector(".demon-roll-panel"));
      });
    });

    element.querySelectorAll(".demon-sync-willpower").forEach(button => {
      button.addEventListener("click", async event => {
        event.preventDefault();
        const suggested = calculateSuggestedWillpower(this.actor.system ?? {});
        await this.actor.update({
          "system.resources.willpower.max": suggested,
          "system.resources.willpower.value": suggested
        });
        ui.notifications?.info?.(`Сила Воли синхронизирована по Добродетелям: ${suggested}`);
      });
    });

    try {
      const current = this.position ?? {};
      const width = Number(current.width || element.closest(".application")?.offsetWidth || 0);
      const height = Number(current.height || element.closest(".application")?.offsetHeight || 0);

      if (width < 1180 || height < 760) {
        this.setPosition({
          width: Math.max(width || 0, 1460),
          height: Math.max(height || 0, 980)
        });
      }
    } catch (err) {
      console.debug("Demon | Sheet size guard skipped", err);
    }

    const applyActiveTab = (tab, { scroll = false } = {}) => {
      const safeTab = ["main", "advantages", "form", "profile"].includes(tab) ? tab : "main";
      this._activeSheetTab = safeTab;

      element.querySelectorAll("[data-demon-tab]").forEach(button => {
        button.classList.toggle("is-active", button.dataset.demonTab === safeTab);
      });

      element.querySelectorAll("[data-demon-tab-panel]").forEach(panel => {
        panel.classList.toggle("is-active", panel.dataset.demonTabPanel === safeTab);
      });

      if (scroll) {
        const tabScrollBody = element.querySelector(".demon-sheet-body");
        if (tabScrollBody) {
          tabScrollBody.scrollTop = 0;
          this._sheetScrollTop = 0;
        }
      }
    };

    applyActiveTab(this._activeSheetTab || context?.activeSheetTab || "main");

    element.querySelectorAll("[data-demon-tab]").forEach(button => {
      button.addEventListener("click", event => {
        event.preventDefault();
        applyActiveTab(button.dataset.demonTab, { scroll: true });
      });
    });

    element.querySelectorAll(".trait-value-input").forEach(input => {
      const updatePips = () => {
        const row = input.closest(".demon-trait-row, .demon-lore-row");
        if (!row) return;

        const value = Number(input.value || 0);
        row.querySelectorAll(".demon-pips i").forEach((pip, index) => {
          pip.classList.toggle("is-filled", index < value);
        });
      };

      input.addEventListener("input", updatePips);
      input.addEventListener("change", updatePips);
      updatePips();
    });

    element.querySelectorAll(".demon-resource-card").forEach(card => {
      const inputs = card.querySelectorAll(".demon-resource-counter input");
      const valueInput = inputs[0];
      const maxInput = inputs[1];
      const pips = card.querySelector(".demon-resource-pips");
      if (!valueInput || !maxInput || !pips) return;

      const updateResourcePips = () => {
        const max = Math.max(0, Math.min(20, Math.trunc(Number(maxInput.value || 0))));
        const value = Math.max(0, Math.min(max, Number(valueInput.value || 0)));

        while (pips.children.length < max) pips.append(document.createElement("i"));
        while (pips.children.length > max) pips.lastElementChild?.remove();

        [...pips.children].forEach((pip, index) => {
          pip.classList.toggle("is-filled", index < value);
        });

        pips.title = `${card.querySelector("h3")?.textContent?.trim() || "Ресурс"}: ${value}/${max}`;
      };

      valueInput.addEventListener("input", updateResourcePips);
      valueInput.addEventListener("change", updateResourcePips);
      maxInput.addEventListener("input", updateResourcePips);
      maxInput.addEventListener("change", updateResourcePips);
      updateResourcePips();
    });

    element.querySelectorAll(".actor-portrait-view").forEach(image => {
      const openPortrait = async event => {
        event.preventDefault();
        await this._openActorPortraitViewer();
      };
      image.addEventListener("click", openPortrait);
      image.addEventListener("keydown", async event => {
        if (event.key !== "Enter" && event.key !== " ") return;
        await openPortrait(event);
      });
    });

    if (!this.isEditable) return;

    element.querySelectorAll(".actor-portrait-edit").forEach(button => {
      button.addEventListener("click", async event => {
        event.preventDefault();
        await this._openActorPortraitPicker();
      });
    });

    element.querySelectorAll(".actor-portrait-reset").forEach(button => {
      button.addEventListener("click", async event => {
        event.preventDefault();
        await this._setActorPortrait("icons/svg/mystery-man.svg", { notify: true });
      });
    });

    element.querySelectorAll(".actor-portrait-sync-token").forEach(button => {
      button.addEventListener("click", async event => {
        event.preventDefault();
        await this._syncPrototypeTokenImage();
      });
    });

    element.querySelectorAll(".resource-change").forEach(button => {
      button.addEventListener("click", async event => {
        event.preventDefault();
        const resource = button.dataset.resource;
        const delta = Number(button.dataset.delta || 0);
        await this.actor.changeResource(resource, delta, button.dataset.reason || "");
      });
    });

    element.querySelectorAll(".resource-path-change").forEach(button => {
      button.addEventListener("click", async event => {
        event.preventDefault();
        const path = button.dataset.resourcePath;
        if (!path?.startsWith("system.")) return;
        const input = element.querySelector(`[name="${path}"]`);
        const current = Number(input?.value ?? foundry.utils.getProperty(this.actor, path) ?? 0);
        const next = Math.max(0, Math.min(10, current + Number(button.dataset.delta || 0)));
        await this.actor.update({ [path]: next });
      });
    });

    element.querySelectorAll(".health-row[data-health]").forEach(row => {
      row.addEventListener("click", async event => {
        event.preventDefault();

        const key = row.dataset.health;
        if (!key) return;

        const current = Number(this.actor.system?.health?.[key] || 0);
        const isIncapacitated = key === "incapacitated";
        const safeCurrent = isIncapacitated
          ? (current > 0 ? 1 : 0)
          : (Number.isFinite(current) ? Math.max(0, Math.min(3, Math.trunc(current))) : 0);

        const next = isIncapacitated
          ? (safeCurrent > 0 ? 0 : 1)
          : (safeCurrent >= 3 ? 0 : safeCurrent + 1);

        await this.actor.update({ [`system.health.${key}`]: next });
      });
    });

    element.querySelectorAll(".vtm-roll").forEach(button => {
      button.addEventListener("click", async event => {
        event.preventDefault();
        await this._openRollDialog({
          firstTrait: button.dataset.firstTrait || button.dataset.trait || "",
          label: button.dataset.label || button.title || "Бросок"
        });
      });
    });

    const rollBuilder = element.querySelector(".vtm-roll-builder");
    rollBuilder?.querySelector(".vtm-roll-builder-submit")?.addEventListener("click", async event => {
      event.preventDefault();
      await this._openRollDialog({
        firstTrait: rollBuilder.querySelector("[name='firstTrait'], [data-roll-field='firstTrait']")?.value || "",
        secondTrait: rollBuilder.querySelector("[name='secondTrait'], [data-roll-field='secondTrait']")?.value || "",
        difficulty: Number(rollBuilder.querySelector("[name='difficulty'], [data-roll-field='difficulty']")?.value || 6),
        label: rollBuilder.querySelector("[name='rollLabel'], [data-roll-field='label']")?.value || "Бросок"
      });
    });


    element.querySelectorAll(".archetype-card-open").forEach(button => {
      button.addEventListener("click", async event => {
        event.preventDefault();
        const kind = button.dataset.kind || "nature";
        const field = kind === "demeanor" ? "demeanor" : "nature";
        const liveValue = element.querySelector(`[name="system.profile.${field}"]`)?.value || "";
        await this._openArchetypeCard(kind, liveValue);
      });
    });

    const experienceForm = element.querySelector(".experience-journal-form");
    experienceForm?.querySelector(".experience-journal-add")?.addEventListener("click", async event => {
      event.preventDefault();
      await this._addExperienceJournalEntry(experienceForm);
    });

    element.querySelectorAll(".experience-entry-delete").forEach(button => {
      button.addEventListener("click", async event => {
        event.preventDefault();
        await this._deleteExperienceJournalEntry(button.dataset.entryId || "");
      });
    });

    element.querySelectorAll(".experience-journal-recalc").forEach(button => {
      button.addEventListener("click", async event => {
        event.preventDefault();
        await this._recalculateExperienceFromJournal();
      });
    });

    element.querySelectorAll(".demon-creation-wizard-open").forEach(button => {
      button.addEventListener("click", async event => {
        event.preventDefault();
        await this._openCreationWizard();
      });
    });

    element.querySelectorAll(".demon-rated-feature-add").forEach(button => {
      button.addEventListener("click", async event => {
        event.preventDefault();
        await this._openRatedFeaturePicker(button.dataset.catalog || "");
      });
    });

    element.querySelectorAll(".demon-rated-feature-remove").forEach(button => {
      button.addEventListener("click", async event => {
        event.preventDefault();
        const path = button.dataset.path || "";
        if (path.startsWith("system.")) await this.actor.update({ [path]: 0 });
      });
    });

    element.querySelectorAll(".demon-background-row > .demon-catalog-open, .demon-lore-row > .demon-catalog-open").forEach(button => {
      button.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        this._openDemonCatalogCard(button.dataset.catalog || "", button.dataset.key || "");
      });
    });

    element.querySelectorAll(".item-create").forEach(button => {
      button.addEventListener("click", async event => {
        event.preventDefault();
        const type = button.dataset.type;
        if (!type) return;
        const name = game.i18n.localize(`TYPES.Item.${type}`) || type;
        await this.actor.createEmbeddedDocuments("Item", [{ name, type }]);
      });
    });

    element.querySelectorAll(".catalog-item-add, .weapon-add-from-catalog").forEach(button => {
      button.addEventListener("click", async event => {
        event.preventDefault();
        await this._openCatalogItemDialog(button.dataset.type || (button.classList.contains("weapon-add-from-catalog") ? "weapon" : ""));
      });
    });

    element.querySelectorAll(".item-edit").forEach(button => {
      button.addEventListener("click", event => {
        event.preventDefault();
        const row = button.closest("[data-item-id]");
        const item = row ? this.actor.items.get(row.dataset.itemId) : null;
        item?.sheet?.render(true);
      });
    });

    element.querySelectorAll(".item-delete").forEach(button => {
      button.addEventListener("click", async event => {
        event.preventDefault();
        const row = button.closest("[data-item-id]");
        if (row?.dataset.itemId) await this.actor.deleteEmbeddedDocuments("Item", [row.dataset.itemId]);
      });
    });

    element.querySelectorAll(".item-use").forEach(button => {
      button.addEventListener("click", async event => {
        event.preventDefault();
        const row = button.closest("[data-item-id]");
        const item = row ? this.actor.items.get(row.dataset.itemId) : null;
        if (item?.type === "weapon") {
          await this._useWeapon(item);
        } else {
          item?.sheet?.render(true);
        }
      });
    });

    element.querySelectorAll(".weapon-attack").forEach(button => {
      button.addEventListener("click", async event => {
        event.preventDefault();
        const row = button.closest("[data-item-id]");
        const item = row ? this.actor.items.get(row.dataset.itemId) : null;
        if (item?.type === "weapon") await this._useWeapon(item);
      });
    });
  }

  _experienceJournalEntries() {
    return Array.isArray(this.actor.system?.resources?.experience?.journal)
      ? Array.from(this.actor.system.resources.experience.journal)
      : [];
  }

  _buildCreationAudit() {
    const system = this.actor.system ?? {};
    const sum = values => values.reduce((total, value) => total + Number(value || 0), 0);
    const attributeGroups = Object.fromEntries(Object.entries(system.attributes ?? {}).map(([key, values]) => [key, sum(Object.values(values ?? {}))]));
    const abilityGroups = Object.fromEntries(Object.entries(system.abilities ?? {}).map(([key, values]) => [
      key,
      sum(Object.values(values ?? {}).map(value => typeof value === "object" ? value?.value : value))
    ]));
    const virtues = sum(Object.values(system.virtues ?? {}));
    const backgrounds = sum(Object.values(system.backgrounds ?? {}).map(value => value?.value));
    const expectedAttributes = [10, 8, 6];
    const expectedAbilities = [13, 9, 5];
    const attributeTotals = Object.values(attributeGroups).sort((a, b) => b - a);
    const abilityTotals = Object.values(abilityGroups).sort((a, b) => b - a);
    const checks = [
      { key: "attributes", label: game.i18n.localize("VTM_REVISED.Demon.Creation.Attributes"), actual: attributeTotals.join(" / "), expected: expectedAttributes.join(" / "), ok: expectedAttributes.every((value, index) => attributeTotals[index] === value) },
      { key: "abilities", label: game.i18n.localize("VTM_REVISED.Demon.Creation.Abilities"), actual: abilityTotals.join(" / "), expected: expectedAbilities.join(" / "), ok: expectedAbilities.every((value, index) => abilityTotals[index] === value) },
      { key: "virtues", label: game.i18n.localize("VTM_REVISED.Demon.Creation.Virtues"), actual: virtues, expected: 6, ok: virtues === 6 },
      { key: "backgrounds", label: game.i18n.localize("VTM_REVISED.Demon.Creation.Backgrounds"), actual: backgrounds, expected: 5, ok: backgrounds === 5 }
    ];
    return { checks, valid: checks.every(check => check.ok), freebiePool: Number(system.creation?.freebiePool ?? 15) };
  }

  async _openCreationWizard() {
    return new VTMDemonCharacterCreationWizard({ actor: this.actor }).render({ force: true });
  }

  _formatExperienceDate(value = "") {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat(game.i18n?.lang || undefined, {
      dateStyle: "short",
      timeStyle: "short"
    }).format(date);
  }

  _experienceTypeLabel(type = "award") {
    const key = type === "spend" ? "TypeSpend" : type === "adjust" ? "TypeAdjust" : "TypeAward";
    return game.i18n.localize(`VTM_REVISED.Experience.${key}`);
  }

  _buildExperienceJournalContext() {
    const xp = this.actor.system?.resources?.experience ?? {};
    const entries = this._experienceJournalEntries().map((entry, index) => {
      const delta = Number(entry.delta ?? 0);
      const type = entry.type || (delta < 0 ? "spend" : "award");
      return {
        ...entry,
        id: entry.id || String(index),
        type,
        typeLabel: this._experienceTypeLabel(type),
        dateLabel: this._formatExperienceDate(entry.createdAt),
        signedDelta: delta > 0 ? `+${delta}` : String(delta),
        positive: delta >= 0,
        reason: String(entry.reason || "").trim() || game.i18n.localize("VTM_REVISED.Experience.NoReason"),
        target: String(entry.target || "").trim(),
        userName: String(entry.userName || "").trim()
      };
    }).sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

    return {
      available: Number(xp.available || 0),
      total: Number(xp.total || 0),
      spent: Number(xp.spent || 0),
      entries
    };
  }

  async _addExperienceJournalEntry(form) {
    const type = form.querySelector("[data-xp-field='type']")?.value || "award";
    const rawAmount = Number(form.querySelector("[data-xp-field='amount']")?.value ?? 0);
    const reason = String(form.querySelector("[data-xp-field='reason']")?.value ?? "").trim();
    const target = String(form.querySelector("[data-xp-field='target']")?.value ?? "").trim();
    if (!Number.isFinite(rawAmount) || rawAmount === 0) {
      ui.notifications?.warn?.(game.i18n.localize("VTM_REVISED.Experience.AmountRequired"));
      return null;
    }

    const amount = Math.trunc(Math.abs(rawAmount));
    const delta = type === "spend" ? -amount : type === "adjust" ? Math.trunc(rawAmount) : amount;
    const xp = this.actor.system?.resources?.experience ?? {};
    const available = Number(xp.available || 0);
    if (type === "spend" && available + delta < 0) {
      ui.notifications?.warn?.(game.i18n.localize("VTM_REVISED.Experience.NotEnoughExperience"));
      return null;
    }

    const entry = {
      id: foundry.utils?.randomID?.(16) || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type, amount, delta, reason, target,
      createdAt: new Date().toISOString(),
      userId: game.user?.id || "",
      userName: game.user?.name || ""
    };
    const update = {
      "system.resources.experience.journal": [...this._experienceJournalEntries(), entry],
      "system.resources.experience.available": Math.max(0, available + delta)
    };
    if (type === "award") update["system.resources.experience.total"] = Math.max(0, Number(xp.total || 0) + amount);
    if (type === "spend") update["system.resources.experience.spent"] = Math.max(0, Number(xp.spent || 0) + amount);
    await this.actor.update(update);
    ui.notifications?.info?.(game.i18n.format("VTM_REVISED.Experience.EntryAdded", { delta: delta > 0 ? `+${delta}` : String(delta) }));
    return entry;
  }

  async _deleteExperienceJournalEntry(entryId = "") {
    const xp = this.actor.system?.resources?.experience ?? {};
    const journal = this._experienceJournalEntries();
    const entry = journal.find(item => String(item.id) === String(entryId));
    if (!entry) return null;
    const type = entry.type || (Number(entry.delta || 0) < 0 ? "spend" : "award");
    const amount = Math.abs(Number(entry.amount ?? entry.delta ?? 0));
    const delta = Number(entry.delta || 0);
    const update = {
      "system.resources.experience.journal": journal.filter(item => String(item.id) !== String(entryId)),
      "system.resources.experience.available": Math.max(0, Number(xp.available || 0) - delta)
    };
    if (type === "award") update["system.resources.experience.total"] = Math.max(0, Number(xp.total || 0) - amount);
    if (type === "spend") update["system.resources.experience.spent"] = Math.max(0, Number(xp.spent || 0) - amount);
    await this.actor.update(update);
    return entry;
  }

  async _recalculateExperienceFromJournal() {
    const entries = this._experienceJournalEntries();
    const total = entries.filter(entry => entry.type === "award").reduce((sum, entry) => sum + Math.abs(Number(entry.amount ?? entry.delta ?? 0)), 0);
    const spent = entries.filter(entry => entry.type === "spend").reduce((sum, entry) => sum + Math.abs(Number(entry.amount ?? entry.delta ?? 0)), 0);
    const adjustments = entries.filter(entry => entry.type === "adjust").reduce((sum, entry) => sum + Number(entry.delta || 0), 0);
    const available = Math.max(0, total - spent + adjustments);
    await this.actor.update({
      "system.resources.experience.total": total,
      "system.resources.experience.spent": spent,
      "system.resources.experience.available": available
    });
    return { total, spent, available };
  }

  _damageTypeLabel(type = "") {
    return (VTM_REVISED.damageTypes ?? []).find(entry => entry.key === type)?.name || type;
  }

  _normalizeItemName(value = "") {
    return String(value ?? "").trim().toLocaleLowerCase(game.i18n?.lang || undefined).replaceAll("ё", "е");
  }

  async _openCatalogItemDialog(type = "") {
    if (!type) return null;
    const known = new Set(Array.from(this.actor.items ?? []).filter(item => item.type === type).map(item => this._normalizeItemName(item.name)));
    const candidates = Array.from(game.items ?? []).filter(item => item.type === type && !known.has(this._normalizeItemName(item.name)));
    if (!candidates.length) {
      ui.notifications?.warn?.(game.i18n.localize("VTM_REVISED.Demon.Inventory.NoCatalogItems"));
      return null;
    }
    const options = candidates.sort((a, b) => a.name.localeCompare(b.name)).map(item => `<option value="${foundry.utils.escapeHTML(item.id)}">${foundry.utils.escapeHTML(item.name)}</option>`).join("");
    const content = `<form class="demon-catalog-item-dialog vtm-searchable-dialog"><label>${game.i18n.localize(`TYPES.Item.${type}`)}<select name="itemId" data-vtm-searchable="true">${options}</select></label></form>`;
    return new Promise(resolve => new DialogV1({
      title: game.i18n.localize("VTM_REVISED.Demon.Inventory.AddFromCatalog"),
      content,
      buttons: {
        add: {
          icon: '<i class="fas fa-plus"></i>',
          label: game.i18n.localize("Add"),
          callback: async html => {
            const itemId = this._getFormElement(html)?.querySelector("[name='itemId']")?.value;
            const source = itemId ? game.items.get(itemId) : null;
            if (source) {
              const data = source.toObject();
              delete data._id;
              await this.actor.createEmbeddedDocuments("Item", [data]);
            }
            resolve(source);
          }
        },
        cancel: { label: game.i18n.localize("Cancel"), callback: () => resolve(null) }
      },
      default: "add",
      close: () => resolve(null)
    }, { width: 520, classes: ["demon-reference-dialog-window"] }).render(true));
  }

  async _useWeapon(item) {
    const weapon = item.system?.weapon ?? {};
    const first = this._resolveTraitOption(weapon.attackFirstTrait || "attribute.physical.dexterity");
    const second = this._resolveTraitOption(
      weapon.attackSecondTrait || (weapon.category === "firearm" ? "ability.skills.firearms" : "ability.skills.melee")
    );
    if (!first) return null;

    const healthPenalty = this._resolveHealthPenalty();
    if (healthPenalty.incapacitated) {
      ui.notifications?.warn?.(game.i18n.localize("VTM_REVISED.Roll.HealthBlocked"));
      return null;
    }

    const components = [first, second].filter(Boolean);
    const basePool = Math.max(1, components.reduce((sum, component) => sum + Number(component.value || 0), 0));
    const attackResult = await rollDicePool({
      actor: this.actor,
      pool: Math.max(1, basePool + healthPenalty.value),
      basePool,
      healthPenalty: healthPenalty.value,
      healthPenaltyLabel: healthPenalty.label,
      difficulty: Number(weapon.difficulty || 6),
      label: game.i18n.format("VTM_REVISED.Weapon.AttackLabel", { name: item.name }),
      components
    });

    if (attackResult.botch || attackResult.successes <= 0) return attackResult;

    const extraSuccesses = weapon.addsAttackSuccesses === false ? 0 : Math.max(0, Number(attackResult.successes || 0) - 1);
    const strength = numberValue(this.actor.system?.attributes?.physical?.strength, 0);
    const baseDamage = weapon.usesStrength ? strength + Number(weapon.damageBonus || 0) : Number(weapon.damageDice || 0);
    const selectedMerits = this.actor.getFlag?.("vtm-revised", "demonSelections")?.merits ?? [];
    const goodRightHookAvailable = second?.key === "ability.talents.brawl"
      && selectedMerits.includes("good-right-hook")
      && !this.actor.system?.apocalypticForm?.active;
    let goodRightHookDice = 0;
    if (goodRightHookAvailable) {
      goodRightHookDice = await new Promise(resolve => new DialogV1({
        title: "Модификаторы урона",
        content: `<form class="demon-roll-dialog"><label class="demon-roll-effect-option"><input type="checkbox" name="goodRightHook" checked><span><b>Хороший хук справа</b> <strong>+2 куб.</strong><small>Только к урону атаки, основанной на Драке.</small></span></label></form>`,
        buttons: {
          apply: { label: "Продолжить", callback: html => resolve(this._getFormElement(html)?.querySelector("[name='goodRightHook']")?.checked ? 2 : 0) },
          cancel: { label: "Без модификатора", callback: () => resolve(0) }
        },
        default: "apply",
        close: () => resolve(0)
      }, { width: 520, classes: ["demon-reference-dialog-window"] }).render(true));
    }
    const damagePool = Math.max(1, baseDamage + extraSuccesses + goodRightHookDice);
    const damageTypeLabel = this._damageTypeLabel(weapon.damageType);
    const damageResult = await rollDicePool({
      actor: this.actor,
      pool: damagePool,
      basePool: damagePool,
      healthPenalty: 0,
      difficulty: Number(weapon.damageDifficulty || 6),
      label: game.i18n.format("VTM_REVISED.Weapon.DamageLabel", { name: item.name }),
      flavor: game.i18n.format("VTM_REVISED.Weapon.DamageFlavor", { type: damageTypeLabel }),
      components: [
        { label: game.i18n.localize("VTM_REVISED.Weapon.BaseDamage"), value: baseDamage },
        { label: game.i18n.localize("VTM_REVISED.Weapon.ExtraAttackSuccesses"), value: extraSuccesses },
        ...(goodRightHookDice ? [{ label: "Хороший хук справа", value: "+2 куб." }] : [])
      ]
    });
    return { attackResult, damageResult };
  }

  _buildHealthRows() {
    return VTM_REVISED.healthLevels.map(key => {
      const penalty = VTM_REVISED.healthPenalties[key] ?? "";
      const rawDamageState = Number(this.actor.system?.health?.[key] || 0);
      const isIncapacitated = key === "incapacitated";
      const damageState = isIncapacitated
        ? (rawDamageState > 0 ? 1 : 0)
        : Math.max(0, Math.min(3, Number.isFinite(rawDamageState) ? Math.trunc(rawDamageState) : 0));

      const damageType = isIncapacitated
        ? (damageState > 0 ? "out" : "none")
        : (HEALTH_DAMAGE_TYPES[damageState] || "none");

      const damageLabel = isIncapacitated
        ? (damageState > 0 ? "Недееспособен" : HEALTH_DAMAGE_LABELS[0])
        : (HEALTH_DAMAGE_LABELS[damageState] || HEALTH_DAMAGE_LABELS[0]);

      const penaltyLabel = penalty === "out" ? "недееспособен" : `${penalty} куб.`;

      return {
        key,
        label: HEALTH_LABELS[key] || key,
        penalty,
        penaltyLabel,
        damageState,
        damageType,
        damageLabel,
        damageTitle: `${damageLabel}. Нажми, чтобы изменить тип урона.`,
        damageStyle: healthDamageStyle(damageType),
        showDamageLabel: !isIncapacitated && damageState > 0,
        checked: damageState > 0
      };
    });
  }

  _resolveHealthPenalty() {
    const rows = this._buildHealthRows();
    const active = rows.filter(row => row.checked).at(-1);

    if (!active) {
      return {
        key: "",
        label: "Без ранений",
        summary: "Без ранений: 0 куб.",
        value: 0,
        incapacitated: false
      };
    }

    if (active.key === "incapacitated") {
      return {
        key: active.key,
        label: active.label,
        summary: "Недееспособен: броски невозможны.",
        value: -999,
        incapacitated: true
      };
    }

    const selectedFlaws = this.actor.getFlag?.("vtm-revised", "demonSelections")?.flaws ?? [];
    const elderlyPenalty = selectedFlaws.includes("elderly") && !this.actor.system?.apocalypticForm?.active ? -1 : 0;
    const value = Number(active.penalty || 0) + elderlyPenalty;
    const penaltyLabel = elderlyPenalty ? `${active.penaltyLabel} − 1 (Пожилой)` : active.penaltyLabel;
    return {
      key: active.key,
      label: `${active.label}: ${penaltyLabel}`,
      summary: `${active.label}: ${penaltyLabel}`,
      value: Number.isFinite(value) ? value : 0,
      incapacitated: false
    };
  }





  _injectDemonCatalogControls(root = this.element) {
    if (!root?.querySelector) return;

    const addButtonAfter = (anchor, catalog, keyGetter, title) => {
      if (!anchor) return;
      const parent = anchor.parentElement;
      if (!parent) return;
      if (parent.querySelector(`.demon-catalog-open[data-catalog="${catalog}"]`)) return;

      const button = document.createElement("button");
      button.type = "button";
      button.className = "demon-catalog-open demon-field-card-button";
      button.dataset.catalog = catalog;
      button.title = title;
      button.innerHTML = '<i class="fas fa-book-open"></i>';
      button.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        const key = keyGetter();
        this._openDemonCatalogCard(catalog, key);
      });

      parent.appendChild(button);
    };

    const houseSelect = root.querySelector('[name="system.profile.house"]');
    const factionSelect = root.querySelector('[name="system.profile.faction"]');

    addButtonAfter(
      houseSelect?.closest(".vtm-trait-search-select, .vtm-dialog-search-select") ?? houseSelect,
      "houses",
      () => root.querySelector('[name="system.profile.house"]')?.value || this.actor.system?.profile?.house || "",
      "Открыть справочник Дома"
    );

    addButtonAfter(
      factionSelect?.closest(".vtm-trait-search-select, .vtm-dialog-search-select") ?? factionSelect,
      "factions",
      () => root.querySelector('[name="system.profile.faction"]')?.value || this.actor.system?.profile?.faction || "",
      "Открыть справочник Фракции"
    );

    root.querySelectorAll('.vtm-roll[data-first-trait^="lore."], .vtm-roll[data-trait^="lore."]').forEach(button => {
      const row = button.closest(".demon-trait-row, .demon-lore-row, .demon-background-row") ?? button.parentElement;
      if (!row || row.querySelector('.demon-catalog-open[data-catalog="lores"]')) return;

      const rollKey = button.dataset.firstTrait || button.dataset.trait || "";
      const loreKey = String(rollKey).replace(/^lore\./, "");

      const loreButton = document.createElement("button");
      loreButton.type = "button";
      loreButton.className = "demon-catalog-open demon-mini-card-button";
      loreButton.dataset.catalog = "lores";
      loreButton.dataset.key = loreKey;
      loreButton.title = "Открыть справочник Знания";
      loreButton.innerHTML = '<i class="fas fa-book-open"></i>';
      loreButton.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        this._openDemonCatalogCard("lores", loreKey);
      });

      row.appendChild(loreButton);
    });

    this._injectMeritsFlawsCatalog(root);
  }

  _injectMeritsFlawsCatalog(root = this.element) {
    const panel = root?.querySelector?.('[data-demon-tab-panel="advantages"]');
    if (!panel || panel.querySelector(".demon-merits-catalog-panel")) return;

    const selections = this.actor.getFlag?.("vtm-revised", "demonSelections") ?? {};
    const renderSelectedRows = catalog => {
      const selectedKeys = Array.isArray(selections[catalog]) ? selections[catalog] : [];
      const entries = selectedKeys.map(key => (DEMON_CATALOGS[catalog] ?? []).find(entry => entry.key === key)).filter(Boolean);
      if (!entries.length) return `<p class="demon-selected-catalog-empty">${game.i18n.localize("VTM_REVISED.Demon.Features.Empty")}</p>`;
      return entries.map(entry => `
        <article class="demon-selected-catalog-row" data-catalog="${catalog}" data-key="${foundry.utils.escapeHTML(entry.key)}">
          <span>${foundry.utils.escapeHTML(entry.label)}</span>
          <button type="button" class="demon-catalog-open demon-mini-card-button" title="${game.i18n.localize("VTM_REVISED.Demon.Features.OpenCard")}"><i class="fas fa-book-open"></i></button>
          <button type="button" class="demon-catalog-remove demon-mini-card-button" title="${game.i18n.localize("VTM_REVISED.Demon.Features.Remove")}"><i class="fas fa-trash"></i></button>
        </article>
      `).join("");
    };

    const wrapper = document.createElement("div");
    wrapper.className = "demon-catalog-panels";
    wrapper.innerHTML = `
      <section class="demon-panel demon-merits-catalog-panel">
        <div class="demon-section-title">
          <span><i class="fas fa-star"></i></span>
          <h2>${game.i18n.localize("VTM_REVISED.Demon.Features.Merits")}</h2>
          <button type="button" class="demon-catalog-add demon-mini-card-button" data-catalog="merits" title="${game.i18n.localize("VTM_REVISED.Demon.Features.Add")}"><i class="fas fa-plus"></i></button>
        </div>
        <div class="demon-selected-catalog-list">${renderSelectedRows("merits")}</div>
      </section>

      <section class="demon-panel demon-flaws-catalog-panel">
        <div class="demon-section-title">
          <span><i class="fas fa-skull"></i></span>
          <h2>${game.i18n.localize("VTM_REVISED.Demon.Features.Flaws")}</h2>
          <button type="button" class="demon-catalog-add demon-mini-card-button" data-catalog="flaws" title="${game.i18n.localize("VTM_REVISED.Demon.Features.Add")}"><i class="fas fa-plus"></i></button>
        </div>
        <div class="demon-selected-catalog-list">${renderSelectedRows("flaws")}</div>
      </section>
    `;

    wrapper.querySelectorAll(".demon-catalog-open").forEach(button => {
      button.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        const row = button.closest("[data-catalog][data-key]");
        this._openDemonCatalogCard(row?.dataset.catalog || button.dataset.catalog, row?.dataset.key || button.dataset.key);
      });
    });

    wrapper.querySelectorAll(".demon-catalog-add").forEach(button => {
      button.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        this._openDemonFeaturePicker(button.dataset.catalog);
      });
    });

    wrapper.querySelectorAll(".demon-catalog-remove").forEach(button => {
      button.addEventListener("click", async event => {
        event.preventDefault();
        event.stopPropagation();
        const row = button.closest("[data-catalog][data-key]");
        if (row) await this._removeDemonFeature(row.dataset.catalog, row.dataset.key);
      });
    });

    const weapons = panel.querySelector(".weapons-panel");
    if (weapons) weapons.before(wrapper);
    else panel.appendChild(wrapper);
  }

  async _setDemonFeatureSelection(catalog, keys) {
    const current = foundry.utils.deepClone(this.actor.getFlag?.("vtm-revised", "demonSelections") ?? {});
    current[catalog] = [...new Set(keys)].filter(key => (DEMON_CATALOGS[catalog] ?? []).some(entry => entry.key === key));
    await this.actor.setFlag("vtm-revised", "demonSelections", current);
  }

  async _chooseDemonNaturalAptitude() {
    const options = this._buildRollTraitOptions().filter(option => option.key.startsWith("ability.")).map(option =>
      `<option value="${foundry.utils.escapeHTML(option.key)}">${foundry.utils.escapeHTML(option.label)}</option>`
    ).join("");
    const content = `<form class="vtm-searchable-dialog"><label>Способность для «Природной склонности»<select name="trait" data-vtm-searchable="true">${options}</select></label></form>`;
    return new Promise(resolve => new DialogV1({ title: "Природная склонность", content, buttons: {
      save: { label: "Сохранить", callback: async html => {
        const value = this._getFormElement(html)?.querySelector("[name='trait']")?.value;
        const stored = foundry.utils.deepClone(this.actor.getFlag?.("vtm-revised", "demonSelectionOptions") ?? {});
        if (value) await this.actor.setFlag("vtm-revised", "demonSelectionOptions", { ...stored, "natural-aptitude": value });
        resolve(value || null);
      }}, cancel: { label: "Позже", callback: () => resolve(null) }
    }, default: "save", close: () => resolve(null) }, { width: 520, classes: ["demon-reference-dialog-window"] }).render(true));
  }

  async _removeDemonFeature(catalog, key) {
    const selections = this.actor.getFlag?.("vtm-revised", "demonSelections") ?? {};
    const keys = (Array.isArray(selections[catalog]) ? selections[catalog] : []).filter(selected => selected !== key);
    await this._setDemonFeatureSelection(catalog, keys);
  }

  async _openDemonFeaturePicker(catalog) {
    const selections = this.actor.getFlag?.("vtm-revised", "demonSelections") ?? {};
    const selected = new Set(Array.isArray(selections[catalog]) ? selections[catalog] : []);
    const available = (DEMON_CATALOGS[catalog] ?? []).filter(entry => !selected.has(entry.key));
    if (!available.length) {
      ui.notifications?.info?.(game.i18n.localize("VTM_REVISED.Demon.Features.AllSelected"));
      return;
    }
    const categories = new Map();
    for (const entry of available) {
      const category = entry.category || "Прочие";
      if (!categories.has(category)) categories.set(category, []);
      categories.get(category).push(entry);
    }
    const options = [...categories.entries()].map(([category, entries]) => `<optgroup label="${foundry.utils.escapeHTML(category)}">${entries.map(entry => `<option value="${foundry.utils.escapeHTML(entry.key)}">${foundry.utils.escapeHTML(entry.label)}</option>`).join("")}</optgroup>`).join("");
    const content = `<form class="demon-feature-picker vtm-searchable-dialog"><div class="demon-feature-picker-row"><select name="featureKey" data-vtm-searchable="true">${options}</select><button type="button" class="demon-feature-picker-book" title="${game.i18n.localize("VTM_REVISED.Demon.Features.OpenCard")}"><i class="fas fa-book-open"></i></button></div></form>`;
    return new Promise(resolve => new DialogV1({
      title: game.i18n.localize(catalog === "flaws" ? "VTM_REVISED.Demon.Features.AddFlaw" : "VTM_REVISED.Demon.Features.AddMerit"),
      content,
      buttons: {
        add: {
          icon: '<i class="fas fa-plus"></i>',
          label: game.i18n.localize("Add"),
          callback: async html => {
            const key = this._getFormElement(html)?.querySelector("[name='featureKey']")?.value;
            if (key) {
              await this._setDemonFeatureSelection(catalog, [...selected, key]);
              if (catalog === "merits" && key === "natural-aptitude") await this._chooseDemonNaturalAptitude();
            }
            resolve(key);
          }
        },
        cancel: { label: game.i18n.localize("Cancel"), callback: () => resolve(null) }
      },
      default: "add",
      render: html => this._bindFeaturePickerBook(html, catalog),
      close: () => resolve(null)
    }, { width: 520, classes: ["demon-reference-dialog-window"] }).render(true));
  }

  async _openRatedFeaturePicker(catalog) {
    const rows = catalog === "backgrounds"
      ? buildBackgroundRows(this.actor.system ?? {})
      : catalog === "lores" ? buildLoreRows(this.actor.system ?? {}) : [];
    const available = rows.filter(row => Number(row.value || 0) <= 0);
    if (!available.length) {
      ui.notifications?.info?.(game.i18n.localize("VTM_REVISED.Demon.Features.AllSelected"));
      return;
    }

    const options = available.map(row => `<option value="${foundry.utils.escapeHTML(row.key)}">${foundry.utils.escapeHTML(row.label)}</option>`).join("");
    const content = `<form class="demon-feature-picker vtm-searchable-dialog"><div class="demon-feature-picker-row"><select name="featureKey" data-vtm-searchable="true">${options}</select><button type="button" class="demon-feature-picker-book" title="${game.i18n.localize("VTM_REVISED.Demon.Features.OpenCard")}"><i class="fas fa-book-open"></i></button></div></form>`;
    return new Promise(resolve => new DialogV1({
      title: catalog === "backgrounds" ? "Добавить Дополнение" : "Добавить Знание",
      content,
      buttons: {
        add: {
          icon: '<i class="fas fa-plus"></i>',
          label: game.i18n.localize("Add"),
          callback: async html => {
            const key = this._getFormElement(html)?.querySelector("[name='featureKey']")?.value;
            const row = available.find(candidate => candidate.key === key);
            if (row) await this.actor.update({ [row.valuePath]: 1 });
            resolve(key || null);
          }
        },
        cancel: { label: game.i18n.localize("Cancel"), callback: () => resolve(null) }
      },
      default: "add",
      render: html => this._bindFeaturePickerBook(html, catalog),
      close: () => resolve(null)
    }, { width: 520, classes: ["demon-reference-dialog-window"] }).render(true));
  }

  _bindFeaturePickerBook(html, catalog) {
    const form = this._getFormElement(html);
    const select = form?.querySelector("[name='featureKey']");
    const button = form?.querySelector(".demon-feature-picker-book");
    if (!select || !button) return;

    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      this._openDemonCatalogCard(catalog, select.value || "");
    });
  }

  _openDemonCatalogCard(catalog, key) {
    let entry = (DEMON_CATALOGS[catalog] ?? []).find(item => item.key === key);
    if (!entry && catalog === "backgrounds") {
      const row = buildBackgroundRows(this.actor.system ?? {}).find(item => item.key === key);
      if (row) entry = { key, label: row.label, summary: row.hint };
    }
    if (!entry && catalog === "lores") {
      const row = buildLoreRows(this.actor.system ?? {}).find(item => item.key === key);
      if (row) entry = { key, label: row.label, summary: "Область сверхъестественного знания падшего. Конкретные эффекты определяются уровнем Знания и правилами выбранного Дома." };
    }

    if (!entry) {
      ui.notifications?.warn?.("Сначала выбери запись справочника.");
      return;
    }

    const escape = value => foundry.utils.escapeHTML(String(value ?? ""));
    const tags = Array.isArray(entry.tags) && entry.tags.length
      ? `<div class="demon-reference-tags">${entry.tags.map(tag => `<span>${escape(tag)}</span>`).join("")}</div>`
      : "";

    const cost = entry.cost !== undefined
      ? `<strong class="demon-reference-cost">${escape(entry.cost)} очк.</strong>`
      : "";

    const mechanics = entry.mechanics
      ? `<section><h3>Механика</h3><p>${escape(entry.mechanics)}</p></section>`
      : "";

    const powers = Array.isArray(entry.powers) && entry.powers.length
      ? `<section class="demon-reference-powers"><h3>Обращения</h3><ol>${entry.powers.map(power => `<li><div class="demon-reference-power-title"><strong>${"●".repeat(Number(power.level) || 1)}</strong> ${escape(power.name)}</div>${power.description ? `<p>${escape(power.description)}</p>` : ""}${power.system ? `<p><b>Система:</b> ${escape(power.system)}</p>` : ""}${power.torment ? `<p class="demon-reference-torment"><b>Высокая Мука:</b> ${escape(power.torment)}</p>` : ""}</li>`).join("")}</ol></section>`
      : "";

    const source = /^https:\/\/wod\.su\//.test(String(entry.sourceUrl || ""))
      ? `<footer class="demon-reference-source"><a href="${escape(entry.sourceUrl)}" target="_blank" rel="noopener">Источник: wod.su</a></footer>`
      : "";

    const content = `
      <article class="demon-reference-card">
        <header>
          <h2>${escape(entry.label)}</h2>
          ${cost}
          ${entry.subtitle ? `<em>${escape(entry.subtitle)}</em>` : ""}
        </header>

        ${tags}

        <section>
          <h3>Описание</h3>
          <p>${escape(entry.summary || "Описание пока не заполнено.")}</p>
        </section>

        ${mechanics}
        ${powers}
        ${source}
      </article>
    `;

    new DialogV1({
      title: entry.label,
      content,
      buttons: {
        close: {
          label: "Закрыть"
        }
      },
      default: "close"
    }, {
      width: 540,
      classes: ["demon-reference-dialog-window"]
    }).render(true);
  }


  _restoreRollNativePanel(root = this.element) {
    const panel = root?.querySelector?.(".demon-roll-panel");
    if (!panel) return;

    const previousFirst = panel.querySelector("[name='firstTrait']")?.value || "";
    const previousSecond = panel.querySelector("[name='secondTrait']")?.value || "";
    const previousDifficulty = panel.querySelector("[name='difficulty']")?.value || "6";
    const previousLabel = panel.querySelector("[name='rollLabel']")?.value || "";

    const escape = value => foundry.utils.escapeHTML(String(value ?? ""));
    const groups = this._buildRollTraitOptionGroups();

    const renderOptions = selected => groups.map(group => {
      const items = group.options.map(option => {
        const value = String(option.key ?? option.value ?? "");
        const label = String(option.display ?? option.label ?? value);
        const isSelected = value === String(selected || "") ? " selected" : "";
        return `<option value="${escape(value)}"${isSelected}>${escape(label)}</option>`;
      }).join("");

      return `<optgroup label="${escape(group.label)}">${items}</optgroup>`;
    }).join("");

    panel.innerHTML = `
      <div class="demon-section-title">
        <span><i class="fas fa-dice-d10"></i></span>
        <h2>Бросок</h2>
      </div>

      <div class="vtm-roll-builder demon-roll-builder demon-roll-native-wrap">
        <div class="demon-roll-native-grid">
          <label class="demon-roll-native-field">
            <span>Первый параметр</span>
            <select name="firstTrait" data-roll-field="firstTrait">
              ${renderOptions(previousFirst)}
            </select>
          </label>

          <label class="demon-roll-native-field">
            <span>Второй параметр</span>
            <select name="secondTrait" data-roll-field="secondTrait">
              <option value="">Без второго параметра</option>
              ${renderOptions(previousSecond)}
            </select>
          </label>

          <label class="demon-roll-native-field demon-roll-difficulty-field">
            <span>Сложность</span>
            <input type="number" name="difficulty" data-roll-field="difficulty" value="${escape(previousDifficulty)}" min="2" max="10">
          </label>

          <label class="demon-roll-native-field">
            <span>Название броска</span>
            <input type="text" name="rollLabel" data-roll-field="label" value="${escape(previousLabel)}" placeholder="Например: Сила + Атлетика">
          </label>

          <button type="button" class="vtm-roll-builder-submit demon-roll-native-submit">
            <i class="fas fa-dice-d10"></i>
            Бросить
          </button>
        </div>
      </div>
    `;
  }

  _enhanceDemonSelects(root = this.element) {
    if (!root?.querySelectorAll) return;
    root.querySelectorAll("select").forEach(select => {
      select.dataset.vtmSearchableSelect = "true";
      select.classList.add("vtm-sheet-search-select");
    });
    enhanceActorRollSearchSelects(root);
  }


  _getLiveSystemNumber(systemPath, fallback = 0) {
    const path = String(systemPath || "").replace(/^system\./, "");
    if (!path) return Number(fallback || 0);

    const input = this.element?.querySelector?.(`[name="system.${path}"]`);
    const liveValue = input?.value;

    if (liveValue !== undefined && liveValue !== null && liveValue !== "") {
      const liveNumber = Number(liveValue);
      if (Number.isFinite(liveNumber)) return liveNumber;
    }

    const storedNumber = Number(foundry.utils.getProperty(this.actor.system ?? {}, path) ?? fallback);
    return Number.isFinite(storedNumber) ? storedNumber : Number(fallback || 0);
  }

  _normalizeRollTraitKey(value = "") {
    const raw = String(value || "").replace(/^system\./, "").trim();
    if (!raw) return { key: "", systemPath: "" };

    if (raw.startsWith("attribute.")) {
      const [, group, trait] = raw.split(".");
      return { key: `attribute.${group}.${trait}`, systemPath: `attributes.${group}.${trait}` };
    }

    if (raw.startsWith("attributes.")) {
      const [, group, trait] = raw.split(".");
      return { key: `attribute.${group}.${trait}`, systemPath: `attributes.${group}.${trait}` };
    }

    if (raw.startsWith("ability.")) {
      const [, group, trait] = raw.split(".");
      return { key: `ability.${group}.${trait}`, systemPath: `abilities.${group}.${trait}.value` };
    }

    if (raw.startsWith("abilities.")) {
      const parts = raw.split(".");
      const group = parts[1];
      const trait = parts[2];
      return { key: `ability.${group}.${trait}`, systemPath: `abilities.${group}.${trait}.value` };
    }

    if (raw.startsWith("virtue.")) {
      const [, trait] = raw.split(".");
      return { key: `virtue.${trait}`, systemPath: `virtues.${trait}` };
    }

    if (raw.startsWith("virtues.")) {
      const [, trait] = raw.split(".");
      return { key: `virtue.${trait}`, systemPath: `virtues.${trait}` };
    }

    if (raw.startsWith("background.")) {
      const [, trait] = raw.split(".");
      return { key: `background.${trait}`, systemPath: `backgrounds.${trait}.value` };
    }

    if (raw.startsWith("backgrounds.")) {
      const parts = raw.split(".");
      const trait = parts[1];
      return { key: `background.${trait}`, systemPath: `backgrounds.${trait}.value` };
    }

    if (raw.startsWith("lore.")) {
      const [, trait] = raw.split(".");
      return { key: `lore.${trait}`, systemPath: `lores.${trait}.value` };
    }

    if (raw.startsWith("lores.")) {
      const parts = raw.split(".");
      const trait = parts[1];
      return { key: `lore.${trait}`, systemPath: `lores.${trait}.value` };
    }

    if (raw.startsWith("resource.")) {
      const [, trait] = raw.split(".");
      return { key: `resource.${trait}`, systemPath: `resources.${trait}.value` };
    }

    if (raw.startsWith("resources.")) {
      const parts = raw.split(".");
      const trait = parts[1];
      return { key: `resource.${trait}`, systemPath: `resources.${trait}.value` };
    }

    return { key: raw, systemPath: raw };
  }


  _buildRollTraitOptions() {
    const system = this.actor.system ?? {};
    const options = [];

    const liveValue = (systemPath, fallback = 0) => this._getLiveSystemNumber(systemPath, fallback);

    const push = ({ key, systemPath, label, group, fallback = 0 }) => {
      const rating = liveValue(systemPath, fallback);
      options.push({
        key,
        value: key,
        systemPath,
        label,
        rating,
        group,
        display: `${label} (${rating})`
      });
    };

    for (const [groupKey, keys] of Object.entries(VTM_REVISED.attributeCategories)) {
      const groupLabel = ATTRIBUTE_LABELS[groupKey] || groupKey;
      for (const key of keys) {
        push({
          key: `attribute.${groupKey}.${key}`,
          systemPath: `attributes.${groupKey}.${key}`,
          label: ATTRIBUTE_LABELS[key] || key,
          group: groupLabel,
          fallback: 1
        });
      }
    }

    for (const [groupKey, keys] of Object.entries(VTM_REVISED.abilityCategories)) {
      const groupLabel = ABILITY_LABELS[groupKey] || groupKey;
      for (const key of keys) {
        push({
          key: `ability.${groupKey}.${key}`,
          systemPath: `abilities.${groupKey}.${key}.value`,
          label: ABILITY_LABELS[key] || key,
          group: groupLabel,
          fallback: 0
        });
      }
    }

    for (const row of buildVirtueRows(system)) {
      push({
        key: `virtue.${row.key}`,
        systemPath: `virtues.${row.key}`,
        label: row.label,
        group: "Добродетели",
        fallback: 1
      });
    }

    for (const row of buildBackgroundRows(system)) {
      push({
        key: `background.${row.key}`,
        systemPath: `backgrounds.${row.key}.value`,
        label: row.label,
        group: "Дополнения",
        fallback: 0
      });
    }

    for (const row of buildLoreRows(system)) {
      push({
        key: `lore.${row.key}`,
        systemPath: `lores.${row.key}.value`,
        label: row.label,
        group: "Знания",
        fallback: 0
      });
    }

    push({
      key: "resource.faith",
      systemPath: "resources.faith.value",
      label: "Вера",
      group: "Ресурсы",
      fallback: 0
    });

    push({
      key: "resource.torment",
      systemPath: "resources.torment.value",
      label: "Мука",
      group: "Ресурсы",
      fallback: 0
    });

    push({
      key: "resource.willpower",
      systemPath: "resources.willpower.value",
      label: "Сила Воли",
      group: "Ресурсы",
      fallback: 0
    });

    return options;
  }

  _buildRollTraitOptionGroups() {
    const grouped = new Map();

    for (const option of this._buildRollTraitOptions()) {
      if (!grouped.has(option.group)) grouped.set(option.group, []);
      grouped.get(option.group).push(option);
    }

    return Array.from(grouped.entries()).map(([label, options]) => ({ label, options }));
  }

  _resolveTraitOption(value = "") {
    const raw = String(value || "").trim();
    if (!raw) return null;

    const normalized = this._normalizeRollTraitKey(raw);
    const options = this._buildRollTraitOptions();

    const option = options.find(item =>
      item.key === normalized.key ||
      item.key === raw ||
      item.value === raw ||
      item.systemPath === raw ||
      `system.${item.systemPath}` === raw
    );

    if (!option) return null;

    const rating = this._getLiveSystemNumber(option.systemPath, option.rating ?? 0);

    return {
      ...option,
      value: rating,
      rating,
      display: `${option.label} (${rating})`
    };
  }

  _getFormElement(htmlOrElement) {
    if (htmlOrElement instanceof HTMLFormElement) return htmlOrElement;
    if (htmlOrElement instanceof HTMLElement) return htmlOrElement.querySelector("form") ?? htmlOrElement;
    if (htmlOrElement?.[0] instanceof HTMLElement) return htmlOrElement[0].querySelector("form") ?? htmlOrElement[0];
    if (htmlOrElement?.find) return htmlOrElement.find("form")?.[0] ?? htmlOrElement[0];
    return null;
  }

  _buildRollEffectsHtml(firstTrait = "", secondTrait = "") {
    const effects = getDemonRollEffects(this.actor, [firstTrait, secondTrait]);
    if (!effects.length) return '<p class="demon-roll-effects-empty">Для выбранного броска подходящих модификаторов нет.</p>';
    const escape = value => foundry.utils.escapeHTML(String(value ?? ""));
    return effects.map(effect => {
      const modifiers = [];
      if (effect.dice) modifiers.push(`${effect.dice > 0 ? "+" : ""}${effect.dice} куб.`);
      if (effect.difficulty) modifiers.push(`${effect.difficulty > 0 ? "+" : ""}${effect.difficulty} к сложности`);
      const note = effect.note || effect.mechanics;
      return `<label class="demon-roll-effect-option">
        <input type="checkbox" name="rollEffect" value="${escape(`${effect.type}:${effect.key}`)}" data-dice="${Number(effect.dice || 0)}" data-difficulty="${Number(effect.difficulty || 0)}" data-label="${escape(effect.label)}">
        <span><b>${escape(effect.label)}</b> <strong>${escape(modifiers.join(", "))}</strong><small>${escape(note)}</small></span>
      </label>`;
    }).join("");
  }


  async _rollFromForm(htmlOrElement) {
    const form = this._getFormElement(htmlOrElement);
    if (!form) return null;

    const firstTraitKey = form.querySelector("[name='firstTrait'], [data-roll-field='firstTrait']")?.value || "";
    const secondTraitKey = form.querySelector("[name='secondTrait'], [data-roll-field='secondTrait']")?.value || "";
    const baseDifficulty = Number(form.querySelector("[name='difficulty'], [data-roll-field='difficulty']")?.value || 6);
    const customLabel = String(
      form.querySelector("[name='rollLabel'], [name='label'], [data-roll-field='label']")?.value || ""
    ).trim();

    const first = this._resolveTraitOption(firstTraitKey);
    const second = this._resolveTraitOption(secondTraitKey);

    if (!first) {
      ui.notifications?.warn?.("Выбери первый параметр для броска.");
      return null;
    }

    const healthPenalty = this._resolveHealthPenalty();
    if (healthPenalty.incapacitated) {
      ui.notifications?.warn?.("Персонаж недееспособен и не может бросать кубы.");
      return null;
    }

    const components = [first, second].filter(Boolean);
    const basePool = Math.max(0, components.reduce((total, component) => total + Number(component.value || 0), 0));
    const selectedEffects = [...form.querySelectorAll("[name='rollEffect']:checked")].map(input => ({
      label: input.dataset.label || "Модификатор",
      dice: Number(input.dataset.dice || 0),
      difficulty: Number(input.dataset.difficulty || 0)
    }));
    const diceModifier = selectedEffects.reduce((total, effect) => total + effect.dice, 0);
    const difficultyModifier = selectedEffects.reduce((total, effect) => total + effect.difficulty, 0);
    const pool = Math.max(1, basePool + healthPenalty.value + diceModifier);
    const difficulty = Math.max(2, Math.min(10, (Number.isFinite(baseDifficulty) ? baseDifficulty : 6) + difficultyModifier));
    const label = customLabel || components.map(component => component.label).join(" + ");
    const rollComponents = [
      ...components,
      ...selectedEffects.map(effect => ({ label: effect.label, value: [effect.dice ? `${effect.dice > 0 ? "+" : ""}${effect.dice} куб.` : "", effect.difficulty ? `${effect.difficulty > 0 ? "+" : ""}${effect.difficulty} сл.` : ""].filter(Boolean).join(", ") }))
    ];

    return rollDicePool({
      actor: this.actor,
      pool,
      basePool,
      healthPenalty: healthPenalty.value,
      healthPenaltyLabel: healthPenalty.label,
      difficulty,
      label,
      components: rollComponents
    });
  }
  _buildRollSelectHtml(name, selected = "", includeEmpty = false) {
    const groups = this._buildRollTraitOptionGroups();
    const normalizedSelected = this._normalizeRollTraitKey(selected).key;
    const selectedValue = String(normalizedSelected || selected || "");

    const options = [];
    if (includeEmpty) {
      options.push(`<option value="">Без второго параметра</option>`);
    }

    for (const group of groups) {
      const items = group.options.map(option => {
        const value = foundry.utils.escapeHTML(option.key);
        const label = foundry.utils.escapeHTML(option.display ?? `${option.label} (${option.rating ?? 0})`);
        const isSelected = option.key === selectedValue ? " selected" : "";
        return `<option value="${value}"${isSelected}>${label}</option>`;
      }).join("");

      options.push(`<optgroup label="${foundry.utils.escapeHTML(group.label)}">${items}</optgroup>`);
    }

    const rollField = name === "secondTrait" ? "secondTrait" : "firstTrait";
    return `<select name="${foundry.utils.escapeHTML(name)}" class="demon-roll-native-select" data-roll-field="${rollField}" data-vtm-searchable="true">${options.join("")}</select>`;
  }

  async _openRollDialog({ firstTrait = "", secondTrait = "", difficulty = 6, label = "Бросок" } = {}) {
    const normalizedFirst = this._normalizeRollTraitKey(firstTrait).key || firstTrait;
    const normalizedSecond = this._normalizeRollTraitKey(secondTrait).key || secondTrait;
    const first = this._resolveTraitOption(normalizedFirst);
    const safeLabel = label && label !== "Бросок"
      ? label
      : first?.label || "Бросок";

    const content = `
      <form class="vtm-roll-dialog demon-roll-dialog">
        <div class="form-group">
          <label>Первый параметр</label>
          ${this._buildRollSelectHtml("firstTrait", normalizedFirst, false)}
        </div>

        <div class="form-group">
          <label>Второй параметр</label>
          ${this._buildRollSelectHtml("secondTrait", normalizedSecond, true)}
        </div>

        <div class="grid grid-2 demon-roll-dialog-grid">
          <label>Сложность
            <input type="number" name="difficulty" min="2" max="10" value="${Number(difficulty || 6)}"/>
          </label>

          <label>Название броска
            <input type="text" name="rollLabel" value="${foundry.utils.escapeHTML(safeLabel)}"/>
          </label>
        </div>

        <fieldset class="demon-roll-effects-fieldset">
          <legend>Учесть достоинства и недостатки</legend>
          <div class="demon-roll-effects-list">${this._buildRollEffectsHtml(normalizedFirst, normalizedSecond)}</div>
        </fieldset>
      </form>`;

    return new Promise(resolve => {
      new DialogV1({
        title: "Бросок кубов",
        content,
        buttons: {
          roll: {
            icon: '<i class="fas fa-dice-d10"></i>',
            label: "Бросить",
            callback: async html => {
              await this._rollFromForm(html);
              resolve(true);
            }
          },
          cancel: {
            label: "Закрыть",
            callback: () => resolve(false)
          }
        },
        default: "roll",
        close: () => resolve(false),
        render: html => {
          const root = html?.[0] ?? html;
          if (root) {
            enhanceActorRollSearchSelects(root);
            const refreshEffects = () => {
              const firstTrait = root.querySelector("[name='firstTrait']")?.value || "";
              const secondTrait = root.querySelector("[name='secondTrait']")?.value || "";
              const list = root.querySelector(".demon-roll-effects-list");
              if (list) list.innerHTML = this._buildRollEffectsHtml(firstTrait, secondTrait);
            };
            root.querySelectorAll("[name='firstTrait'], [name='secondTrait']").forEach(select => select.addEventListener("change", refreshEffects));
          }
        }
      }, {
        width: 560,
        classes: ["demon-roll-dialog-window"]
      }).render(true);
    });
  }
  _resolveArchetype(value = "") {
    const raw = String(value ?? "").trim();
    if (!raw) return null;

    const found = findArchetypeForName(raw, DEMON_ARCHETYPES);
    if (found) return { ...found, isCustom: false };

    return {
      slug: "custom",
      name: raw,
      motto: "Своё значение",
      summary: "Пользовательский архетип.",
      regain: "Опиши условие восстановления Силы Воли вручную.",
      isCustom: true
    };
  }

  async _openArchetypeCard(kind = "nature", valueOverride = "") {
    const key = kind === "demeanor" ? "demeanor" : "nature";
    const value = String(valueOverride || (key === "demeanor" ? this.actor.system?.profile?.demeanor : this.actor.system?.profile?.nature) || "").trim();

    if (!value) {
      ui.notifications?.warn?.(key === "demeanor" ? "Сначала выбери Маску." : "Сначала выбери Натуру.");
      return null;
    }

    const archetype = findArchetypeForName(value, DEMON_ARCHETYPES);
    return new VTMArchetypeCard({ actor: this.actor, archetype, kind: key }).render({ force: true });
  }

  async _openActorPortraitViewer() {
    const image = this.actor.img || this.actor.system?.profile?.avatar || "icons/svg/mystery-man.svg";
    const title = this.actor.name || "Демон";

    const ImagePopoutClass = foundry.applications?.apps?.ImagePopout?.implementation
      ?? foundry.applications?.apps?.ImagePopout
      ?? globalThis.ImagePopout;

    if (ImagePopoutClass) {
      try {
        return new ImagePopoutClass(image, {
          title,
          uuid: this.actor.uuid,
          shareable: false
        }).render(true);
      } catch (error) {
        console.warn("Demon | ImagePopout failed, falling back to dialog.", error);
      }
    }

    const escapedSrc = foundry.utils.escapeHTML(image);
    const escapedTitle = foundry.utils.escapeHTML(title);
    const content = `
      <div class="vtm-portrait-viewer">
        <img src="${escapedSrc}" alt="${escapedTitle}" />
      </div>`;

    return new DialogV1({
      title,
      content,
      buttons: {
        close: {
          icon: '<i class="fas fa-xmark"></i>',
          label: game.i18n.localize("Close")
        }
      },
      default: "close"
    }, {
      width: 720,
      height: "auto",
      classes: ["vtm-revised", "vtm-portrait-viewer-dialog"]
    }).render(true);
  }

  async _openActorPortraitPicker() {
    const FilePickerClass = foundry.applications?.apps?.FilePicker?.implementation
      ?? foundry.applications?.apps?.FilePicker
      ?? globalThis.FilePicker;

    if (!FilePickerClass) {
      ui.notifications?.warn?.("FilePicker недоступен.");
      return;
    }

    const current = this.actor.img || this.actor.system?.profile?.avatar || "icons/svg/mystery-man.svg";
    const picker = new FilePickerClass({
      type: "image",
      current,
      document: this.actor,
      callback: async path => this._setActorPortrait(path, { notify: true }),
      position: {
        top: (this.position?.top ?? 100) + 40,
        left: (this.position?.left ?? 100) + 10
      }
    });

    if (typeof picker.browse === "function") await picker.browse(current);
    else if (typeof picker.render === "function") picker.render(true);
  }

  async _setActorPortrait(path, { notify = false } = {}) {
    const image = String(path || "icons/svg/mystery-man.svg").trim() || "icons/svg/mystery-man.svg";
    await this.actor.update({
      img: image,
      "system.profile.avatar": image
    });
    if (notify) ui.notifications?.info?.(`Портрет обновлён: ${image}`);
    return image;
  }

  async _syncPrototypeTokenImage() {
    const image = this.actor.img || this.actor.system?.profile?.avatar || "icons/svg/mystery-man.svg";
    await this.actor.update({ "prototypeToken.texture.src": image });
    ui.notifications?.info?.("Изображение токена синхронизировано.");
    return image;
  }

  static async _onSubmitForm(event, form, formData) {
    const actor = this.document;
    if (!actor) return;

    await actor.update(formData.object);
  }
}
