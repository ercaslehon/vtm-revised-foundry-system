import { VTM_REVISED } from "../config.mjs";
import { DEMON_CATALOGS } from "../data/demon/demon-catalogs.mjs";
import { DEMON_ARCHETYPES } from "../data/demon/demon-archetypes.mjs";
import { DEMON_APOCALYPTIC_FORMS } from "../data/demon/demon-apocalyptic-forms.mjs";
import { DEMON_ABILITY_CATEGORIES, DEMON_ABILITY_LABELS } from "../data/demon/demon-abilities.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const STEPS = [
  ["identity", "Основа персонажа"],
  ["attributes", "Характеристики 7/5/3"],
  ["abilities", "Способности 13/9/5"],
  ["advantages", "Преимущества"],
  ["freebies", "Свободные очки"],
  ["biographies", "Биографии (необязательно)"],
  ["apocalypticForm", "Апокалиптическая форма"],
  ["summary", "Проверка готовности"]
];

const ATTRIBUTE_LABELS = {
  physical: "Физические", social: "Социальные", mental: "Ментальные",
  strength: "Сила", dexterity: "Ловкость", stamina: "Выносливость",
  charisma: "Обаяние", manipulation: "Манипулирование", appearance: "Внешность",
  perception: "Восприятие", intelligence: "Интеллект", wits: "Сообразительность"
};
const ABILITY_LABELS = DEMON_ABILITY_LABELS;
const BACKGROUND_LABELS = {
  allies: "Союзники", contacts: "Контакты", eminence: "Высокое положение", fame: "Слава",
  followers: "Последователи", influence: "Влияние", legacy: "Наследие", mentor: "Наставник",
  pacts: "Договоры", paragon: "Совершенство", resources: "Ресурсы"
};
const VIRTUE_LABELS = { conscience: "Совесть", conviction: "Убеждённость", courage: "Мужество" };

const sum = values => values.reduce((total, value) => total + Number(value || 0), 0);
const numericCost = value => Number(String(value ?? 0).match(/\d+/)?.[0] || 0);
const formatAbilityList = values => (values ?? []).map(value => `• ${value}`).join("\n\n");
const canonicalFormUpdate = primaryLore => {
  const form = DEMON_APOCALYPTIC_FORMS[primaryLore];
  if (!form) return null;
  const label = DEMON_CATALOGS.lores.find(entry => entry.key === primaryLore)?.label ?? primaryLore;
  return {
    "system.apocalypticForm.name": form.name,
    "system.apocalypticForm.description": form.description,
    "system.apocalypticForm.lowTorment": formatAbilityList(form.abilities),
    "system.apocalypticForm.highTorment": `${form.tormentDescription}\n\n${formatAbilityList(form.highTormentAbilities)}`,
    "system.apocalypticForm.mechanics": `Основное Знание: ${label}. Апокалиптическая форма определяется Основным Знанием.`
  };
};

