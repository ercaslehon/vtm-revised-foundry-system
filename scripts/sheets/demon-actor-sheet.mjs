import { rollDicePool } from "../dice/dice-pool.mjs";
import { VTM_REVISED } from "../config.mjs";
import { VTMArchetypeCard, findArchetypeForName } from "../apps/archetype-card.mjs";
import { enhanceActorRollSearchSelects } from "../ui/actor-roll-search-select.mjs";
import { DEMON_CATALOGS } from "../data/demon/demon-catalogs.mjs";
import { getDemonRollEffects } from "../data/demon/demon-roll-effects.mjs";
import { getAvailableDemonInvocations } from "../data/demon/demon-invocations.mjs";
import { DEMON_ABILITY_CATEGORIES, DEMON_ABILITY_LABELS } from "../data/demon/demon-abilities.mjs";
import { DEMON_APOCALYPTIC_FORMS } from "../data/demon/demon-apocalyptic-forms.mjs";
import { getActiveDemonFormSummary } from "../data/demon/demon-apocalyptic-mechanics.mjs";
import { DEMON_ARCHETYPES } from "../data/demon/demon-archetypes.mjs";
import { VTMDemonCharacterCreationWizard } from "../apps/demon-character-creation-wizard.mjs";
import { shouldPreselectAutomationEffect } from "../utils/automation-mode.mjs";
import { activeAutomationRollModifier } from "../utils/active-automation-effects.mjs";
import { VTM_STATUS_EFFECTS, actorHasStatus, statusRollModifier } from "../combat/status-effects.mjs";
import { demonHighTormentSlots, netAttackSuccesses as calculateNetAttackSuccesses } from "../combat/combat-math.mjs";
import { advancementCost } from "../utils/advancement-costs.mjs";
import { activateTraitReferenceButtons } from "../data/trait-reference.mjs";

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

const DEMON_HOUSE_ICON_FILES = new Map([
  ["devils", "devils.webp"], ["намару", "devils.webp"], ["дьяволы", "devils.webp"],
  ["scourges", "scourges.webp"], ["ашару", "scourges.webp"], ["кнуты", "scourges.webp"],
  ["malefactors", "malefactors.webp"], ["ануннаки", "malefactors.webp"], ["преступники", "malefactors.webp"],
  ["defilers", "defilers.webp"], ["ламмасу", "defilers.webp"], ["осквернители", "defilers.webp"],
  ["devourers", "devourers.webp"], ["рабису", "devourers.webp"], ["пожиратели", "devourers.webp"],
  ["slayers", "slayers.webp"], ["халаку", "slayers.webp"], ["убийцы", "slayers.webp"],
  ["fiends", "fiends.webp"], ["неберу", "fiends.webp"], ["изверги", "fiends.webp"]
]);

function demonHouseIcon(value = "") {
  const key = String(value || "").trim().toLowerCase().replaceAll("ё", "е");
  const file = DEMON_HOUSE_ICON_FILES.get(key);
  return file ? `systems/vtm-revised/assets/demon-house-icons/${file}` : "";
}

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
  charisma: "Обаяние",
  manipulation: "Манипулирование",
  appearance: "Внешность",
  perception: "Восприятие",
  intelligence: "Интеллект",
  wits: "Сообразительность"
};

