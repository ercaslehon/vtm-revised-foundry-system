import { VTM_REVISED } from "../config.mjs";
import { VTMClanCard, findClanItemForName } from "./clan-card.mjs";
import { VTMDisciplineCard } from "./discipline-card.mjs";
import { VTMMeritFlawCard } from "./merit-flaw-card.mjs";
import { VTMArchetypeCard, findArchetypeForName } from "./archetype-card.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

function normalizeName(value = "") {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replaceAll("ё", "е")
    .replace(/[\s_\-]+/g, " ");
}

function escapeHtml(value = "") {
  return foundry.utils.escapeHTML(String(value ?? ""));
}

function getFormElement(htmlOrElement) {
  if (htmlOrElement instanceof HTMLFormElement) return htmlOrElement;
  if (htmlOrElement instanceof HTMLElement) return htmlOrElement.querySelector("form") ?? htmlOrElement;
  if (htmlOrElement?.[0] instanceof HTMLElement) return htmlOrElement[0].querySelector("form") ?? htmlOrElement[0];
  if (htmlOrElement?.find) return htmlOrElement.find("form")?.[0] ?? htmlOrElement[0];
  return null;
}

const STEP_KEYS = ["clan", "attributes", "abilities", "advantages", "freebies", "summary"];
const STEP_TITLES = {
  clan: "Клан и основа",
  attributes: "Характеристики 7/5/3",
  abilities: "Способности 13/9/5",
  advantages: "Дисциплины, факты и добродетели",
  freebies: "Свободные очки, достоинства и недостатки",
  summary: "Проверка готовности"
};

const ATTRIBUTE_TARGETS = [7, 5, 3];
const ABILITY_TARGETS = [13, 9, 5];

const DEFAULT_BACKGROUNDS = [
  "Союзники", "Контакты", "Слава", "Поколение", "Стадо", "Влияние", "Наставник", "Ресурсы", "Слуги", "Статус"
];

function generationCapsForActor(actor) {
  return actor?.generationCaps
    ?? actor?.constructor?.generationCaps?.(actor.system?.profile?.generation)
    ?? VTM_REVISED.generationOptions.find(option => option.key === "13")
    ?? { key: "13", label: "13", traitMax: 5, bloodMax: 10, bloodPerTurn: 1 };
}

function sum(values) {
  return values.reduce((total, value) => total + Number(value || 0), 0);
}

function statusFor({ ok = false, warn = false } = {}) {
  if (ok) return "ok";
  if (warn) return "warn";
  return "info";
}