function buildChecklist(actor) {
  const rules = VTM_REVISED.demonRules.characterCreation;
  const system = actor.system ?? {};
  const attributeRows = Object.entries(VTM_REVISED.attributeCategories).map(([key, traits]) => ({
    key, points: sum(traits.map(trait => Math.max(0, Number(foundry.utils.getProperty(actor, `system.attributes.${key}.${trait}`) || 0) - 1)))
  }));
  const abilityRows = Object.entries(DEMON_ABILITY_CATEGORIES).map(([key, traits]) => ({
    key, points: sum(traits.map(trait => foundry.utils.getProperty(actor, `system.abilities.${key}.${trait}.value`)))
  }));
  const attributeTotals = attributeRows.map(row => row.points).sort((a, b) => b - a);
  const abilityTotals = abilityRows.map(row => row.points).sort((a, b) => b - a);
  const attributeTargets = Object.values(rules.attributePriorityDots);
  const abilityTargets = Object.values(rules.abilityPriorityDots);
  const abilityOverCap = [];
  for (const [group, traits] of Object.entries(DEMON_ABILITY_CATEGORIES)) {
    for (const trait of traits) {
      const value = Number(foundry.utils.getProperty(actor, `system.abilities.${group}.${trait}.value`) || 0);
      if (value > rules.abilityCreationCap) abilityOverCap.push(`${ABILITY_LABELS[trait] || trait} ${value}`);
    }
  }
  const backgroundTotal = sum(Object.values(system.backgrounds ?? {}).map(value => value?.value));
  const loreTotal = sum(DEMON_CATALOGS.lores.map(entry => system.lores?.[entry.key]?.value));
  const houseRule = VTM_REVISED.demonRules.houses.find(entry => entry.key === system.profile?.house);
  const primaryLore = system.creation?.primaryLore;
  const primaryLoreValue = Number(system.lores?.[primaryLore]?.value || 0);
  const highestLoreValue = Math.max(0, ...DEMON_CATALOGS.lores.map(entry => Number(system.lores?.[entry.key]?.value || 0)));
  const primaryLoreValid = Boolean(primaryLore && houseRule?.houseLores.includes(primaryLore) && primaryLoreValue === highestLoreValue);
  const virtueValues = Object.values(system.virtues ?? {}).map(Number);
  const virtueBonus = sum(virtueValues.map(value => Math.max(0, value - rules.virtueBaseDots)));
  const expectedWillpower = [...virtueValues].sort((a, b) => b - a).slice(0, 2).reduce((a, b) => a + b, 0);
  const willpower = Number(system.resources?.willpower?.max || system.resources?.willpower?.value || 0);
  const faith = Number(system.resources?.faith?.value || 0);
  const initialTorment = Number(houseRule?.initialTorment || 0);
  const permanentTorment = Number(system.resources?.torment?.max || 0);
  const temporaryTorment = Number(system.resources?.torment?.value || 0);
  const selections = actor.getFlag?.("vtm-revised", "demonSelections") ?? {};
  const selectionCosts = actor.getFlag?.("vtm-revised", "demonSelectionCosts") ?? {};
  const featureTotal = type => sum((selections[type] ?? []).map(key => {
    const configured = Number(selectionCosts[type]?.[key]);
    return Number.isFinite(configured) && configured > 0 ? configured : numericCost(DEMON_CATALOGS[type]?.find(entry => entry.key === key)?.cost);
  }));
  const meritPoints = featureTotal("merits");
  const flawPoints = featureTotal("flaws");
  const creditedFlawPoints = Math.min(7, flawPoints);
  const excess = {
    attribute: sum(attributeTotals.map((value, index) => Math.max(0, value - attributeTargets[index]))),
    ability: sum(abilityTotals.map((value, index) => Math.max(0, value - abilityTargets[index]))),
    lore: Math.max(0, loreTotal - rules.loreDots), background: Math.max(0, backgroundTotal - rules.backgroundsDots),
    faith: Math.max(0, faith - rules.faithInitial), virtue: Math.max(0, virtueBonus - rules.virtueBonusDots),
    willpower: Math.max(0, willpower - Math.max(3, expectedWillpower))
  };
  const costs = Object.fromEntries(Object.entries(excess).map(([key, value]) => [key, value * Number(rules.freebieCosts[key] || 0)]));
  costs.merits = meritPoints;
  const spent = sum(Object.values(costs));
  const pool = Number(system.creation?.freebiePool ?? rules.freebiePoints);
  const remaining = pool + creditedFlawPoints - spent;
  const freebieRows = [
    { label: "Достоинства", display: `${meritPoints}`, costDisplay: `-${costs.merits}` },
    { label: "Недостатки (макс. 7)", display: `${flawPoints}`, costDisplay: `+${creditedFlawPoints}` },
    { label: `Атрибут (${rules.freebieCosts.attribute})`, display: `${excess.attribute} × ${rules.freebieCosts.attribute}`, costDisplay: `-${costs.attribute}` },
    { label: `Способность (${rules.freebieCosts.ability})`, display: `${excess.ability} × ${rules.freebieCosts.ability}`, costDisplay: `-${costs.ability}` },
    { label: `Знание (${rules.freebieCosts.lore})`, display: `${excess.lore} × ${rules.freebieCosts.lore}`, costDisplay: `-${costs.lore}` },
    { label: `Дополнение (${rules.freebieCosts.background})`, display: `${excess.background} × ${rules.freebieCosts.background}`, costDisplay: `-${costs.background}` },
    { label: `Вера (${rules.freebieCosts.faith})`, display: `${excess.faith} × ${rules.freebieCosts.faith}`, costDisplay: `-${costs.faith}` },
    { label: `Добродетель (${rules.freebieCosts.virtue})`, display: `${excess.virtue} × ${rules.freebieCosts.virtue}`, costDisplay: `-${costs.virtue}` },
    { label: `Сила воли (${rules.freebieCosts.willpower})`, display: `${excess.willpower} × ${rules.freebieCosts.willpower}`, costDisplay: `-${costs.willpower}` }
  ];
  const makeRow = (label, actual, expected, ok, warning = "") => ({ label, actual, expected, ok, warning, status: ok ? "ok" : "warn", icon: ok ? "✓" : "!" });
  const rows = [
    makeRow("Характеристики", attributeTotals.join(" / "), attributeTargets.join(" / "), attributeTotals.every((v, i) => v === attributeTargets[i])),
    makeRow("Способности", abilityTotals.join(" / "), abilityTargets.join(" / "), abilityTotals.every((v, i) => v === abilityTargets[i])),
    makeRow("Способности не выше 3", abilityOverCap.length ? abilityOverCap.join(", ") : "нарушений нет", "не выше 3", !abilityOverCap.length),
    makeRow("Дополнения", backgroundTotal, rules.backgroundsDots, backgroundTotal === rules.backgroundsDots),
    makeRow("Знания", loreTotal, rules.loreDots, loreTotal === rules.loreDots),
    makeRow("Основное Знание", primaryLore ? (DEMON_CATALOGS.lores.find(entry => entry.key === primaryLore)?.label ?? primaryLore) : "не выбрано", "Знание Дома с наивысшим значением", primaryLoreValid),
    makeRow("Добродетели", virtueBonus, rules.virtueBonusDots, virtueBonus === rules.virtueBonusDots),
    makeRow("Вера", faith, rules.faithInitial, faith === rules.faithInitial),
    makeRow("Постоянная Мука", permanentTorment, initialTorment || "по Дому", Boolean(initialTorment) && permanentTorment === initialTorment),
    makeRow("Временная Мука", temporaryTorment, 0, temporaryTorment === 0),
    makeRow("Недостатки", flawPoints, "не более 7", flawPoints <= 7, flawPoints > 7 ? "Недостатки сверх 7 очков не дают свободных очков." : ""),
    makeRow("Сила Воли", willpower, expectedWillpower, willpower === expectedWillpower, rules.willpowerRule)
  ];
  return { rows, freebieRows, remaining, pool, spent, flawPoints, creditedFlawPoints, meritPoints, negative: remaining < 0, valid: rows.every(row => row.ok) && remaining >= 0 };
}