const ABILITY_LABELS = DEMON_ABILITY_LABELS;


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
    const primaryLore = String(system.creation?.primaryLore ?? "").trim();
    const canonicalForm = DEMON_APOCALYPTIC_FORMS[primaryLore];
    const selectedHighTorment = new Set(Array.isArray(system.apocalypticForm?.highTormentSelected) ? system.apocalypticForm.highTormentSelected.map(String) : []);
    const highTormentSlots = demonHighTormentSlots(system.resources?.torment?.max);
    const highTormentFormOptions = (canonicalForm?.highTormentAbilities ?? []).map((description, index) => ({
      key: String(index),
      label: String(description).split(":")[0].trim(),
      description,
      checked: selectedHighTorment.has(String(index)),
      disabled: highTormentSlots <= 0 || (!selectedHighTorment.has(String(index)) && selectedHighTorment.size >= highTormentSlots)
    }));
    const activeFormSummary = getActiveDemonFormSummary(actor);
    const immunityLabels = { fire: "Огонь", electricity: "Электричество", poison: "Яды", falling: "Падение", bashing: "Поверхностный урон" };
    const activeFormView = {
      ...activeFormSummary,
      active: Boolean(system.apocalypticForm?.active && canonicalForm),
      formName: canonicalForm?.name || system.apocalypticForm?.name || "Апокалиптическая форма",
      immunitiesLabel: activeFormSummary.immunities.map(key => immunityLabels[key] || key).join(", "),
      abilities: activeFormSummary.abilities.map(entry => ({ ...entry, label: entry.mechanic?.label || String(entry.description).split(":")[0].trim(), high: entry.tier === "high", actionable: Boolean(entry.mechanic?.naturalAttack) }))
    };
    activeFormView.healthBoxes = Array.from({ length: activeFormSummary.healthLevels }, (_, index) => ({ index, damage: Number(system.health?.formBonusDamage?.[index] || 0) }));
    const activeInvocationEffects = Array.from(actor.effects ?? []).map(effect => {
      const flag = effect.flags?.["vtm-revised"];
      const data = flag?.type === "automationEffect" && flag?.sourceType === "demonInvocation" ? flag : null;
      return data ? { id: effect.id, name: effect.name, img: effect.img, description: effect.description, ...data } : null;
    }).filter(Boolean);
    const pactToday = new Date().toLocaleDateString("sv-SE");
    const pactEntries = (Array.isArray(system.pacts?.entries) ? system.pacts.entries : []).map(entry => {
      const faithRating = Math.max(1, Math.min(5, Number(entry.faithRating || 1)));
      const dailyMaximum = Math.ceil(faithRating / 2);
      const offeredFaith = Math.max(0, Math.min(dailyMaximum, Number(entry.offeredFaith || 0)));
      return {
        ...entry,
        faithRating,
        dailyMaximum,
        offeredFaith,
        collectedToday: String(entry.lastCollected || "") === pactToday
      };
    });

    const attributeGroupsView = buildTraitGroups(system, VTM_REVISED.attributeCategories, ATTRIBUTE_LABELS, "attributes");
    const abilityGroupsView = buildTraitGroups(system, DEMON_ABILITY_CATEGORIES, ABILITY_LABELS, "abilities", { named: true });
    const loreRows = buildLoreRows(system);
    const virtueRows = buildVirtueRows(system);
    const backgroundRows = buildBackgroundRows(system);
    const suggestedWillpower = calculateSuggestedWillpower(system);
    const healthRows = this._buildHealthRows();
    const portraitMode = ["human", "partial", "apocalyptic"].includes(system.profile?.avatarMode) ? system.profile.avatarMode : "human";
    const portraitImages = {
      human: system.profile?.avatar || actor.img || "icons/svg/mystery-man.svg",
      partial: system.profile?.partialAvatar || "icons/svg/mystery-man.svg",
      apocalyptic: system.profile?.apocalypticAvatar || "icons/svg/mystery-man.svg"
    };
    const portraitLabels = { human: "Человеческий облик", partial: "Частичная апокалиптическая форма", apocalyptic: "Полная апокалиптическая форма" };

    return {
      ...context,
      actor,
      document: actor,
      system,
      editable: this.isEditable,
      cssClass: "vtm-revised sheet actor demon",
      config: VTM_REVISED,
      houses: DEMON_HOUSES,
      houseIcon: demonHouseIcon(system.profile?.house),
      factions: DEMON_FACTIONS,
      archetypeOptions: DEMON_ARCHETYPES,
      selectedNature,
      selectedDemeanor,
      demonPortrait: { mode: portraitMode, image: portraitImages[portraitMode], label: portraitLabels[portraitMode] },
      resourceCards,
      tormentScales,
      highTormentSlots,
      highTormentFormOptions,
      activeFormView,
      activeInvocationEffects,
      pactEntries,
      pactDailyFaith: pactEntries.filter(entry => entry.active).reduce((total, entry) => total + entry.offeredFaith, 0),
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
      combatStatuses: VTM_STATUS_EFFECTS.map(status => ({ ...status, active: actorHasStatus(actor, status.id) })),
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
    activateTraitReferenceButtons(element);
    this._applyHouseHeaderIcon(element);

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

    element.querySelectorAll(".demon-portrait-cycle").forEach(button => {
      button.addEventListener("click", async event => {
        event.preventDefault();
        const modes = ["human", "partial", "apocalyptic"];
        const current = modes.indexOf(this._portraitMode());
        const delta = Number(button.dataset.delta || 1);
        const next = modes[(current + delta + modes.length) % modes.length];
        await this.actor.update({ "system.profile.avatarMode": next });
      });
    });

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
    element.querySelectorAll(".vtm-status-toggle").forEach(button => {
      button.addEventListener("click", async event => {
        event.preventDefault();
        const id = button.dataset.statusId;
        await this.actor.toggleStatusEffect(id, { active: !actorHasStatus(this.actor, id) });
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

    element.querySelectorAll(".demon-invocation-open").forEach(button => {
      button.addEventListener("click", async event => {
        event.preventDefault();
        await this._openInvocationDialog({
          loreKey: button.dataset.loreKey || "",
          loreLabel: button.dataset.loreLabel || "Знание",
          rating: Number(button.dataset.loreRating || 0)
        });
      });
    });

    element.querySelectorAll(".demon-high-torment-ability").forEach(input => {
      input.addEventListener("change", async event => {
        event.stopPropagation();
        const allowed = demonHighTormentSlots(this.actor.system?.resources?.torment?.max);
        const selected = [...element.querySelectorAll(".demon-high-torment-ability:checked")].map(entry => String(entry.value));
        if (selected.length > allowed) {
          event.currentTarget.checked = false;
          ui.notifications?.warn?.(`При постоянной Муке ${this.actor.system?.resources?.torment?.max || 0} доступно способностей высокой Муки: ${allowed}.`);
          return;
        }
        await this.actor.update({ "system.apocalypticForm.highTormentSelected": selected });
        await this._postApocalypticFormChat({ abilityIndex: event.currentTarget.value, active: event.currentTarget.checked });
      });
    });

    element.querySelector(".demon-apocalyptic-active")?.addEventListener("change", async event => {
      if (!event.target.matches("input[type='checkbox']")) return;
      event.preventDefault();
      event.stopPropagation();
      const active = event.target.checked;
      const update = { "system.apocalypticForm.active": active };
      if (!active) {
        update["system.health.formBonusDamage"] = [];
        update["system.automation.formExtraActionsTurn"] = 0;
      }
      await this.actor.update(update);
      await this._postApocalypticFormChat({ fullForm: true, active });
    });
    element.querySelector(".demon-form-show-chat")?.addEventListener("click", async event => { event.preventDefault(); await this._postApocalypticFormChat({ fullForm: true, active: true }); });
    element.querySelector(".demon-form-initiative")?.addEventListener("click", async event => { event.preventDefault(); await this._rollApocalypticInitiative(); });
    element.querySelector(".demon-form-extra-action")?.addEventListener("click", async event => { event.preventDefault(); await this._buyApocalypticExtraAction(); });
    element.querySelectorAll(".demon-form-special-attack").forEach(button => button.addEventListener("click", async event => {
      event.preventDefault();
      await this._useApocalypticSpecialAbility(button.dataset.tier, Number(button.dataset.index));
    }));
    element.querySelectorAll(".demon-form-health-box").forEach(button => button.addEventListener("click", async event => {
      event.preventDefault();
      const index = Number(button.dataset.formHealthIndex);
      const summary = getActiveDemonFormSummary(this.actor);
      const damage = Array.from({ length: summary.healthLevels }, (_, i) => Number(this.actor.system?.health?.formBonusDamage?.[i] || 0));
      damage[index] = damage[index] >= 3 ? 0 : damage[index] + 1;
      await this.actor.update({ "system.health.formBonusDamage": damage });
    }));
    element.querySelectorAll(".demon-invocation-effect-remove").forEach(button => button.addEventListener("click", async event => {
      event.preventDefault();
      const effectId = String(button.dataset.effectId || "");
      if (effectId) await this.actor.deleteEmbeddedDocuments("ActiveEffect", [effectId]);
    }));

    element.querySelector(".demon-harvest-faith")?.addEventListener("click", async event => {
      event.preventDefault();
      await this._openHarvestFaithDialog();
    });

    element.querySelector(".demon-pact-add")?.addEventListener("click", async event => {
      event.preventDefault();
      await this._openPactDialog();
    });

    element.querySelector(".demon-pacts-collect")?.addEventListener("click", async event => {
      event.preventDefault();
      await this._collectPactFaith();
    });

    element.querySelectorAll(".demon-pact-active").forEach(input => {
      input.addEventListener("change", async event => {
        const entries = this._pactEntries();
        const pact = entries.find(entry => String(entry.id) === String(event.currentTarget.dataset.pactId));
        if (!pact) return;
        pact.active = event.currentTarget.checked;
        await this.actor.update({ "system.pacts.entries": entries });
      });
    });
    element.querySelectorAll(".demon-pact-edit").forEach(button => button.addEventListener("click", async event => { event.preventDefault(); await this._openPactDialog(button.dataset.pactId); }));
    element.querySelectorAll(".demon-pact-delete").forEach(button => button.addEventListener("click", async event => { event.preventDefault(); await this._deletePact(button.dataset.pactId); }));

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
    element.querySelectorAll(".experience-entry-undo").forEach(button => button.addEventListener("click", async event => {
      event.preventDefault();
      await this._undoExperiencePurchase(button.dataset.entryId || "");
    }));
    element.querySelector(".demon-advancement-open")?.addEventListener("click", async event => { event.preventDefault(); await this._openAdvancementDialog(); });

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
    element.querySelectorAll(".combat-maneuver").forEach(button => {
      button.addEventListener("click", async event => {
        event.preventDefault();
        await this._useCombatManeuver(button.dataset.maneuver);
      });
    });
  }

  _applyHouseHeaderIcon(element) {
    const emblem = element?.querySelector?.(".demon-house-emblem");
    const icon = emblem?.querySelector?.(".demon-house-icon");
    const houseSelect = element?.querySelector?.('select[name="system.profile.house"]');
    if (!emblem || !icon) return;
    const apply = () => {
      const house = houseSelect?.value ?? this.actor.system?.profile?.house ?? "";
      const path = demonHouseIcon(house);
      emblem.hidden = !path;
      if (!path) return icon.removeAttribute("src");
      icon.src = path;
      icon.alt = house;
      icon.title = house;
    };
    apply();
    if (houseSelect && !houseSelect.dataset.demonHouseIconBound) {
      houseSelect.dataset.demonHouseIconBound = "1";
      houseSelect.addEventListener("change", apply);
    }
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
        typeLabel: entry.reversedAt ? "Отменено" : this._experienceTypeLabel(type),
        dateLabel: this._formatExperienceDate(entry.createdAt),
        signedDelta: entry.reversedAt ? "0" : (delta > 0 ? `+${delta}` : String(delta)),
        positive: entry.reversedAt || delta >= 0,
        reason: String(entry.reason || "").trim() || game.i18n.localize("VTM_REVISED.Experience.NoReason"),
        target: String(entry.target || "").trim(),
        userName: String(entry.userName || "").trim(),
        canUndo: Boolean(entry.purchase && !entry.reversedAt)
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
    if (entry.reversedAt) {
      await this.actor.update({ "system.resources.experience.journal": journal.filter(item => String(item.id) !== String(entryId)) });
      return entry;
    }
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

  async _undoExperiencePurchase(entryId = "") {
    const journal = this._experienceJournalEntries();
    const entry = journal.find(item => String(item.id) === String(entryId));
    if (!entry?.purchase || entry.reversedAt || !entry.target) return false;
    const [uuid, nestedPath] = String(entry.target).split("#");
    const document = nestedPath ? await fromUuid(uuid) : this.actor;
    const path = nestedPath || entry.target;
    if (!document) return false;
    const before = JSON.parse(entry.beforeJson || "null");
    const after = JSON.parse(entry.afterJson || "null");
    if (JSON.stringify(foundry.utils.getProperty(document, path)) !== JSON.stringify(after)) {
      ui.notifications?.warn?.("Покупку нельзя откатить: значение уже изменилось после неё.");
      return false;
    }
    const confirmed = await new Promise(resolve => new DialogV1({ title: "Откатить развитие", content: `<p>Вернуть <b>${Math.abs(Number(entry.amount || entry.delta || 0))} опыта</b> и восстановить прежнее значение?</p>`, buttons: { undo: { label: "Откатить", callback: () => resolve(true) }, cancel: { label: game.i18n.localize("Cancel"), callback: () => resolve(false) } }, default: "cancel", close: () => resolve(false) }, { width: 440, classes: ["demon-roll-dialog-window"] }).render(true));
    if (!confirmed) return false;
    const reversedAt = new Date().toISOString();
    const nextJournal = journal.map(item => String(item.id) === String(entryId) ? { ...item, reversedAt } : item);
    const xp = this.actor.system?.resources?.experience ?? {};
    if (document === this.actor) await this.actor.update({ [path]: before, "system.resources.experience.journal": nextJournal, "system.resources.experience.available": Number(xp.available || 0) + Math.abs(Number(entry.amount || 0)), "system.resources.experience.spent": Math.max(0, Number(xp.spent || 0) - Math.abs(Number(entry.amount || 0))) });
    else { await document.update({ [path]: before }); await this.actor.update({ "system.resources.experience.journal": nextJournal, "system.resources.experience.available": Number(xp.available || 0) + Math.abs(Number(entry.amount || 0)), "system.resources.experience.spent": Math.max(0, Number(xp.spent || 0) - Math.abs(Number(entry.amount || 0))) }); }
    return true;
  }

  async _recalculateExperienceFromJournal() {
    const entries = this._experienceJournalEntries().filter(entry => !entry.reversedAt);
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

  async _openAdvancementDialog() {
    const system = this.actor.system ?? {};
    const purchases = [];
    const add = (group, label, path, current, cost, next = Number(current) + 1) => {
      if (Number.isFinite(cost) && cost > 0) purchases.push({ group, label, path, current: Number(current), next, cost });
    };
    for (const [group, keys] of Object.entries(VTM_REVISED.attributeCategories)) for (const key of keys) {
      const current = numberValue(system.attributes?.[group]?.[key], 1);
      if (current < 5) add("Атрибуты", ATTRIBUTE_LABELS[key] || key, `system.attributes.${group}.${key}`, current, advancementCost("attribute", current));
    }
    for (const [group, keys] of Object.entries(DEMON_ABILITY_CATEGORIES)) for (const key of keys) {
      const current = numberValue(system.abilities?.[group]?.[key]?.value, 0);
      if (current < 5) add("Способности", ABILITY_LABELS[key] || key, `system.abilities.${group}.${key}.value`, current, advancementCost("ability", current));
    }
    const house = VTM_REVISED.demonRules.houses.find(entry => entry.key === system.profile?.house);
    for (const lore of DEMON_CATALOGS.lores) {
      const current = numberValue(system.lores?.[lore.key]?.value, 0);
      if (current >= 5) continue;
      const own = house?.houseLores?.includes(lore.key) || ["fundament", "humanity"].includes(lore.key);
      add("Знания", lore.label, `system.lores.${lore.key}.value`, current, advancementCost("demonLore", current, { ownLore: own }));
    }
    for (const row of buildBackgroundRows(system)) if (row.value < 5) add("Дополнения", row.label, row.valuePath, row.value, advancementCost("background", row.value));
    for (const row of buildVirtueRows(system)) if (row.value < 5) add("Добродетели", row.label, row.valuePath, row.value, advancementCost("virtue", row.value));
    const willpower = numberValue(system.resources?.willpower?.max, 0);
    if (willpower < 10) add("Ресурсы", "Сила Воли", "system.resources.willpower.max", willpower, advancementCost("willpower", willpower));
    const faith = numberValue(system.resources?.faith?.max, 0);
    if (faith < 10) add("Ресурсы", "Вера", "system.resources.faith.max", faith, advancementCost("faith", faith));
    const torment = numberValue(system.resources?.torment?.max, 1);
    if (torment > 1) add("Ресурсы", "Снизить постоянную Муку", "system.resources.torment.max", torment, advancementCost("tormentReduction", torment), torment - 1);
    const grouped = new Map();
    purchases.forEach((entry, index) => { entry.index = index; if (!grouped.has(entry.group)) grouped.set(entry.group, []); grouped.get(entry.group).push(entry); });
    const options = [...grouped.entries()].map(([group, entries]) => `<optgroup label="${foundry.utils.escapeHTML(group)}">${entries.map(entry => `<option value="${entry.index}">${foundry.utils.escapeHTML(entry.label)} · ${entry.current} → ${entry.next} · ${entry.cost} опыта</option>`).join("")}</optgroup>`).join("");
    const content = `<form class="demon-advancement-dialog"><p>Доступно опыта: <b>${numberValue(system.resources?.experience?.available, 0)}</b></p><label>Развитие<select name="purchase" data-vtm-searchable="true">${options}</select></label><div class="demon-advancement-preview"></div><fieldset><legend>Новая пользовательская Способность · 3 опыта</legend><div class="grid grid-2"><label>Название<input name="customAbilityName"></label><label>Категория<select name="customAbilityCategory"><option value="talents">Талант</option><option value="skills">Навык</option><option value="knowledges">Знание</option></select></label></div><label>Специализация<input name="customAbilitySpecialization"></label></fieldset><label class="demon-roll-effect-option"><input type="checkbox" name="storytellerApproved"><span><b>Покупка согласована с Рассказчиком</b></span></label><p class="hint">Стоимость и текущее значение проверяются перед покупкой. Покупку можно откатить из журнала, пока параметр не изменился снова.</p></form>`;
    return new Promise(resolve => new DialogV1({ title: "Развитие персонажа", content, buttons: { buy: { label: "Купить", callback: async html => {
      const selected = purchases[Number(this._getFormElement(html)?.querySelector("[name='purchase']")?.value)];
      if (!selected) return resolve(false);
      if (!this._getFormElement(html)?.querySelector("[name='storytellerApproved']")?.checked) { ui.notifications?.warn?.("Подтверди согласование покупки с Рассказчиком."); return resolve(false); }
      const liveCurrent = foundry.utils.getProperty(this.actor, selected.path);
      if (JSON.stringify(liveCurrent) !== JSON.stringify(selected.current)) { ui.notifications?.warn?.("Значение изменилось после открытия окна. Открой развитие заново."); return resolve(false); }
      const available = numberValue(this.actor.system?.resources?.experience?.available, 0);
      if (available < selected.cost) { ui.notifications?.warn?.(`Недостаточно опыта: ${available}/${selected.cost}.`); return resolve(false); }
      const entry = { id: foundry.utils.randomID(), type: "spend", amount: selected.cost, delta: -selected.cost, reason: `Развитие: ${selected.label} ${selected.current} → ${selected.next}`, target: selected.path, beforeJson: JSON.stringify(selected.current), afterJson: JSON.stringify(selected.next), purchase: true, reversedAt: "", createdAt: new Date().toISOString(), userId: game.user?.id || "", userName: game.user?.name || "" };
      await this.actor.update({ [selected.path]: selected.next, "system.resources.experience.available": available - selected.cost, "system.resources.experience.spent": numberValue(this.actor.system?.resources?.experience?.spent, 0) + selected.cost, "system.resources.experience.journal": [...this._experienceJournalEntries(), entry] });
      await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: this.actor }), content: `<article class="vtm-chat-card demon-chat-card"><h2>Развитие персонажа</h2><p><b>${foundry.utils.escapeHTML(selected.label)}</b>: ${selected.current} → ${selected.next}</p><p>Потрачено опыта: ${selected.cost}</p></article>` });
      resolve(true);
    } }, custom: { label: "Купить новую Способность", callback: async html => {
      const form = this._getFormElement(html);
      if (!form?.querySelector("[name='storytellerApproved']")?.checked) { ui.notifications?.warn?.("Подтверди согласование покупки с Рассказчиком."); return resolve(false); }
      const name = String(form?.querySelector("[name='customAbilityName']")?.value || "").trim();
      if (!name) { ui.notifications?.warn?.("Укажи название новой Способности."); return resolve(false); }
      const available = numberValue(this.actor.system?.resources?.experience?.available, 0);
      if (available < 3) { ui.notifications?.warn?.(`Недостаточно опыта: ${available}/3.`); return resolve(false); }
      const before = Array.from(this.actor.system?.abilities?.custom ?? []).map(entry => foundry.utils.deepClone(entry));
      if (before.some(entry => String(entry.name || "").trim().toLowerCase() === name.toLowerCase())) { ui.notifications?.warn?.("Такая пользовательская Способность уже существует."); return resolve(false); }
      const after = [...before, { name, category: String(form.querySelector("[name='customAbilityCategory']")?.value || "custom"), value: 1, specialization: String(form.querySelector("[name='customAbilitySpecialization']")?.value || "").trim() }];
      const entry = { id: foundry.utils.randomID(), type: "spend", amount: 3, delta: -3, reason: `Новая Способность: ${name} 0 → 1`, target: "system.abilities.custom", beforeJson: JSON.stringify(before), afterJson: JSON.stringify(after), purchase: true, reversedAt: "", createdAt: new Date().toISOString(), userId: game.user?.id || "", userName: game.user?.name || "" };
      await this.actor.update({ "system.abilities.custom": after, "system.resources.experience.available": available - 3, "system.resources.experience.spent": numberValue(this.actor.system?.resources?.experience?.spent, 0) + 3, "system.resources.experience.journal": [...this._experienceJournalEntries(), entry] });
      resolve(true);
    } }, cancel: { label: game.i18n.localize("Cancel"), callback: () => resolve(false) } }, default: "buy", close: () => resolve(false), render: html => enhanceActorRollSearchSelects(html?.[0] ?? html) }, { width: 680, classes: ["demon-roll-dialog-window", "demon-advancement-dialog-window"] }).render(true));
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
    const attackFirst = weapon.attackFirstTrait || "attribute.physical.dexterity";
    const attackSecond = weapon.attackSecondTrait || (weapon.category === "firearm" ? "ability.skills.firearms" : "ability.skills.melee");
    const target = this._selectedCombatTargetActor({ notify: false });
    const content = `<form class="demon-roll-dialog demon-weapon-attack-dialog">
      <p><strong>${foundry.utils.escapeHTML(item.name)}</strong></p>
      <p class="muted">Цель: <strong>${foundry.utils.escapeHTML(target?.name || "не выбрана")}</strong></p>
      <div class="form-group"><label>Первый параметр</label>${this._buildRollSelectHtml("firstTrait", attackFirst, false)}</div>
      <div class="form-group"><label>Второй параметр</label>${this._buildRollSelectHtml("secondTrait", attackSecond, true)}</div>
      <div class="grid grid-2"><label>Сложность атаки<input type="number" name="difficulty" min="2" max="10" value="${Number(weapon.difficulty || 6)}"></label><label>Сложность урона<input type="number" name="damageDifficulty" min="2" max="10" value="${Number(weapon.damageDifficulty || 6)}"></label></div>
      <div class="form-group"><label><input type="checkbox" name="useDefense" ${target ? "checked" : "disabled"}> Активная защита цели</label><select name="defenseType" ${target ? "" : "disabled"}><option value="dodge">Уклонение</option><option value="parry">Парирование</option><option value="block">Блок</option></select></div>
    </form>`;
    return new Promise(resolve => new DialogV1({
      title: `Атака: ${item.name}`, content,
      buttons: {
        attack: { icon: '<i class="fas fa-dice-d10"></i>', label: "Атака и урон", callback: async html => {
          const form = this._getFormElement(html);
          const result = await this._rollWeaponAttackAndDamage(item, {
            firstTrait: form?.querySelector("[name='firstTrait']")?.value || attackFirst,
            secondTrait: form?.querySelector("[name='secondTrait']")?.value || attackSecond,
            difficulty: Number(form?.querySelector("[name='difficulty']")?.value || weapon.difficulty || 6),
            damageDifficulty: Number(form?.querySelector("[name='damageDifficulty']")?.value || weapon.damageDifficulty || 6),
            targetActor: target,
            defenseType: form?.querySelector("[name='useDefense']")?.checked ? form?.querySelector("[name='defenseType']")?.value : ""
          });
          resolve(result);
        } },
        cancel: { label: game.i18n.localize("Cancel"), callback: () => resolve(null) }
      }, default: "attack", close: () => resolve(null)
    }, { width: 560, classes: ["demon-roll-dialog-window", "demon-weapon-dialog-window"] }).render(true));
  }

  async _rollWeaponAttackAndDamage(item, options = {}) {
    const weapon = item.system?.weapon ?? {};
    const first = this._resolveTraitOption(options.firstTrait || weapon.attackFirstTrait || "attribute.physical.dexterity");
    const second = this._resolveTraitOption(options.secondTrait || weapon.attackSecondTrait || (weapon.category === "firearm" ? "ability.skills.firearms" : "ability.skills.melee"));
    if (!first) return null;

    const healthPenalty = this._resolveHealthPenalty();
    if (healthPenalty.incapacitated) {
      ui.notifications?.warn?.(game.i18n.localize("VTM_REVISED.Roll.HealthBlocked"));
      return null;
    }

    const components = [first, second].filter(Boolean);
    const basePool = Math.max(1, components.reduce((sum, component) => sum + Number(component.value || 0), 0));
    const attackStatus = statusRollModifier(this.actor, { physical: true });
    const activeModifier = activeAutomationRollModifier(this.actor, components.map(component => component.key));
    const formEffects = getDemonRollEffects(this.actor, components.map(component => component.key))
      .filter(effect => effect.type === "apocalypticForm");
    const formDice = formEffects.reduce((sum, effect) => sum + Number(effect.dice || 0), 0);
    const formDifficulty = formEffects.reduce((sum, effect) => sum + Number(effect.difficulty || 0), 0);
    const attackResult = await rollDicePool({
      actor: this.actor,
      pool: Math.max(1, basePool + healthPenalty.value + attackStatus.dice + formDice + activeModifier.dice),
      basePool,
      healthPenalty: healthPenalty.value,
      healthPenaltyLabel: healthPenalty.label,
      difficulty: Math.max(2, Math.min(10, Number(options.difficulty || weapon.difficulty || 6) + formDifficulty + activeModifier.difficulty)),
      label: game.i18n.format("VTM_REVISED.Weapon.AttackLabel", { name: item.name }),
      components: [
        ...components,
        ...(attackStatus.dice ? [{ label: attackStatus.label, value: attackStatus.dice }] : []),
        ...formEffects.filter(effect => effect.dice).map(effect => ({ label: effect.label, value: Number(effect.dice) })),
        ...activeModifier.effects.map(effect => ({ label: effect.name, value: Number(effect.diceModifier || effect.difficultyModifier || 0) }))
      ],
      flavor: formEffects.length ? formEffects.map(effect => effect.label).join("; ") : ""
    });

    const defenseResult = options.targetActor && options.defenseType ? await this._rollTargetDefense(options.targetActor, options.defenseType) : null;
    const netAttackSuccesses = calculateNetAttackSuccesses(attackResult.successes, defenseResult?.successes);
    if (attackResult.botch || netAttackSuccesses <= 0) {
      ui.notifications?.warn?.(`${item.name}: атака не достигла цели.`);
      return { attackResult, defenseResult, netAttackSuccesses };
    }

    const extraSuccesses = weapon.addsAttackSuccesses === false ? 0 : Math.max(0, netAttackSuccesses - 1);
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
      difficulty: Number(options.damageDifficulty || weapon.damageDifficulty || 6),
      label: game.i18n.format("VTM_REVISED.Weapon.DamageLabel", { name: item.name }),
      flavor: game.i18n.format("VTM_REVISED.Weapon.DamageFlavor", { type: damageTypeLabel }),
      components: [
        { label: game.i18n.localize("VTM_REVISED.Weapon.BaseDamage"), value: baseDamage },
        { label: game.i18n.localize("VTM_REVISED.Weapon.ExtraAttackSuccesses"), value: extraSuccesses },
        ...(goodRightHookDice ? [{ label: "Хороший хук справа", value: "+2 куб." }] : [])
      ]
    });
    const renderTemplate = foundry.applications?.handlebars?.renderTemplate ?? globalThis.renderTemplate;
    const content = await renderTemplate("systems/vtm-revised/templates/chat/weapon-damage-card.hbs", {
      actor: this.actor, item, weapon, attackSuccesses: attackResult.successes, hasDefense: Boolean(defenseResult), defenseSuccesses: defenseResult?.successes ?? null, netAttackSuccesses, extraSuccesses,
      damagePool, damageSuccesses: damageResult.successes, damageTypeLabel,
      soakHint: weapon.damageType === "aggravated" ? "Усиливающийся урон поглощается только специальной защитой апокалиптической формы." : "Падший поглощает поверхностный урон Выносливостью; для летального можно выбрать Выносливость или Веру."
    });
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }), content,
      flags: { "vtm-revised": { type: "weaponDamage", actorId: this.actor.id, itemId: item.id, targetActorUuid: options.targetActor?.uuid || "", damageSuccesses: Number(damageResult.successes || 0), damageType: weapon.damageType || "bashing", damageTypeLabel } }
    });
    return { attackResult, defenseResult, netAttackSuccesses, damageResult };
  }

  _selectedCombatTargetActor({ notify = true } = {}) {
    const targets = Array.from(game.user?.targets ?? []);
    if (targets.length === 1) return targets[0].actor ?? null;
    if (notify) ui.notifications?.warn?.("Выбери ровно один токен-цель.");
    return null;
  }

  _actorTraitValue(actor, path) {
    return Number(foundry.utils.getProperty(actor, `system.${path}`) || 0);
  }

  _actorHealthPenalty(actor) {
    const health = actor.system?.health ?? {};
    const key = [...VTM_REVISED.healthLevels].reverse().find(entry => Number(health[entry] || 0) > 0);
    if (!key) return { value: 0, incapacitated: false, label: "" };
    const penalty = VTM_REVISED.healthPenalties[key] ?? 0;
    return { value: penalty === "out" ? 0 : Number(penalty || 0), incapacitated: penalty === "out", label: game.i18n.localize(`VTM_REVISED.Health.${key}`) };
  }

  async _rollTargetDefense(actor, type = "dodge") {
    const ability = type === "parry" ? "skills.melee" : type === "block" ? "talents.brawl" : "talents.dodge";
    const labels = { dodge: "Уклонение", parry: "Парирование", block: "Блок" };
    const dexterity = this._actorTraitValue(actor, "attributes.physical.dexterity");
    const abilityValue = this._actorTraitValue(actor, `abilities.${ability}.value`);
    const health = this._actorHealthPenalty(actor);
    if (health.incapacitated) return { successes: 0, botch: false };
    const basePool = Math.max(1, dexterity + abilityValue);
    const armor = actor.system?.automation?.armor ?? {};
    const armorPenalty = armor.active ? Math.max(0, Number(armor.dexterityPenalty || 0)) : 0;
    const status = statusRollModifier(actor, { physical: true });
    return rollDicePool({
      actor, pool: Math.max(1, basePool + health.value - armorPenalty + status.dice), basePool,
      healthPenalty: health.value, healthPenaltyLabel: health.label, difficulty: 6,
      label: `${labels[type] || labels.dodge}: ${actor.name}`,
      components: [{ label: "Ловкость", value: dexterity }, { label: labels[type] || labels.dodge, value: abilityValue }, ...(armorPenalty ? [{ label: "Штраф брони", value: -armorPenalty }] : []), ...(status.dice ? [{ label: status.label, value: status.dice }] : [])]
    });
  }

  async _useCombatManeuver(key = "punch") {
    const maneuvers = {
      punch: { name: "Удар кулаком", difficulty: 6, damageBonus: 0, damageType: "bashing" },
      kick: { name: "Удар ногой", difficulty: 7, damageBonus: 1, damageType: "bashing" },
      bite: { name: "Укус", difficulty: 6, damageBonus: 1, damageType: "lethal", note: "Боевой укус требует предварительно обездвижить цель." }
    };
    const maneuver = maneuvers[key];
    if (!maneuver) return;
    if (maneuver.note) ui.notifications?.info?.(maneuver.note);
    return this._useWeapon({
      id: `maneuver-${key}`, name: maneuver.name,
      system: { weapon: { category: "melee", attackFirstTrait: "attribute.physical.dexterity", attackSecondTrait: "ability.talents.brawl", difficulty: maneuver.difficulty, damageDifficulty: 6, usesStrength: true, damageBonus: maneuver.damageBonus, damageType: maneuver.damageType, addsAttackSuccesses: true } }
    });
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

    for (const [groupKey, keys] of Object.entries(DEMON_ABILITY_CATEGORIES)) {
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
    const active = activeAutomationRollModifier(this.actor, [firstTrait, secondTrait]).effects.map(effect => ({
      type: "activeEffect", key: effect.id, label: effect.name, dice: Number(effect.diceModifier || 0), difficulty: Number(effect.difficultyModifier || 0), note: effect.notes || effect.duration, automatic: true
    }));
    const effects = [...getDemonRollEffects(this.actor, [firstTrait, secondTrait]), ...active];
    if (!effects.length) return '<p class="demon-roll-effects-empty">Для выбранного броска подходящих модификаторов нет.</p>';
    const escape = value => foundry.utils.escapeHTML(String(value ?? ""));
    return effects.map(effect => {
      const modifiers = [];
      if (effect.dice) modifiers.push(`${effect.dice > 0 ? "+" : ""}${effect.dice} куб.`);
      if (effect.difficulty) modifiers.push(`${effect.difficulty > 0 ? "+" : ""}${effect.difficulty} к сложности`);
      const note = effect.note || effect.mechanics;
      return `<label class="demon-roll-effect-option">
        <input type="checkbox" name="rollEffect" value="${escape(`${effect.type}:${effect.key}`)}" data-dice="${Number(effect.dice || 0)}" data-difficulty="${Number(effect.difficulty || 0)}" data-label="${escape(effect.label)}"${shouldPreselectAutomationEffect(effect) ? " checked" : ""}>
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
    const isPhysical = [firstTraitKey, secondTraitKey].some(key => key.includes("physical") || /\.(brawl|athletics|dodge|melee|firearms)$/.test(key));
    const statusModifier = statusRollModifier(this.actor, { physical: isPhysical });
    const pool = Math.max(1, basePool + healthPenalty.value + diceModifier + statusModifier.dice);
    const difficulty = Math.max(2, Math.min(10, (Number.isFinite(baseDifficulty) ? baseDifficulty : 6) + difficultyModifier));
    const label = customLabel || components.map(component => component.label).join(" + ");
    const rollComponents = [
      ...components,
      ...(statusModifier.dice ? [{ label: statusModifier.label, value: statusModifier.dice }] : []),
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
              resolve(await this._rollFromForm(html));
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

  _pactEntries() {
    return Array.isArray(this.actor.system?.pacts?.entries)
      ? this.actor.system.pacts.entries.map(entry => ({ ...entry }))
      : [];
  }

  async _postApocalypticFormChat({ fullForm = false, abilityIndex = "", active = false } = {}) {
    const loreKey = String(this.actor.system?.creation?.primaryLore ?? "").trim();
    const form = DEMON_APOCALYPTIC_FORMS[loreKey];
    if (!form) return null;
    const escape = value => foundry.utils.escapeHTML(String(value ?? ""));
    let title = form.name;
    let body = "";
    if (fullForm) {
      if (!active) {
        body = "<p><b>Полная апокалиптическая форма прекращена.</b></p>";
      } else {
        const selected = new Set(Array.isArray(this.actor.system?.apocalypticForm?.highTormentSelected)
          ? this.actor.system.apocalypticForm.highTormentSelected.map(String)
          : []);
        const high = (form.highTormentAbilities ?? []).filter((_, index) => selected.has(String(index)));
        const abilities = [...(form.abilities ?? []), ...high];
        body = `<p>${escape(form.description)}</p><h3>Действующие способности</h3><ul>${abilities.map(ability => `<li>${escape(ability)}</li>`).join("")}</ul>`;
      }
    } else {
      const ability = form.highTormentAbilities?.[Number(abilityIndex)];
      if (!ability) return null;
      title = `${form.name}: высокая Мука`;
      body = `<p><b>${active ? "Способность активирована" : "Способность отключена"}:</b> ${escape(ability)}</p>${active && !this.actor.system?.apocalypticForm?.active ? "<p><i>Эффект начнёт действовать после активации полной формы.</i></p>" : ""}`;
    }
    return ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<article class="vtm-chat-card demon-chat-card demon-apocalyptic-chat"><h2><i class="fas fa-circle-dot"></i> ${escape(title)}</h2>${body}</article>`,
      flags: { "vtm-revised": { type: "apocalypticForm", active, fullForm, abilityIndex: String(abilityIndex) } }
    });
  }

  async _rollApocalypticInitiative() {
    const summary = getActiveDemonFormSummary(this.actor);
    const dexterity = numberValue(this.actor.system?.attributes?.physical?.dexterity, 0);
    const wits = numberValue(this.actor.system?.attributes?.mental?.wits, 0);
    const bonus = Number(summary.initiative || 0);
    const roll = await new Roll("1d10").evaluate({ async: true });
    const total = Number(roll.total || 0) + dexterity + wits + bonus;
    const tokens = this.actor.getActiveTokens?.(true, true) ?? [];
    const token = tokens.find(entry => entry.controlled) ?? tokens[0];
    if (token) {
      let combat = game.combat;
      if (!combat) combat = await Combat.create({ scene: canvas.scene.id, active: true });
      let combatant = combat.combatants.find(entry => entry.tokenId === token.id);
      if (!combatant) [combatant] = await combat.createEmbeddedDocuments("Combatant", [{ tokenId: token.id, actorId: this.actor.id, sceneId: canvas.scene.id }]);
      await combat.setInitiative(combatant.id, total);
    }
    await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor: this.actor, token: token?.document }), flavor: `Инициатива: ${total} (Ловкость ${dexterity} + Сообразительность ${wits}${bonus ? ` + форма ${bonus}` : ""})` });
    return total;
  }

  async _buyApocalypticExtraAction() {
    const summary = getActiveDemonFormSummary(this.actor);
    if (!summary.extraActions) return false;
    if (Number(this.actor.system?.resources?.faith?.value || 0) < 1) {
      ui.notifications?.warn?.("Недостаточно временной Веры.");
      return false;
    }
    const current = Number(this.actor.system?.automation?.formExtraActionsTurn || 0);
    await this.actor.changeResource("resources.faith", -1, "Дополнительное действие апокалиптической формы");
    await this.actor.update({ "system.automation.formExtraActionsTurn": current + 1 });
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: this.actor }), content: `<article class="vtm-chat-card demon-chat-card"><h2>Дополнительное действие</h2><p>${foundry.utils.escapeHTML(this.actor.name)} тратит 1 Веру и получает дополнительное действие в этом ходу. Всего приобретено: ${current + 1}.</p></article>` });
    return true;
  }

  async _useApocalypticSpecialAbility(tier = "low", index = 0) {
    const ability = getActiveDemonFormSummary(this.actor).abilities.find(entry => entry.tier === tier && Number(entry.index) === Number(index));
    if (!ability) return false;
    const escape = value => foundry.utils.escapeHTML(String(value ?? ""));
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: this.actor }), content: `<article class="vtm-chat-card demon-chat-card"><h2><i class="fas fa-burst"></i> ${escape(ability.mechanic?.label || "Особая способность")}</h2><p>${escape(ability.description)}</p><p><b>Источник:</b> ${escape(ability.formName)}</p></article>`, flags: { "vtm-revised": { type: "demonFormAbility", loreKey: ability.loreKey, tier, index } } });
    const attack = ability.mechanic?.naturalAttack;
    if (!attack) return true;
    return this._useWeapon({ id: `form-${ability.loreKey}-${tier}-${index}`, name: ability.mechanic?.label || "Естественная атака", system: { weapon: { category: "melee", attackFirstTrait: "attribute.physical.dexterity", attackSecondTrait: "ability.talents.brawl", difficulty: Number(attack.difficulty || 6), damageDifficulty: 6, usesStrength: attack.usesStrength !== false, damageBonus: Number(attack.damageBonus || 0), damageDice: Number(attack.damageDice || 0), damageType: attack.damageType || "aggravated", addsAttackSuccesses: true } } });
  }

  async _openPactDialog(pactId = "") {
    const existing = this._pactEntries().find(entry => String(entry.id) === String(pactId));
    if (!existing && Number(this.actor.system?.resources?.faith?.value || 0) < 1) {
      ui.notifications?.warn?.("Для закрепления нового договора требуется 1 временная Вера.");
      return false;
    }
    const escape = value => foundry.utils.escapeHTML(String(value ?? ""));
    const content = `<form class="demon-pact-dialog">
      <div class="form-group"><label>Имя смертного</label><input type="text" name="name" value="${escape(existing?.name)}" required></div>
      <div class="grid grid-2">
        <div class="form-group"><label>Вера смертного</label><input type="number" name="faithRating" value="${Number(existing?.faithRating || 1)}" min="1" max="5"></div>
        <div class="form-group"><label>Вера демону в день</label><input type="number" name="offeredFaith" value="${Number(existing?.offeredFaith ?? 1)}" min="0" max="3"></div>
      </div>
      <div class="form-group"><label>Желание / дар</label><textarea name="gift">${escape(existing?.gift)}</textarea></div>
      <div class="form-group"><label>Условия договора</label><textarea name="terms">${escape(existing?.terms)}</textarea></div>
      <p class="hint">${existing ? "Редактирование не расходует Веру." : "Закрепление договора расходует 1 временную Веру."} Ежедневно можно получать не больше половины Веры слуги с округлением вверх.</p>
    </form>`;
    return new Promise(resolve => new DialogV1({
      title: existing ? "Изменить договор" : "Заключить договор",
      content,
      buttons: {
        create: {
          icon: '<i class="fas fa-file-signature"></i>',
          label: existing ? "Сохранить" : "Закрепить договор",
          callback: async html => {
            const form = this._getFormElement(html);
            const name = String(form?.querySelector("[name='name']")?.value || "").trim();
            if (!name) {
              ui.notifications?.warn?.("Укажи имя смертного.");
              resolve(false);
              return;
            }
            const faithRating = Math.max(1, Math.min(5, Number(form.querySelector("[name='faithRating']")?.value || 1)));
            const maximum = Math.ceil(faithRating / 2);
            const offeredFaith = Math.max(0, Math.min(maximum, Number(form.querySelector("[name='offeredFaith']")?.value || 0)));
            const entries = this._pactEntries();
            const pact = {
              id: existing?.id || foundry.utils.randomID(),
              name,
              faithRating,
              offeredFaith,
              gift: String(form.querySelector("[name='gift']")?.value || "").trim(),
              terms: String(form.querySelector("[name='terms']")?.value || "").trim(),
              active: existing?.active ?? true,
              lastCollected: existing?.lastCollected || ""
            };
            if (existing) entries.splice(entries.findIndex(entry => String(entry.id) === String(existing.id)), 1, pact);
            else entries.push(pact);
            await this.actor.update({ "system.pacts.entries": entries });
            if (!existing) await this.actor.changeResource("resources.faith", -1, `Закрепление договора: ${name}`);
            await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: this.actor }), content: `<article class="vtm-chat-card demon-chat-card"><h2>${existing ? "Договор изменён" : "Договор заключён"}</h2><p><b>${escape(name)}</b> · Вера ${faithRating} · предложено ${offeredFaith}/${maximum} в день.</p></article>` });
            resolve(true);
          }
        },
        cancel: { label: game.i18n.localize("Cancel"), callback: () => resolve(false) }
      },
      default: "create",
      close: () => resolve(false)
    }, { width: 680, classes: ["demon-roll-dialog-window", "demon-pact-dialog-window"] }).render(true));
  }

  async _deletePact(pactId = "") {
    const entries = this._pactEntries();
    const pact = entries.find(entry => String(entry.id) === String(pactId));
    if (!pact) return false;
    const confirmed = await new Promise(resolve => new DialogV1({ title: "Разорвать договор", content: `<p>Удалить договор с <b>${foundry.utils.escapeHTML(pact.name)}</b>? Это действие нельзя отменить.</p>`, buttons: { remove: { label: "Разорвать", callback: () => resolve(true) }, cancel: { label: game.i18n.localize("Cancel"), callback: () => resolve(false) } }, default: "cancel", close: () => resolve(false) }, { width: 440, classes: ["demon-roll-dialog-window", "demon-pact-dialog-window"] }).render(true));
    if (!confirmed) return false;
    await this.actor.update({ "system.pacts.entries": entries.filter(entry => String(entry.id) !== String(pactId)) });
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: this.actor }), content: `<article class="vtm-chat-card demon-chat-card"><h2>Договор разорван</h2><p>${foundry.utils.escapeHTML(pact.name)}</p></article>` });
    return true;
  }

  async _collectPactFaith() {
    const today = new Date().toLocaleDateString("sv-SE");
    const entries = this._pactEntries();
    let total = 0;
    const sources = [];
    for (const pact of entries) {
      if (!pact.active || String(pact.lastCollected || "") === today) continue;
      const maximum = Math.ceil(Math.max(1, Math.min(5, Number(pact.faithRating || 1))) / 2);
      const offered = Math.max(0, Math.min(maximum, Number(pact.offeredFaith || 0)));
      if (offered <= 0) continue;
      total += offered;
      pact.lastCollected = today;
      sources.push(`${pact.name}: ${offered}`);
    }
    if (total <= 0) {
      ui.notifications?.info?.("Сегодня доступной предложенной Веры нет.");
      return false;
    }
    await this.actor.update({ "system.pacts.entries": entries });
    await this.actor.changeResource("resources.faith", total, `Предложенная Вера на рассвете · ${sources.join(", ")}`);
    return true;
  }

  async _openHarvestFaithDialog() {
    const content = `<form class="demon-harvest-dialog">
      <div class="form-group"><label>Сила Воли смертного</label><input type="number" name="mortalWillpower" value="3" min="1" max="10"></div>
      <div class="form-group"><label>Урожай при победе</label><select name="faithYield"><option value="1">1 Вера · обычно</option><option value="2">2 Веры · сильное влияние, по решению Рассказчика</option></select></div>
      <div class="form-group"><label>Как демон открыл смертному истину</label><textarea name="approach" placeholder="Героизм, утешение, страх, чудо..."></textarea></div>
      <p class="hint">Встречные броски Силы Воли демона и смертного, сложность 7. Ничья не приносит Веры.</p>
    </form>`;
    return new Promise(resolve => new DialogV1({
      title: "Жатва Веры",
      content,
      buttons: {
        harvest: {
          icon: '<i class="fas fa-sun"></i>',
          label: "Провести Жатву",
          callback: async html => {
            const form = this._getFormElement(html);
            const mortalWillpower = Math.max(1, Math.min(10, Number(form?.querySelector("[name='mortalWillpower']")?.value || 3)));
            const faithYield = Math.max(1, Math.min(2, Number(form?.querySelector("[name='faithYield']")?.value || 1)));
            const approach = String(form?.querySelector("[name='approach']")?.value || "").trim();
            const demonWillpower = Math.max(1, Number(this.actor.system?.resources?.willpower?.max || this.actor.system?.resources?.willpower?.value || 1));
            const demonRoll = await rollDicePool({ actor: this.actor, pool: demonWillpower, basePool: demonWillpower, difficulty: 7, label: "Жатва Веры: демон" });
            const mortalRoll = await rollDicePool({ pool: mortalWillpower, basePool: mortalWillpower, difficulty: 7, label: "Жатва Веры: смертный" });
            const won = demonRoll.successes > mortalRoll.successes;
            if (won) await this.actor.changeResource("resources.faith", faithYield, `Жатва Веры${approach ? `: ${approach}` : ""}`);
            const summary = `<article class="vtm-chat-card demon-chat-card"><h2><i class="fas fa-sun"></i> Жатва Веры</h2><p><b>Демон:</b> ${demonRoll.successes} усп. · <b>смертный:</b> ${mortalRoll.successes} усп.</p><p><b>${won ? `Получено Веры: ${faithYield}` : "Жатва не удалась"}</b></p>${approach ? `<p>${foundry.utils.escapeHTML(approach)}</p>` : ""}</article>`;
            await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: this.actor }), content: summary, flags: { "vtm-revised": { type: "faithHarvest", won, faithYield } } });
            resolve(won);
          }
        },
        cancel: { label: game.i18n.localize("Cancel"), callback: () => resolve(false) }
      },
      default: "harvest",
      close: () => resolve(false)
    }, { width: 620, classes: ["demon-roll-dialog-window", "demon-harvest-dialog-window"] }).render(true));
  }

  async _openInvocationDialog({ loreKey = "", loreLabel = "Знание", rating = 0 } = {}) {
    const invocations = getAvailableDemonInvocations(loreKey, rating);
    if (!invocations.length) {
      ui.notifications?.warn?.(`${loreLabel}: нет доступных Обращений.`);
      return false;
    }

    const escape = foundry.utils.escapeHTML;
    const options = invocations.map(invocation =>
      `<option value="${Number(invocation.level)}">${"●".repeat(Number(invocation.level))} ${escape(invocation.name)}</option>`
    ).join("");
    const target = this._selectedCombatTargetActor({ notify: false });
    const content = `<form class="demon-invocation-dialog">
      <div class="form-group"><label>Обращение</label><select name="level" data-vtm-searchable-select="true">${options}</select></div>
      <div class="demon-invocation-target"><b>Цель:</b> ${escape(target?.name || "не выбрана")}</div>
      <label class="demon-roll-effect-option"><input type="checkbox" name="forceHighTorment"><span><b>Намеренно применить высокую Муку</b><small>Добавит 1 временную Муку после применения.</small></span></label>
      <label class="demon-roll-effect-option"><input type="checkbox" name="useResistance" ${target ? "" : "disabled"}><span><b>Встречное сопротивление цели</b><small class="demon-invocation-resistance-note">Если оно предусмотрено текстом Обращения.</small></span></label>
      <label class="demon-roll-effect-option"><input type="checkbox" name="applyEffect" ${target ? "checked" : "disabled"}><span><b>Наложить активный эффект на цель</b><small>Эффект появится на цели и сохранит описание и длительность.</small></span></label>
      <div class="grid grid-2 demon-invocation-controls"><label>Сложность сопротивления<input type="number" name="resistanceDifficulty" min="2" max="10" value="6"></label><label>Длительность<input type="text" name="duration" placeholder="Сцена, ход, день…"></label></div>
      <div class="demon-invocation-preview"></div>
    </form>`;

    return new Promise(resolve => {
      const dialog = new DialogV1({
        title: `${loreLabel}: Обращения`,
        content,
        buttons: {
          use: {
            icon: '<i class="fas fa-wand-sparkles"></i>',
            label: "Применить",
            callback: async html => {
              const form = this._getFormElement(html);
              const level = Number(form?.querySelector("[name='level']")?.value || 1);
              const forceHighTorment = Boolean(form?.querySelector("[name='forceHighTorment']")?.checked);
              const useResistance = Boolean(form?.querySelector("[name='useResistance']")?.checked);
              const applyEffect = Boolean(form?.querySelector("[name='applyEffect']")?.checked);
              const resistanceDifficulty = Number(form?.querySelector("[name='resistanceDifficulty']")?.value || 6);
              const duration = String(form?.querySelector("[name='duration']")?.value || "").trim();
              resolve(await this._useInvocation({ loreKey, loreLabel, level, forceHighTorment, targetActor: target, useResistance, applyEffect, resistanceDifficulty, duration }));
            }
          },
          cancel: { label: game.i18n.localize("Cancel"), callback: () => resolve(false) }
        },
        default: "use",
        close: () => resolve(false),
        render: html => {
          const root = html?.[0] ?? html;
          const select = root?.querySelector?.("[name='level']");
          const update = () => {
            const invocation = invocations.find(entry => Number(entry.level) === Number(select?.value));
            const preview = root?.querySelector?.(".demon-invocation-preview");
            if (!invocation || !preview) return;
            preview.innerHTML = `<h3>${escape(invocation.name)}</h3><p>${escape(invocation.description || "")}</p><p><b>Система:</b> ${escape(invocation.system || "")}</p>${invocation.torment ? `<p><b>Высокая Мука:</b> ${escape(invocation.torment)}</p>` : ""}`;
            const resistance = root?.querySelector?.("[name='useResistance']");
            const resistanceNote = root?.querySelector?.(".demon-invocation-resistance-note");
            const resistanceDifficulty = root?.querySelector?.("[name='resistanceDifficulty']");
            const duration = root?.querySelector?.("[name='duration']");
            if (resistance) resistance.checked = Boolean(target && invocation.resistanceTrait);
            if (resistanceNote) resistanceNote.textContent = invocation.resistanceTrait ? `Автоопределено: ${invocation.resistanceTrait}, сложность ${invocation.resistanceDifficulty}.` : "В тексте не найден встречный бросок; можно включить вручную (Сила Воли).";
            if (resistanceDifficulty) resistanceDifficulty.value = String(invocation.resistanceDifficulty || 6);
            if (duration) duration.value = invocation.duration || "";
          };
          select?.addEventListener("change", update);
          update();
          enhanceActorRollSearchSelects(root);
        }
      }, { width: 620, classes: ["demon-invocation-dialog-window"] });
      dialog.render(true);
    });
  }

  _invocationResistanceValue(actor, trait = "resource.willpower") {
    const path = trait === "resource.willpower" ? "resources.willpower" : trait.replace(/^attribute\./, "attributes.").replace(/^ability\./, "abilities.");
    const raw = foundry.utils.getProperty(actor.system, path);
    if (typeof raw === "number") return raw;
    if (raw && typeof raw === "object") return Number(raw.value ?? raw.max ?? 0);
    return 0;
  }

  async _applyInvocationActiveEffect(target, { invocation, loreKey, loreLabel, highTorment, duration, successes }) {
    if (!target?.createEmbeddedDocuments) return null;
    if (!target.isOwner && !game.user?.isGM) {
      ui.notifications?.warn?.(`Нет прав для наложения эффекта на ${target.name}. Результат останется в чате.`);
      return null;
    }
    const description = highTorment ? invocation.torment : invocation.description;
    const [effect] = await target.createEmbeddedDocuments("ActiveEffect", [{
      name: `${invocation.name} — ${this.actor.name}`,
      img: "icons/magic/symbols/circle-ouroboros.webp",
      disabled: false,
      changes: [],
      duration: {},
      description: String(description || invocation.system || ""),
      flags: { "vtm-revised": { type: "automationEffect", sourceType: "demonInvocation", sourceActorUuid: this.actor.uuid, loreKey, loreLabel, level: invocation.level, highTorment, duration: duration || invocation.duration || "По тексту Обращения", scope: "manual", target: "", diceModifier: 0, difficultyModifier: 0, notes: String(description || invocation.system || ""), successes } }
    }]);
    return effect;
  }

  async _useInvocation({ loreKey = "", loreLabel = "Знание", level = 1, forceHighTorment = false, targetActor = null, useResistance = false, applyEffect = false, resistanceDifficulty = 6, duration = "" } = {}) {
    const invocation = getAvailableDemonInvocations(loreKey, level).find(entry => Number(entry.level) === Number(level));
    if (!invocation) return false;
    if (invocation.faithCost > Number(this.actor.system?.resources?.faith?.value || 0)) {
      ui.notifications?.warn?.(`${invocation.name}: недостаточно временной Веры (${this.actor.system?.resources?.faith?.value || 0}/${invocation.faithCost}).`);
      return false;
    }

    const rolled = await this._openRollDialog({
      firstTrait: invocation.firstTrait || `lore.${loreKey}`,
      secondTrait: invocation.secondTrait,
      difficulty: invocation.difficulty,
      label: `${invocation.name} (${loreLabel})`
    });
    if (!rolled) return false;

    if (invocation.faithCost > 0) {
      await this.actor.changeResource("resources.faith", -invocation.faithCost, invocation.name);
    }
    if (forceHighTorment) {
      await this.actor.changeResource("resources.torment", 1, `${invocation.name}: высокая Мука`);
    }

    const torment = Number(this.actor.system?.resources?.torment?.max || 0);
    let resistance = null;
    if (useResistance && targetActor) {
      const trait = invocation.resistanceTrait || "resource.willpower";
      const pool = Math.max(1, this._invocationResistanceValue(targetActor, trait));
      resistance = await rollDicePool({ actor: targetActor, pool, basePool: pool, difficulty: Math.max(2, Math.min(10, Number(resistanceDifficulty || invocation.resistanceDifficulty || 6))), label: `Сопротивление: ${invocation.name}`, components: [{ label: trait, value: pool }] });
    }
    const netSuccesses = Math.max(0, Number(rolled.successes || 0) - Number(resistance?.successes || 0));
    const succeeded = netSuccesses > 0 && !rolled.botch;
    const tormentTriggered = torment > 0 && Array.from(rolled.dice ?? []).some(value => Number(value) <= torment);
    const highTorment = succeeded && (forceHighTorment || tormentTriggered);
    const outcome = rolled.botch ? "Провал" : (!succeeded ? "Неудача" : (highTorment ? "Высокая Мука" : "Обычный эффект"));
    const effect = succeeded ? (highTorment ? invocation.torment : invocation.description) : "Обращение не сработало.";
    const content = `<article class="vtm-chat-card demon-chat-card demon-invocation-card">
      <h2><i class="fas fa-wand-sparkles"></i> ${foundry.utils.escapeHTML(invocation.name)}</h2>
      <p><b>${foundry.utils.escapeHTML(loreLabel)}</b> · ${"●".repeat(Number(invocation.level))}</p>
      <p><b>Результат:</b> ${outcome} (${Number(rolled.successes || 0)} усп.${resistance ? ` − сопротивление ${Number(resistance.successes || 0)} = ${netSuccesses}` : ""}; постоянная Мука ${torment}${tormentTriggered ? ", сработала" : ""})</p>
      ${targetActor ? `<p><b>Цель:</b> ${foundry.utils.escapeHTML(targetActor.name)}</p>` : ""}
      ${duration ? `<p><b>Длительность:</b> ${foundry.utils.escapeHTML(duration)}</p>` : ""}
      <p>${foundry.utils.escapeHTML(effect || invocation.description || "")}</p>
      <p><b>Система:</b> ${foundry.utils.escapeHTML(invocation.system || "")}</p>
    </article>`;
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content,
      flags: { "vtm-revised": { type: "demonInvocation", actorId: this.actor.id, loreKey, level, highTorment } }
    });
    if (succeeded && applyEffect && targetActor) await this._applyInvocationActiveEffect(targetActor, { invocation, loreKey, loreLabel, highTorment, duration, successes: netSuccesses });
    return { ...rolled, resistance, netSuccesses, highTorment, tormentTriggered };
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
    const mode = this._portraitMode();
    const image = this._portraitPath(mode);
    const title = `${this.actor.name || "Демон"} · ${this._portraitLabel(mode)}`;

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

    const mode = this._portraitMode();
    const current = this._portraitPath(mode);
    const picker = new FilePickerClass({
      type: "image",
      current,
      document: this.actor,
      callback: async path => this._setActorPortrait(path, { notify: true, mode }),
      position: {
        top: (this.position?.top ?? 100) + 40,
        left: (this.position?.left ?? 100) + 10
      }
    });

    if (typeof picker.browse === "function") await picker.browse(current);
    else if (typeof picker.render === "function") picker.render(true);
  }

  _portraitMode() {
    const mode = String(this.actor.system?.profile?.avatarMode || "human");
    return ["human", "partial", "apocalyptic"].includes(mode) ? mode : "human";
  }

  _portraitLabel(mode = this._portraitMode()) {
    return { human: "Человеческий облик", partial: "Частичная апокалиптическая форма", apocalyptic: "Полная апокалиптическая форма" }[mode] || "Человеческий облик";
  }

  _portraitPath(mode = this._portraitMode()) {
    const profile = this.actor.system?.profile ?? {};
    if (mode === "partial") return profile.partialAvatar || "icons/svg/mystery-man.svg";
    if (mode === "apocalyptic") return profile.apocalypticAvatar || "icons/svg/mystery-man.svg";
    return profile.avatar || this.actor.img || "icons/svg/mystery-man.svg";
  }

  async _setActorPortrait(path, { notify = false, mode = this._portraitMode() } = {}) {
    const image = String(path || "icons/svg/mystery-man.svg").trim() || "icons/svg/mystery-man.svg";
    const update = mode === "partial"
      ? { "system.profile.partialAvatar": image }
      : mode === "apocalyptic"
        ? { "system.profile.apocalypticAvatar": image }
        : { img: image, "system.profile.avatar": image };
    await this.actor.update(update);
    if (notify) ui.notifications?.info?.(`${this._portraitLabel(mode)}: портрет обновлён.`);
    return image;
  }

  async _syncPrototypeTokenImage() {
    const image = this._portraitPath();
    await this.actor.update({ "prototypeToken.texture.src": image });
    ui.notifications?.info?.(`Изображение токена синхронизировано: ${this._portraitLabel()}.`);
    return image;
  }

  static async _onSubmitForm(event, form, formData) {
    const actor = this.document;
    if (!actor) return;

    await actor.update(formData.object);
  }
}