function buildChecklistForActor(actor) {
  const system = actor.system ?? {};
  const attributeTotalsByGroup = Object.entries(VTM_REVISED.attributeCategories).map(([group, keys]) => {
    const points = sum(keys.map(key => Math.max(0, Number(foundry.utils.getProperty(actor, `system.attributes.${group}.${key}`) || 0) - 1)));
    return { group, label: game.i18n.localize(`VTM_REVISED.AttributeGroup.${group}`), points };
  });
  const attributeSorted = attributeTotalsByGroup.map(row => row.points).sort((a, b) => b - a);
  const attributeOver = attributeSorted.some((value, index) => value > ATTRIBUTE_TARGETS[index]);
  const attributeOk = attributeSorted.every((value, index) => value === ATTRIBUTE_TARGETS[index]);
  const attributeExcess = sum(attributeSorted.map((value, index) => Math.max(0, value - ATTRIBUTE_TARGETS[index])));

  const abilityTotalsByGroup = Object.entries(VTM_REVISED.abilityCategories).map(([group, keys]) => {
    const points = sum(keys.map(key => Number(foundry.utils.getProperty(actor, `system.abilities.${group}.${key}.value`) || 0)));
    return { group, label: game.i18n.localize(`VTM_REVISED.AbilityGroup.${group}`), points };
  });
  const abilitySorted = abilityTotalsByGroup.map(row => row.points).sort((a, b) => b - a);
  const abilityOver = abilitySorted.some((value, index) => value > ABILITY_TARGETS[index]);
  const abilityOk = abilitySorted.every((value, index) => value === ABILITY_TARGETS[index]);
  const abilityExcess = sum(abilitySorted.map((value, index) => Math.max(0, value - ABILITY_TARGETS[index])));

  const abilityOverThree = [];
  for (const [group, keys] of Object.entries(VTM_REVISED.abilityCategories)) {
    for (const key of keys) {
      const value = Number(foundry.utils.getProperty(actor, `system.abilities.${group}.${key}.value`) || 0);
      if (value > 3) abilityOverThree.push(`${game.i18n.localize(`VTM_REVISED.Ability.${key}`)} ${value}`);
    }
  }

  const items = Array.from(actor.items ?? []);
  const disciplineTotal = sum(items.filter(item => item.type === "discipline").map(item => Number(item.system?.rating || 0)));
  const backgroundTotal = sum(items.filter(item => item.type === "background").map(item => Number(item.system?.rating || 0)));
  const virtueRaw = {
    conscience: Number(system.virtues?.conscience || 0),
    selfControl: Number(system.virtues?.selfControl || 0),
    courage: Number(system.virtues?.courage || 0)
  };
  const virtueCreationTotal = Math.max(0, virtueRaw.conscience - 1) + Math.max(0, virtueRaw.selfControl - 1) + Math.max(0, virtueRaw.courage - 1);
  const humanityExpected = virtueRaw.conscience + virtueRaw.selfControl;
  const humanityActual = Number(system.resources?.humanity?.value || 0);
  const willpowerExpected = virtueRaw.courage;
  const willpowerActual = Number(system.resources?.willpower?.max || system.resources?.willpower?.value || 0);
  const bloodActual = Number(system.resources?.blood?.value || 0);
  const meritPoints = sum(items.filter(item => item.type === "merit").map(item => Number(item.system?.points || 0)));
  const flawPoints = sum(items.filter(item => item.type === "flaw").map(item => Number(item.system?.points || 0)));

  const disciplineExcess = Math.max(0, disciplineTotal - 3);
  const backgroundExcess = Math.max(0, backgroundTotal - 5);
  const virtueExcess = Math.max(0, virtueCreationTotal - 7);
  const humanityExcess = Math.max(0, humanityActual - humanityExpected);
  const willpowerExcess = Math.max(0, willpowerActual - willpowerExpected);
  const freebiePool = Number(system.creation?.freebiePool ?? 15);
  const costs = {
    merits: meritPoints,
    flaws: flawPoints,
    attributes: attributeExcess * 5,
    abilities: abilityExcess * 2,
    disciplines: disciplineExcess * 7,
    backgrounds: backgroundExcess * 1,
    virtues: virtueExcess * 2,
    humanity: humanityExcess * 2,
    willpower: willpowerExcess * 1
  };
  const spent = costs.merits + costs.attributes + costs.abilities + costs.disciplines + costs.backgrounds + costs.virtues + costs.humanity + costs.willpower;
  const remaining = freebiePool + costs.flaws - spent;

  const row = ({ label, detail, ok, warn, warning = "" }) => ({
    label,
    detail,
    warning,
    status: statusFor({ ok, warn }),
    icon: ok ? "✓" : (warn ? "!" : "•")
  });

  const formatSorted = values => values.join("/");
  const groupDetails = rows => rows.map(r => `${r.label}: ${r.points}`).join("; ");

  const baseRows = [
    row({ label: "Точки по характеристикам", detail: `цель 7/5/3, факт ${formatSorted(attributeSorted)} (${groupDetails(attributeTotalsByGroup)})`, ok: attributeOk, warn: attributeOver, warning: attributeOver ? "Превышение уйдёт в свободные очки." : "" }),
    row({ label: "Точки по способностям", detail: `цель 13/9/5, факт ${formatSorted(abilitySorted)} (${groupDetails(abilityTotalsByGroup)})`, ok: abilityOk, warn: abilityOver, warning: abilityOver ? "Превышение уйдёт в свободные очки." : "" }),
    row({ label: "Не больше 3 точек на способность", detail: abilityOverThree.length ? abilityOverThree.join(", ") : "нарушений нет", ok: !abilityOverThree.length, warn: Boolean(abilityOverThree.length), warning: abilityOverThree.length ? "На первичном этапе способность не должна быть выше 3." : "" }),
    row({ label: "3 точки в дисциплинах", detail: `факт ${disciplineTotal}`, ok: disciplineTotal === 3, warn: disciplineTotal > 3, warning: disciplineTotal > 3 ? "Лишнее считается свободными очками по 7." : "" }),
    row({ label: "5 точек в фактах биографии", detail: `факт ${backgroundTotal}`, ok: backgroundTotal === 5, warn: backgroundTotal > 5, warning: backgroundTotal > 5 ? "Лишнее считается свободными очками по 1." : "" }),
    row({ label: "7 точек в добродетелях", detail: `факт ${virtueCreationTotal}`, ok: virtueCreationTotal === 7, warn: virtueCreationTotal > 7, warning: virtueCreationTotal > 7 ? "Лишнее считается свободными очками по 2." : "" }),
    row({ label: "Человечность = Совесть + Самоконтроль", detail: `${virtueRaw.conscience} + ${virtueRaw.selfControl} = ${humanityExpected}, факт ${humanityActual}`, ok: humanityActual === humanityExpected, warn: humanityActual !== humanityExpected, warning: humanityActual !== humanityExpected ? "Можно исправить кнопкой." : "" }),
    row({ label: "Сила Воли = Смелость", detail: `ожидается ${willpowerExpected}, факт ${willpowerActual}`, ok: willpowerActual === willpowerExpected, warn: willpowerActual !== willpowerExpected, warning: willpowerActual !== willpowerExpected ? "Можно исправить кнопкой." : "" }),
    row({ label: "Запас крови = бросок d10", detail: `факт ${bloodActual}`, ok: bloodActual >= 1 && bloodActual <= 10, warn: bloodActual < 1 || bloodActual > 10, warning: "Кнопка d10 есть на шаге добродетелей." })
  ];

  const freebieRows = [
    { label: "Достоинства", display: `${meritPoints}`, costDisplay: `-${costs.merits}` },
    { label: "Недостатки", display: `${flawPoints}`, costDisplay: `+${costs.flaws}`, warning: flawPoints > 7 ? "Недостатков больше чем на 7 пунктов. Можно нарушить, но система ворчит." : "" },
    { label: "Характеристика (5)", display: `${attributeExcess} × 5`, costDisplay: `-${costs.attributes}` },
    { label: "Способность (2)", display: `${abilityExcess} × 2`, costDisplay: `-${costs.abilities}` },
    { label: "Дисциплина (7)", display: `${disciplineExcess} × 7`, costDisplay: `-${costs.disciplines}` },
    { label: "Факт биографии (1)", display: `${backgroundExcess} × 1`, costDisplay: `-${costs.backgrounds}` },
    { label: "Добродетель (2)", display: `${virtueExcess} × 2`, costDisplay: `-${costs.virtues}` },
    { label: "Человечность/Путь (2)", display: `${humanityExcess} × 2`, costDisplay: `-${costs.humanity}` },
    { label: "Сила Воли (1)", display: `${willpowerExcess} × 1`, costDisplay: `-${costs.willpower}` }
  ];

  return {
    attributeTotalsByGroup,
    abilityTotalsByGroup,
    baseRows,
    freebie: { freebiePool, rows: freebieRows, spent, remaining, negative: remaining < 0, flawPoints, meritPoints },
    costs,
    totals: { disciplineTotal, backgroundTotal, virtueCreationTotal, humanityExpected, humanityActual, willpowerExpected, willpowerActual, bloodActual }
  };
}