export class VTMDemonCharacterCreationWizard extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "vtm-revised-demon-character-creation-wizard-{id}",
    classes: ["vtm-revised", "creation-wizard", "demon-creation-wizard"],
    position: { width: 1400, height: 860 }, window: { resizable: true }
  };
  static PARTS = { wizard: { template: "systems/vtm-revised/templates/apps/demon-character-creation-wizard.hbs", scrollable: [".vtm-wizard-main"] } };

  constructor({ actor } = {}, options = {}) {
    super(options);
    this.actor = actor;
    this.stepIndex = 0;
    this.attributePriority = { physical: 7, social: 5, mental: 3 };
    this.abilityPriority = { talents: 13, skills: 9, knowledges: 5 };
  }
  get title() { return `Создание демона · ${this.actor?.name ?? ""}`.trim(); }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const stepKey = STEPS[this.stepIndex]?.[0] ?? "identity";
    const selections = this.actor.getFlag?.("vtm-revised", "demonSelections") ?? {};
    const selectionCosts = this.actor.getFlag?.("vtm-revised", "demonSelectionCosts") ?? {};
    const selected = type => new Set(selections[type] ?? []);
    const houseRule = VTM_REVISED.demonRules.houses.find(entry => entry.key === this.actor.system?.profile?.house);
    const houseLoreOptions = DEMON_CATALOGS.lores.filter(entry => houseRule?.houseLores.includes(entry.key));
    const storedPrimaryLore = this.actor.system?.creation?.primaryLore;
    const primaryLore = houseRule?.houseLores.includes(storedPrimaryLore)
      ? storedPrimaryLore
      : [...houseLoreOptions].sort((a, b) => Number(this.actor.system?.lores?.[b.key]?.value || 0) - Number(this.actor.system?.lores?.[a.key]?.value || 0))[0]?.key ?? "";
    const canonicalForm = DEMON_APOCALYPTIC_FORMS[primaryLore];
    const formValue = (key, fallback = "") => this.actor.system?.apocalypticForm?.[key] || fallback;
    const apocalypticForm = {
      name: formValue("name", canonicalForm?.name),
      description: formValue("description", canonicalForm?.description),
      lowTorment: formValue("lowTorment", formatAbilityList(canonicalForm?.abilities)),
      highTorment: formValue("highTorment", canonicalForm ? `${canonicalForm.tormentDescription}\n\n${formatAbilityList(canonicalForm.highTormentAbilities)}` : ""),
      mechanics: formValue("mechanics", canonicalForm ? `Основное Знание: ${DEMON_CATALOGS.lores.find(entry => entry.key === primaryLore)?.label ?? primaryLore}. Апокалиптическая форма определяется Основным Знанием.` : "")
    };
    const recommendedLoreKeys = new Set([...(houseRule?.houseLores ?? []), "fundament", "humanity"]);
    const activeLoreKeys = DEMON_CATALOGS.lores.filter(entry => Number(this.actor.system?.lores?.[entry.key]?.value || 0) > 0).map(entry => entry.key);
    const visibleLoreKeys = new Set([...recommendedLoreKeys, ...activeLoreKeys]);
    const selectedLores = DEMON_CATALOGS.lores.filter(entry => visibleLoreKeys.has(entry.key)).map(entry => ({ ...entry, recommended: recommendedLoreKeys.has(entry.key), value: Number(this.actor.system?.lores?.[entry.key]?.value || 0) }));
    const selectedLoreKeys = new Set(selectedLores.map(entry => entry.key));
    const featureContext = type => {
      const chosen = selected(type);
      const decorate = entry => ({ ...entry, variableCost: String(entry.cost).includes("–") || String(entry.cost).includes("-"), effectiveCost: Number(selectionCosts[type]?.[entry.key]) || numericCost(entry.cost) });
      return {
        available: DEMON_CATALOGS[type].filter(entry => !chosen.has(entry.key)).map(decorate),
        selected: DEMON_CATALOGS[type].filter(entry => chosen.has(entry.key)).map(decorate)
      };
    };
    const meritContext = featureContext("merits");
    const flawContext = featureContext("flaws");
    return {
      ...context, actor: this.actor, system: this.actor.system, stepKey,
      steps: STEPS.map(([key, title], index) => ({ key, title, index, active: index === this.stepIndex, done: index < this.stepIndex })),
      isFirst: this.stepIndex === 0, isLast: this.stepIndex === STEPS.length - 1,
      checklist: buildChecklist(this.actor),
      houses: DEMON_CATALOGS.houses, factions: DEMON_CATALOGS.factions, archetypes: DEMON_ARCHETYPES,
      initialTorment: Number(houseRule?.initialTorment || 0),
      attributeGroups: this._traitGroups(VTM_REVISED.attributeCategories, ATTRIBUTE_LABELS, "attributes", false, this.attributePriority),
      abilityGroups: this._traitGroups(DEMON_ABILITY_CATEGORIES, ABILITY_LABELS, "abilities", true, this.abilityPriority),
      backgrounds: Object.keys(BACKGROUND_LABELS).map(key => ({ key, label: BACKGROUND_LABELS[key], value: Number(this.actor.system?.backgrounds?.[key]?.value || 0) })),
      backgroundTotal: sum(Object.values(this.actor.system?.backgrounds ?? {}).map(value => value?.value)),
      backgroundTarget: VTM_REVISED.demonRules.characterCreation.backgroundsDots,
      virtues: Object.keys(VIRTUE_LABELS).map(key => ({ key, label: VIRTUE_LABELS[key], value: Number(this.actor.system?.virtues?.[key] || 0) })),
      virtueTotal: sum(Object.keys(VIRTUE_LABELS).map(key => Math.max(0, Number(this.actor.system?.virtues?.[key] || 0) - VTM_REVISED.demonRules.characterCreation.virtueBaseDots))),
      virtueTarget: VTM_REVISED.demonRules.characterCreation.virtueBonusDots,
      loreTotal: sum(DEMON_CATALOGS.lores.map(entry => this.actor.system?.lores?.[entry.key]?.value)),
      loreTarget: VTM_REVISED.demonRules.characterCreation.loreDots,
      hasHouseLores: Boolean(houseRule), loreOptions: DEMON_CATALOGS.lores.filter(entry => !selectedLoreKeys.has(entry.key)), selectedLores,
      houseLoreOptions, primaryLore, primaryLoreLabel: DEMON_CATALOGS.lores.find(entry => entry.key === primaryLore)?.label ?? primaryLore, canonicalForm, apocalypticForm,
      meritsAvailable: meritContext.available, meritsSelected: meritContext.selected,
      flawsAvailable: flawContext.available, flawsSelected: flawContext.selected
    };
  }

  _traitGroups(categories, labels, root, named, priorities) {
    return Object.entries(categories).map(([group, keys]) => ({ group, label: labels[group], target: priorities[group],
      total: sum(keys.map(key => Math.max(0, Number(foundry.utils.getProperty(this.actor, `system.${root}.${group}.${key}${named ? ".value" : ""}`) || 0) - (named ? 0 : 1)))),
      traits: keys.map(key => ({ key, label: labels[key] || key, value: Number(foundry.utils.getProperty(this.actor, `system.${root}.${group}.${key}${named ? ".value" : ""}`) || 0), path: `system.${root}.${group}.${key}${named ? ".value" : ""}` }))
    }));
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const root = this.element;
    const move = async index => { await this._save(); this.stepIndex = Math.max(0, Math.min(STEPS.length - 1, index)); await this.render({ force: true }); };
    root.querySelectorAll(".wizard-step-button").forEach(button => button.addEventListener("click", event => { event.preventDefault(); move(Number(button.dataset.step)); }));
    root.querySelector(".wizard-prev")?.addEventListener("click", event => { event.preventDefault(); move(this.stepIndex - 1); });
    root.querySelector(".wizard-next")?.addEventListener("click", event => { event.preventDefault(); move(this.stepIndex + 1); });
    root.querySelector(".wizard-save")?.addEventListener("click", async event => { event.preventDefault(); await this._save(true); });
    root.querySelector(".wizard-finish")?.addEventListener("click", async event => { event.preventDefault(); await this._save(true); await this.close(); });
    root.querySelectorAll(".wizard-trait-group").forEach(group => {
      const updateTotal = () => {
        const base = Number(group.dataset.traitBase || 0);
        const total = sum([...group.querySelectorAll("input[type='number']")].map(input => Math.max(0, Number(input.value || 0) - base)));
        const target = Number(group.dataset.traitTarget ?? group.querySelector(".wizard-priority-select")?.value ?? 0);
        const fact = group.querySelector(".wizard-fact");
        if (fact) fact.textContent = `${total}/${target}`;
      };
      group.querySelectorAll("input[type='number']").forEach(input => input.addEventListener("input", updateTotal));
    });
    root.querySelectorAll(".wizard-priority-select").forEach(select => select.addEventListener("change", async () => {
      await this._save();
      (select.dataset.type === "attribute" ? this.attributePriority : this.abilityPriority)[select.dataset.group] = Number(select.value);
      await this.render({ force: true });
    }));
    root.querySelector(".wizard-fix-willpower")?.addEventListener("click", async event => { event.preventDefault(); const values = Object.values(this.actor.system?.virtues ?? {}).map(Number).sort((a,b) => b-a); const value = sum(values.slice(0,2)); await this.actor.update({ "system.resources.willpower.value": value, "system.resources.willpower.max": value }); await this.render({ force: true }); });
    root.querySelector("[name='system.profile.house']")?.addEventListener("change", async event => {
      await this._save();
      const house = VTM_REVISED.demonRules.houses.find(entry => entry.key === event.currentTarget.value);
      await this.actor.update({
        "system.creation.primaryLore": "",
        "system.resources.torment.max": Number(house?.initialTorment || 0),
        "system.resources.torment.value": 0
      });
      await this.render({ force: true });
    });
    root.querySelector("[name='system.creation.primaryLore']")?.addEventListener("change", async event => {
      await this._save();
      const update = canonicalFormUpdate(event.currentTarget.value);
      if (update) await this.actor.update(update);
      await this.render({ force: true });
    });
    root.querySelectorAll(".demon-wizard-reference").forEach(button => button.addEventListener("click", event => { event.preventDefault(); this._openReference(button.dataset.catalog, button.dataset.key || root.querySelector(button.dataset.select)?.value); }));
    root.querySelectorAll(".demon-wizard-remove-lore").forEach(button => button.addEventListener("click", async event => { event.preventDefault(); await this.actor.update({ [`system.lores.${button.dataset.key}.value`]: 0 }); await this.render({ force: true }); }));
    root.querySelectorAll(".demon-wizard-add-feature").forEach(button => button.addEventListener("click", async event => { event.preventDefault(); await this._save(); const type = button.dataset.catalog; const key = root.querySelector(`[name='wizard.${type}Key']`)?.value; if (key) await this._addFeature(type, key); await this.render({ force: true }); }));
    root.querySelectorAll(".demon-wizard-remove-feature").forEach(button => button.addEventListener("click", async event => { event.preventDefault(); await this._save(); await this._removeFeature(button.dataset.catalog, button.dataset.key); await this.render({ force: true }); }));
    root.querySelectorAll(".demon-wizard-feature-cost").forEach(input => input.addEventListener("change", async () => { await this._save(); await this._setFeatureCost(input.dataset.catalog, input.dataset.key, input.value); await this.render({ force: true }); }));
    root.querySelector(".demon-wizard-reset-apocalyptic")?.addEventListener("click", async event => {
      event.preventDefault();
      const update = canonicalFormUpdate(this.actor.system?.creation?.primaryLore);
      if (!update) return ui.notifications?.warn?.("Сначала выбери Основное Знание.");
      await this.actor.update(update);
      await this.render({ force: true });
    });
  }

  async _save(notify = false) {
    const form = this.element?.querySelector("form.vtm-character-wizard-form");
    if (!form) return;
    const update = {};
    for (const input of form.querySelectorAll("[name^='system.'], [name='name']")) {
      if (!input.disabled) update[input.name] = input.type === "number" ? Number(input.value || 0) : input.value;
    }
    const selectedHouse = update["system.profile.house"] ?? this.actor.system?.profile?.house;
    const houseRule = VTM_REVISED.demonRules.houses.find(entry => entry.key === selectedHouse);
    if (houseRule) update["system.resources.torment.max"] = Number(houseRule.initialTorment || 0);
    if (Object.keys(update).length) await this.actor.update(update);
    if (notify) ui.notifications?.info?.("Изменения мастера создания демона сохранены");
  }

  async _addFeature(catalog, key) {
    const selections = foundry.utils.deepClone(this.actor.getFlag?.("vtm-revised", "demonSelections") ?? {});
    selections[catalog] = [...new Set([...(selections[catalog] ?? []), key])];
    await this.actor.setFlag("vtm-revised", "demonSelections", selections);
    if (catalog === "merits" && key === "natural-aptitude") await this._chooseNaturalAptitude();
  }

  async _chooseNaturalAptitude() {
    const options = Object.entries(DEMON_ABILITY_CATEGORIES).flatMap(([group, keys]) => keys.map(key =>
      `<option value="ability.${group}.${key}">${foundry.utils.escapeHTML(ABILITY_LABELS[key] || key)}</option>`
    )).join("");
    const content = `<form class="vtm-searchable-dialog"><label>Способность для «Природной склонности»<select name="trait" data-vtm-searchable="true">${options}</select></label></form>`;
    const DialogV1 = foundry.appv1?.api?.Dialog ?? globalThis.Dialog;
    await new Promise(resolve => new DialogV1({ title: "Природная склонность", content, buttons: {
      save: { label: "Сохранить", callback: async html => {
        const value = html?.[0]?.querySelector?.("[name='trait']")?.value || html?.querySelector?.("[name='trait']")?.value;
        const stored = foundry.utils.deepClone(this.actor.getFlag?.("vtm-revised", "demonSelectionOptions") ?? {});
        if (value) await this.actor.setFlag("vtm-revised", "demonSelectionOptions", { ...stored, "natural-aptitude": value });
        resolve();
      }}, cancel: { label: "Позже", callback: resolve }
    }, default: "save", close: resolve }, { width: 520 }).render(true));
  }

  async _removeFeature(catalog, key) {
    const selections = foundry.utils.deepClone(this.actor.getFlag?.("vtm-revised", "demonSelections") ?? {});
    selections[catalog] = (selections[catalog] ?? []).filter(value => value !== key);
    await this.actor.setFlag("vtm-revised", "demonSelections", selections);
  }

  async _setFeatureCost(catalog, key, rawValue) {
    const entry = DEMON_CATALOGS[catalog]?.find(item => item.key === key);
    const limits = String(entry?.cost ?? "").match(/\d+/g)?.map(Number) ?? [1];
    const value = Math.max(limits[0], Math.min(limits.at(-1), Number(rawValue) || limits[0]));
    const costs = foundry.utils.deepClone(this.actor.getFlag?.("vtm-revised", "demonSelectionCosts") ?? {});
    costs[catalog] = { ...(costs[catalog] ?? {}), [key]: value };
    await this.actor.setFlag("vtm-revised", "demonSelectionCosts", costs);
  }

  _openReference(catalog, key) {
    let entry = (DEMON_CATALOGS[catalog] ?? []).find(item => item.key === key);
    if (!entry && catalog === "archetypes") entry = DEMON_ARCHETYPES.find(item => item.name === key);
    if (!entry && catalog === "backgrounds") {
      const rule = VTM_REVISED.demonRules.backgrounds.find(item => item.key === key);
      if (rule) entry = { ...rule, label: BACKGROUND_LABELS[key] || key, summary: rule.hint };
    }
    if (!entry) return ui.notifications?.warn?.("Сначала выбери запись справочника.");
    const escape = value => foundry.utils.escapeHTML(String(value ?? ""));
    const mechanics = entry.mechanics || entry.regain || "";
    const content = `<article class="demon-reference-card"><header><h2>${escape(entry.label || entry.name)}</h2>${entry.cost !== undefined ? `<strong class="demon-reference-cost">${escape(entry.cost)} очк.</strong>` : ""}</header><section><h3>Описание</h3><p>${escape(entry.summary || entry.hint || "Описание пока не заполнено.")}</p></section>${mechanics ? `<section><h3>Механика</h3><p>${escape(mechanics)}</p></section>` : ""}</article>`;
    const DialogV1 = foundry.appv1?.api?.Dialog ?? globalThis.Dialog;
    new DialogV1({ title: entry.label || entry.name, content, buttons: { close: { label: "Закрыть" } }, default: "close" }, { width: 540, classes: ["demon-reference-dialog-window"] }).render(true);
  }
}