export class VTMCharacterCreationWizard extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "vtm-revised-character-creation-wizard-{id}",
    classes: ["vtm-revised", "creation-wizard"],
    position: { width: 980, height: 860 },
    window: { resizable: true }
  };

  static PARTS = {
    wizard: {
      template: "systems/vtm-revised/templates/apps/character-creation-wizard.hbs",
      scrollable: [".vtm-wizard-main"]
    }
  };

  constructor({ actor } = {}, options = {}) {
    super(options);
    this.actor = actor;
    this.stepIndex = 0;
    this.attributePriority = { physical: 7, social: 5, mental: 3 };
    this.abilityPriority = { talents: 13, skills: 9, knowledges: 5 };
  }

  get title() {
    return `Создание персонажа · ${this.actor?.name ?? ""}`.trim();
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.actor;
    const checklist = buildChecklistForActor(actor);
    const stepKey = STEP_KEYS[this.stepIndex] ?? STEP_KEYS[0];
    const steps = STEP_KEYS.map((key, index) => ({ key, index, title: STEP_TITLES[key], active: index === this.stepIndex, done: index < this.stepIndex }));

    return {
      ...context,
      actor,
      system: actor.system,
      config: VTM_REVISED,
      steps,
      stepKey,
      stepTitle: STEP_TITLES[stepKey],
      stepIndex: this.stepIndex,
      isFirst: this.stepIndex <= 0,
      isLast: this.stepIndex >= STEP_KEYS.length - 1,
      checklist,
      selectedClan: findClanItemForName(actor.system?.profile?.clan),
      selectedNature: findArchetypeForName(actor.system?.profile?.nature),
      selectedDemeanor: findArchetypeForName(actor.system?.profile?.demeanor),
      generationCaps: generationCapsForActor(actor),
      generationOptions: VTM_REVISED.generationOptions,
      clanOptions: VTM_REVISED.clanOptions,
      attributeGroups: this._attributeGroups(),
      abilityGroups: this._abilityGroups(),
      disciplineItems: this._actorItems("discipline"),
      backgroundItems: this._actorItems("background"),
      meritItems: this._actorItems("merit"),
      flawItems: this._actorItems("flaw"),
      disciplineCatalog: this._disciplineCatalogOptions(),
      backgroundCatalog: this._backgroundCatalogOptions(),
      meritCatalog: this._catalogOptions("merit"),
      flawCatalog: this._catalogOptions("flaw"),
      attributePriorityOptions: this._priorityOptions(ATTRIBUTE_TARGETS),
      abilityPriorityOptions: this._priorityOptions(ABILITY_TARGETS)
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const element = this.element;
    if (!element) return;

    element.querySelectorAll(".wizard-step-button").forEach(button => {
      button.addEventListener("click", async event => {
        event.preventDefault();
        await this._saveVisibleForm();
        this.stepIndex = Number(button.dataset.step || 0);
        await this.render({ force: true });
      });
    });

    element.querySelector(".wizard-prev")?.addEventListener("click", async event => {
      event.preventDefault();
      await this._saveVisibleForm();
      this.stepIndex = Math.max(0, this.stepIndex - 1);
      await this.render({ force: true });
    });

    element.querySelector(".wizard-next")?.addEventListener("click", async event => {
      event.preventDefault();
      const previousStep = STEP_KEYS[this.stepIndex] ?? "";
      await this._saveVisibleForm();
      if (previousStep === "clan") await this._ensureClanDisciplinesFromSelectedClan();
      this.stepIndex = Math.min(STEP_KEYS.length - 1, this.stepIndex + 1);
      await this.render({ force: true });
    });

    element.querySelector(".wizard-save")?.addEventListener("click", async event => {
      event.preventDefault();
      await this._saveVisibleForm({ notify: true });
    });

    element.querySelector(".wizard-finish")?.addEventListener("click", async event => {
      event.preventDefault();
      await this._saveVisibleForm({ notify: true });
      await this.close();
    });

    element.querySelector(".wizard-clan-card")?.addEventListener("click", async event => {
      event.preventDefault();
      const select = element.querySelector("[name='system.profile.clan']");
      const clanName = select?.value || this.actor.system?.profile?.clan || "";
      const clan = findClanItemForName(clanName);
      await new VTMClanCard({ actor: this.actor, clan }).render({ force: true });
    });

    element.querySelectorAll(".wizard-archetype-card").forEach(button => {
      button.addEventListener("click", async event => {
        event.preventDefault();
        const kind = button.dataset.kind === "demeanor" ? "demeanor" : "nature";
        const selector = kind === "demeanor" ? "[name='system.profile.demeanor']" : "[name='system.profile.nature']";
        const value = element.querySelector(selector)?.value || (kind === "demeanor" ? this.actor.system?.profile?.demeanor : this.actor.system?.profile?.nature) || "";
        if (!value) {
          ui.notifications?.warn?.(kind === "demeanor" ? "Сначала выбери Маску." : "Сначала выбери Натуру.");
          return;
        }
        await new VTMArchetypeCard({ actor: this.actor, archetype: findArchetypeForName(value), kind }).render({ force: true });
      });
    });

    element.querySelectorAll("[name^='system.'], [name='name']").forEach(input => {
      input.addEventListener("change", async event => {
        await this._saveVisibleForm();
        if (input.name === "system.profile.clan") await this._ensureClanDisciplinesFromSelectedClan();
        if (input.name === "system.profile.generation") await this.actor.applyGenerationCaps?.(input.value, { clampTraits: false, notify: false });
        await this.render({ force: true });
      });
    });

    element.querySelectorAll(".wizard-priority-select").forEach(select => {
      select.addEventListener("change", event => {
        const type = select.dataset.priorityType;
        const group = select.dataset.group;
        const value = Number(select.value || 0);
        if (type === "attribute") this.attributePriority[group] = value;
        if (type === "ability") this.abilityPriority[group] = value;
        this.render({ force: true });
      });
    });

    element.querySelector(".wizard-fix-humanity")?.addEventListener("click", async event => {
      event.preventDefault();
      await this._fixHumanity();
      await this.render({ force: true });
    });

    element.querySelector(".wizard-fix-willpower")?.addEventListener("click", async event => {
      event.preventDefault();
      await this._fixWillpower();
      await this.render({ force: true });
    });

    element.querySelector(".wizard-roll-blood")?.addEventListener("click", async event => {
      event.preventDefault();
      await this._rollBloodPool();
      await this.render({ force: true });
    });

    element.querySelector(".wizard-add-discipline")?.addEventListener("click", async event => {
      event.preventDefault();
      await this._addSelectedCatalogItem("discipline", element.querySelector("[name='wizard.disciplineId']")?.value, Number(element.querySelector("[name='wizard.disciplineRating']")?.value || 1));
      await this.render({ force: true });
    });

    element.querySelector(".wizard-add-background")?.addEventListener("click", async event => {
      event.preventDefault();
      await this._addSelectedCatalogItem("background", element.querySelector("[name='wizard.backgroundId']")?.value, Number(element.querySelector("[name='wizard.backgroundRating']")?.value || 1));
      await this.render({ force: true });
    });

    element.querySelector(".wizard-add-merit")?.addEventListener("click", async event => {
      event.preventDefault();
      await this._addSelectedCatalogItem("merit", element.querySelector("[name='wizard.meritId']")?.value, null);
      await this.render({ force: true });
    });

    element.querySelector(".wizard-add-flaw")?.addEventListener("click", async event => {
      event.preventDefault();
      await this._addSelectedCatalogItem("flaw", element.querySelector("[name='wizard.flawId']")?.value, null);
      await this.render({ force: true });
    });

    element.querySelectorAll(".wizard-open-discipline").forEach(button => {
      button.addEventListener("click", async event => {
        event.preventDefault();
        const item = this.actor.items.get(button.dataset.itemId);
        if (item?.type === "discipline") await new VTMDisciplineCard({ actor: this.actor, discipline: item }).render({ force: true });
      });
    });

    element.querySelectorAll(".wizard-preview-merit-flaw").forEach(button => {
      button.addEventListener("click", async event => {
        event.preventDefault();
        const selector = button.dataset.type === "flaw" ? "[name='wizard.flawId']" : "[name='wizard.meritId']";
        const source = game.items.get(element.querySelector(selector)?.value);
        if (source) await new VTMMeritFlawCard({ actor: this.actor, item: source }).render({ force: true });
      });
    });

    element.querySelectorAll(".wizard-item-rating").forEach(input => {
      input.addEventListener("change", async event => {
        const item = this.actor.items.get(input.dataset.itemId);
        const field = input.dataset.field || "rating";
        if (item) await item.update({ [`system.${field}`]: Number(input.value || 0) });
        await this.render({ force: true });
      });
    });

    element.querySelectorAll(".wizard-delete-item").forEach(button => {
      button.addEventListener("click", async event => {
        event.preventDefault();
        const id = button.dataset.itemId;
        if (id) await this.actor.deleteEmbeddedDocuments("Item", [id]);
        await this.render({ force: true });
      });
    });

    element.querySelectorAll(".wizard-open-merit-flaw").forEach(button => {
      button.addEventListener("click", async event => {
        event.preventDefault();
        const item = this.actor.items.get(button.dataset.itemId);
        if (item) await new VTMMeritFlawCard({ actor: this.actor, item }).render({ force: true });
      });
    });
  }

  _attributeGroups() {
    const traitMax = Number(generationCapsForActor(this.actor).traitMax || 5);
    return Object.entries(VTM_REVISED.attributeCategories).map(([group, keys]) => ({
      group,
      label: game.i18n.localize(`VTM_REVISED.AttributeGroup.${group}`),
      target: this.attributePriority[group] ?? 0,
      total: sum(keys.map(key => Math.max(0, Number(foundry.utils.getProperty(this.actor, `system.attributes.${group}.${key}`) || 0) - 1))),
      traits: keys.map(key => {
        const value = Number(foundry.utils.getProperty(this.actor, `system.attributes.${group}.${key}`) || 0);
        return {
          key,
          path: `system.attributes.${group}.${key}`,
          label: game.i18n.localize(`VTM_REVISED.Attribute.${key}`),
          value,
          max: traitMax,
          overGeneration: value > traitMax
        };
      })
    }));
  }

  _abilityGroups() {
    const traitMax = Number(generationCapsForActor(this.actor).traitMax || 5);
    return Object.entries(VTM_REVISED.abilityCategories).map(([group, keys]) => ({
      group,
      label: game.i18n.localize(`VTM_REVISED.AbilityGroup.${group}`),
      target: this.abilityPriority[group] ?? 0,
      total: sum(keys.map(key => Number(foundry.utils.getProperty(this.actor, `system.abilities.${group}.${key}.value`) || 0))),
      traits: keys.map(key => {
        const value = Number(foundry.utils.getProperty(this.actor, `system.abilities.${group}.${key}.value`) || 0);
        return {
          key,
          path: `system.abilities.${group}.${key}.value`,
          label: game.i18n.localize(`VTM_REVISED.Ability.${key}`),
          value,
          max: traitMax,
          overThree: value > 3,
          overGeneration: value > traitMax
        };
      })
    }));
  }

  _actorItems(type) {
    return Array.from(this.actor.items ?? [])
      .filter(item => item.type === type)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  _priorityOptions(targets) {
    return targets.map(target => ({ value: target, label: String(target) }));
  }

  _catalogOptions(type) {
    const known = new Set(this._actorItems(type).map(item => normalizeName(item.name)));
    return Array.from(game.items ?? [])
      .filter(item => item.type === type)
      .filter(item => !known.has(normalizeName(item.name)))
      .sort((a, b) => {
        const pointsA = Number(a.system?.points || a.system?.rating || 0);
        const pointsB = Number(b.system?.points || b.system?.rating || 0);
        if (pointsA !== pointsB) return pointsA - pointsB;
        return a.name.localeCompare(b.name);
      })
      .map(item => ({ id: item.id, name: item.name, label: this._catalogLabel(item) }));
  }

  _disciplineCatalogOptions() {
    const imported = this._catalogOptions("discipline");
    if (imported.length) return imported;
    const known = new Set(this._actorItems("discipline").map(item => normalizeName(item.name)));
    return (VTM_REVISED.disciplineOptions ?? [])
      .filter(item => !known.has(normalizeName(item.name)))
      .map(item => ({ id: `config:${item.name}`, name: item.name, label: item.name }));
  }

  _backgroundCatalogOptions() {
    const imported = this._catalogOptions("background");
    if (imported.length) return imported;
    const known = new Set(this._actorItems("background").map(item => normalizeName(item.name)));
    return DEFAULT_BACKGROUNDS
      .filter(name => !known.has(normalizeName(name)))
      .map(name => ({ id: `config:${name}`, name, label: name }));
  }

  _clanDisciplineNames() {
    const clanName = this.actor.system?.profile?.clan || "";
    const clan = findClanItemForName(clanName);
    let raw = clan?.system?.disciplines || "";
    if (!raw) {
      const fallback = {
        "Бруха": "Стремительность, Могущество, Присутствие",
        "Гангрел": "Анимализм, Стойкость, Превращение",
        "Малкавиан": "Прорицание, Помешательство, Затемнение",
        "Носферату": "Анимализм, Затемнение, Могущество",
        "Тореадор": "Прорицание, Стремительность, Присутствие",
        "Тремер": "Прорицание, Доминирование, Тауматургия",
        "Вентру": "Доминирование, Стойкость, Присутствие",
        "Ласомбра": "Доминирование, Власть над Тенью, Могущество",
        "Цимисхи": "Прорицание, Изменчивость, Анимализм",
        "Ассамиты": "Стремительность, Затемнение, Смертоносность",
        "Последователи Сета": "Затемнение, Присутствие, Серпентис",
        "Джованни": "Доминирование, Некромантия, Могущество",
        "Равнос": "Анимализм, Стойкость, Химерия"
      };
      raw = fallback[clanName] || "";
    }
    return String(raw).split(/[,;]+/).map(part => part.trim()).filter(Boolean);
  }

  _findDisciplineCatalogItem(name = "") {
    const wanted = normalizeName(name);
    return Array.from(game.items ?? []).find(item => item.type === "discipline" && normalizeName(item.name) === wanted);
  }

  async _ensureClanDisciplinesFromSelectedClan() {
    const disciplineNames = this._clanDisciplineNames();
    if (!disciplineNames.length) return [];
    const existing = new Set(this._actorItems("discipline").map(item => normalizeName(item.name)));
    const docs = [];
    for (const name of disciplineNames) {
      if (existing.has(normalizeName(name))) continue;
      const source = this._findDisciplineCatalogItem(name);
      if (source) {
        const system = foundry.utils.deepClone(source.system ?? {});
        system.rating = 0;
        system.rawName = system.rawName || source.name;
        system.isHomebrew = false;
        docs.push({
          name: source.name,
          type: "discipline",
          img: source.img,
          system,
          flags: { "vtm-revised": { catalogSourceUuid: source.uuid, addedAsClanDisciplineAt: new Date().toISOString() } }
        });
      } else {
        docs.push({ name, type: "discipline", system: { rating: 0, rawName: name, isHomebrew: false } });
      }
      existing.add(normalizeName(name));
    }
    if (!docs.length) return [];
    const created = await this.actor.createEmbeddedDocuments("Item", docs);
    ui.notifications?.info?.(`Клановые дисциплины добавлены: ${created.map(item => item.name).join(", ")}`);
    return created;
  }

  _catalogLabel(item) {
    const parts = [];
    if (["merit", "flaw"].includes(item.type)) parts.push(`${Number(item.system?.points || 0)} п.`);
    if (item.system?.category) parts.push(item.system.category);
    parts.push(item.name);
    return parts.filter(Boolean).join(" · ");
  }

  async _saveVisibleForm({ notify = false } = {}) {
    const form = this.element?.querySelector("form.vtm-character-wizard-form");
    if (!form) return;
    const update = {};
    for (const input of form.querySelectorAll("[name^='system.'], [name='name']")) {
      if (input.disabled) continue;
      const value = input.type === "number" ? Number(input.value || 0) : input.value;
      update[input.name] = value;
    }
    if (Object.keys(update).length) await this.actor.update(update);
    if (notify) ui.notifications?.info?.("Изменения мастера создания сохранены");
  }

  async _addSelectedCatalogItem(type, selectedId, rating = null) {
    if (!selectedId) return;
    const existing = new Set(this._actorItems(type).map(item => normalizeName(item.name)));
    let data;
    if (selectedId.startsWith("config:")) {
      const name = selectedId.slice(7);
      if (existing.has(normalizeName(name))) return;
      data = { name, type, system: {} };
    } else {
      const source = game.items.get(selectedId);
      if (!source || existing.has(normalizeName(source.name))) return;
      data = {
        name: source.name,
        type: source.type,
        img: source.img,
        system: foundry.utils.deepClone(source.system ?? {}),
        flags: { "vtm-revised": { catalogSourceUuid: source.uuid, addedFromWizardAt: new Date().toISOString() } }
      };
    }
    if (["discipline", "background"].includes(type)) data.system.rating = Math.max(0, Math.min(10, Number(rating ?? data.system.rating ?? 1)));
    data.system.rawName = data.system.rawName || data.name;
    data.system.isHomebrew = data.system.isHomebrew ?? false;
    const created = await this.actor.createEmbeddedDocuments("Item", [data]);
    return created?.[0] ?? null;
  }

  async _fixHumanity() {
    const conscience = Number(this.actor.system?.virtues?.conscience || 0);
    const selfControl = Number(this.actor.system?.virtues?.selfControl || 0);
    const value = Math.max(0, Math.min(10, conscience + selfControl));
    await this.actor.update({ "system.resources.humanity.value": value, "system.resources.humanity.max": 10 });
  }

  async _fixWillpower() {
    const value = Math.max(0, Math.min(10, Number(this.actor.system?.virtues?.courage || 0)));
    await this.actor.update({ "system.resources.willpower.value": value, "system.resources.willpower.max": value });
  }

  async _rollBloodPool() {
    const roll = await (new Roll("1d10")).evaluate();
    const value = Number(roll.total || 1);
    const max = Number(this.actor.system?.resources?.blood?.max || this.actor.generationCaps?.bloodMax || 10);
    await this.actor.update({ "system.resources.blood.value": Math.min(value, max) });
    await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor: this.actor }), flavor: `Стартовый запас крови: ${Math.min(value, max)}` });
  }
}
