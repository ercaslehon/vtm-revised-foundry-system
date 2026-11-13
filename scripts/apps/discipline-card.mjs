import { healthPenalty, CONDITION_LABELS } from "../combat/vampire-health.mjs";
import { rollDicePool } from "../dice/dice-pool.mjs";
import { isFortitudeDiscipline, fortitudeRating, fortitudeSoakPool } from "../combat/fortitude-soak.mjs";
import { VTM_REVISED } from "../config.mjs";
import { applyAutomationCost, normalizeAutomationCost } from "../utils/automation-costs.mjs";
import { activeAutomationRollModifier, registerAutomationEffect } from "../utils/active-automation-effects.mjs";
import { isUneditedInventedRarePower, referenceDisplayItem, resolveReferenceItem } from "../import/catalog-reference-view.mjs";
import { ensureReferenceCatalogs } from "../import/catalog-reference-cache.mjs";
import { buildSystemData } from "../import/rules-json-importer.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const DialogV1 = foundry.appv1?.api?.Dialog ?? globalThis.Dialog;
const renderTemplateCompat = foundry.applications?.handlebars?.renderTemplate ?? globalThis.renderTemplate;

function normalizeName(value = "") {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replaceAll("ё", "е")
    .replace(/[\s_\-]+/g, " ");
}

const DISCIPLINE_NAME_EQUIVALENTS = [
  ["даймонион", "демонизм", "daimoinon", "daimonion"],
  ["духус", "шаманство", "spiritus"],
  ["obeah", "обеах"],
  ["valeren", "валерен"],
  ["превращение", "превращения", "протеан", "protean"],
  ["изменчивость", "метаморфозы", "метаморфоза", "висцисситуда", "висцисситуд", "vicissitude"],
  ["полёт", "полёт горгулий", "flight", "gargoyle_flight"]
].map(group => group.map(normalizeName));

function expandDisciplineNames(values = []) {
  const out = new Set();
  for (const value of values) {
    const normalized = normalizeName(value);
    if (!normalized) continue;
    out.add(normalized);
    for (const group of DISCIPLINE_NAME_EQUIVALENTS) {
      if (!group.includes(normalized)) continue;
      for (const alias of group) out.add(alias);
    }
  }
  return Array.from(out);
}

function splitAliases(value = "") {
  return String(value ?? "")
    .split(",")
    .map(part => part.trim())
    .filter(Boolean);
}

function itemDescription(item) {
  const desc = item?.system?.description ?? {};
  return desc.value || desc.system || desc.chat || "";
}

function matchParentDiscipline(power, discipline) {
  const parentNames = expandDisciplineNames([
    power?.system?.parentDiscipline,
    power?.system?.discipline,
    ...(splitAliases(power?.system?.aliases))
  ]);
  const disciplineNames = expandDisciplineNames([
    discipline?.name,
    discipline?.system?.rulesId,
    discipline?.system?.rawName,
    discipline?.system?.source,
    ...(splitAliases(discipline?.system?.aliases))
  ]);

  if (!parentNames.length || !disciplineNames.length) return false;
  return parentNames.some(parent => disciplineNames.includes(parent));
}


function matchDisciplineItem(candidate, discipline) {
  if (!candidate || !["discipline", "disciplinePath"].includes(candidate.type)) return false;
  if (discipline?.type && candidate.type !== discipline.type) return false;
  const candidateNames = expandDisciplineNames([
    candidate.name,
    candidate.system?.rulesId,
    candidate.system?.rawName,
    ...(splitAliases(candidate.system?.aliases))
  ]);
  const disciplineNames = expandDisciplineNames([
    discipline?.name,
    discipline?.system?.rulesId,
    discipline?.system?.rawName,
    discipline?.system?.source,
    ...(splitAliases(discipline?.system?.aliases))
  ]);
  return candidateNames.some(name => disciplineNames.includes(name));
}

function firstNonEmpty(...values) {
  return values.find(value => String(value ?? "").trim().length > 0) ?? "";
}

function interpolateMechanics(text = "", { actor, discipline, rating = 0, item } = {}) {
  const value = Number(rating || discipline?.system?.rating || 0);
  const totalActions = value > 0 ? value + 1 : 1;
  const blood = Number(actor?.system?.resources?.blood?.value ?? 0);
  const replacements = {
    rating: value,
    disciplineRating: value,
    extraActions: value,
    totalActions,
    actorName: actor?.name ?? "",
    disciplineName: discipline?.name ?? item?.system?.parentDiscipline ?? "",
    itemName: item?.name ?? "",
    blood
  };

  return String(text ?? "").replace(/\{(rating|disciplineRating|extraActions|totalActions|actorName|disciplineName|itemName|blood)\}/g, (_match, key) => String(replacements[key] ?? ""));
}

function uniqueItems(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = item.uuid ?? item.id ?? `${item.name}-${item.type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/**
 * Interactive discipline reference card.
 * Opens from an Actor sheet by clicking a Discipline. The card collects discipline powers
 * from the Actor embedded items and from world Item documents, then lets the user read
 * the descriptions and launch automated rolls/cost spending for the selected Actor.
 */
export class VTMDisciplineCard extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "vtm-revised-discipline-card-{id}",
    classes: ["vtm-revised", "discipline-card"],
    position: {
      width: 760,
      height: 760
    },
    window: {
      resizable: true
    }
  };

  static PARTS = {
    card: {
      template: "systems/vtm-revised/templates/apps/discipline-card.hbs",
      scrollable: [".vtm-discipline-card-body"]
    }
  };

  constructor({ actor, discipline } = {}, options = {}) {
    super(options);
    this.actor = actor;
    this.discipline = discipline;
  }

  get title() {
    const disciplineName = this.discipline?.name ?? game.i18n.localize("TYPES.Item.discipline");
    return `${disciplineName} · ${this.actor?.name ?? ""}`.trim();
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    await ensureReferenceCatalogs();
    const actorItems = Array.from(this.actor?.items ?? []);
    const worldItems = Array.from(game.items ?? []);
    const allItems = uniqueItems([...actorItems.map(item => referenceDisplayItem(item, worldItems, buildSystemData)), ...worldItems])
      .filter(item => !isUneditedInventedRarePower(item, buildSystemData));
    const rating = Number(this.discipline?.system?.rating || 0);
    const isEmbeddedDiscipline = Boolean(this.discipline?.parent === this.actor);
    const canEditRating = Boolean(isEmbeddedDiscipline && this.actor?.isOwner && ["discipline", "disciplinePath"].includes(this.discipline?.type));
    const libraryDiscipline = worldItems.find(item => item !== this.discipline && matchDisciplineItem(item, this.discipline));
    const displayDiscipline = referenceDisplayItem(this.discipline, worldItems, buildSystemData);
    const description = firstNonEmpty(itemDescription(displayDiscipline), itemDescription(libraryDiscipline));

    const powers = allItems
      .filter(item => item.type === "disciplinePower")
      .filter(item => matchParentDiscipline(item, this.discipline))
      .map(item => {
        const level = Number(item.system?.level || 0);
        const rawDescription = itemDescription(item);
        const rawSystemText = item.system?.description?.system || "";
        const rawChatText = item.system?.description?.chat || "";
        return {
          item,
          id: item.id,
          uuid: item.uuid,
          name: item.name,
          level,
          levelLabel: item.system?.levelLabel || "",
          available: rating <= 0 ? true : level <= rating,
          description: interpolateMechanics(rawDescription, { actor: this.actor, discipline: this.discipline, rating, item }),
          systemText: interpolateMechanics(rawSystemText, { actor: this.actor, discipline: this.discipline, rating, item }),
          chatText: interpolateMechanics(rawChatText, { actor: this.actor, discipline: this.discipline, rating, item }),
          costText: item.system?.automation?.cost?.text || item.system?.cost || "",
          rollLabel: item.system?.automation?.roll?.label || item.name,
          difficulty: Number(item.system?.automation?.roll?.difficulty || 0),
          firstTrait: item.system?.automation?.roll?.firstTrait || "",
          secondTrait: item.system?.automation?.roll?.secondTrait || "",
          sourceUrl: item.system?.audit?.sourceUrl || item.system?.automation?.source?.url || "",
          sourcePage: item.system?.audit?.sourcePage || item.system?.automation?.source?.page || "",
          sourceBook: item.system?.audit?.sourceBook || "",
          canUse: Boolean(this.actor?.isOwner),
          activation: interpolateMechanics(item.system?.mechanics?.activation || "", { actor: this.actor, discipline: this.discipline, rating, item }),
          duration: interpolateMechanics(item.system?.mechanics?.duration || "", { actor: this.actor, discipline: this.discipline, rating, item }),
          successScaling: interpolateMechanics(item.system?.mechanics?.successScaling || "", { actor: this.actor, discipline: this.discipline, rating, item }),
          resistance: interpolateMechanics(item.system?.mechanics?.resistance || "", { actor: this.actor, discipline: this.discipline, rating, item }),
          failure: interpolateMechanics(item.system?.mechanics?.failure || "", { actor: this.actor, discipline: this.discipline, rating, item }),
          botch: interpolateMechanics(item.system?.mechanics?.botch || "", { actor: this.actor, discipline: this.discipline, rating, item }),
          limits: interpolateMechanics(item.system?.mechanics?.limits || "", { actor: this.actor, discipline: this.discipline, rating, item }),
          automationNotes: interpolateMechanics(item.system?.mechanics?.automationNotes || "", { actor: this.actor, discipline: this.discipline, rating, item })
        };
      })
      .sort((a, b) => (a.level - b.level) || a.name.localeCompare(b.name));

    const paths = allItems
      .filter(item => item.type === "disciplinePath")
      .filter(item => matchParentDiscipline(item, this.discipline))
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      ...context,
      actor: this.actor,
      discipline: this.discipline,
      rating,
      canEditRating,
      isFortitude: this.actor?.type === "vampire" && isFortitudeDiscipline(this.discipline),
      canRollFortitude: Boolean(this.actor?.isOwner && fortitudeRating(this.actor, this.discipline) > 0),
      isEmbeddedDiscipline,
      description,
      powers,
      paths,
      hasPowers: powers.length > 0,
      editable: this.actor?.isOwner ?? false,
      config: VTM_REVISED
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const element = this.element;
    if (!element) return;

    element.querySelector(".discipline-fortitude-soak")?.addEventListener("click", async event => {
      event.preventDefault();
      await this._rollFortitudeSoak();
    });

    element.querySelectorAll(".discipline-rating-input").forEach(input => {
      input.addEventListener("change", async event => {
        event.preventDefault();
        if (!this.discipline || this.discipline.parent !== this.actor) return;
        const rating = Math.max(0, Math.min(10, Number(input.value || 0)));
        await this.discipline.update({ "system.rating": rating });
        ui.notifications?.info?.(game.i18n.format("VTM_REVISED.Discipline.RatingSaved", { rating }));
        this.render({ force: true });
      });
    });

    element.querySelectorAll(".discipline-power-use").forEach(button => {
      button.addEventListener("click", async event => {
        event.preventDefault();
        const uuid = button.dataset.itemUuid;
        const item = uuid ? await fromUuid(uuid) : null;
        if (item) await this._useItemAutomation(item);
      });
    });

    element.querySelectorAll(".discipline-power-edit").forEach(button => {
      button.addEventListener("click", async event => {
        event.preventDefault();
        const uuid = button.dataset.itemUuid;
        const item = uuid ? await fromUuid(uuid) : null;
        item?.sheet?.render(true);
      });
    });
  }

  _resolveHealthPenalty() {
    if (this.actor?.type === "vampire") {
      const result = healthPenalty(this.actor);
      return { ...result, label: result.condition !== "active" ? CONDITION_LABELS[result.condition] : game.i18n.localize(`VTM_REVISED.Health.${result.key === "extraBruised" ? "bruised" : result.key}`) };
    }
    const health = this.actor?.system?.health ?? {};
    const activeKey = [...VTM_REVISED.healthLevels]
      .reverse()
      .find(key => Number(health[key] || 0) > 0);

    if (!activeKey) {
      return {
        key: "healthy",
        value: 0,
        label: game.i18n.localize("VTM_REVISED.HealthPenalty.none"),
        incapacitated: false
      };
    }

    const rawPenalty = VTM_REVISED.healthPenalties[activeKey] ?? 0;
    const label = game.i18n.localize(`VTM_REVISED.Health.${activeKey}`);

    if (rawPenalty === "out") {
      return { key: activeKey, value: 0, label, incapacitated: true };
    }

    return { key: activeKey, value: Number(rawPenalty || 0), label, incapacitated: false };
  }

  _buildRollTraitOptions() {
    const options = [];
    const push = (key, label, value, group) => options.push({
      key,
      label,
      value: Number(value || 0),
      group,
      display: `${label} (${Number(value || 0)})`
    });

    for (const [group, keys] of Object.entries(VTM_REVISED.attributeCategories)) {
      for (const key of keys) {
        const label = game.i18n.localize(`VTM_REVISED.Attribute.${key}`);
        const value = foundry.utils.getProperty(this.actor, `system.attributes.${group}.${key}`);
        push(`attribute.${group}.${key}`, label, value, game.i18n.localize(`VTM_REVISED.AttributeGroup.${group}`));
      }
    }

    for (const [group, keys] of Object.entries(VTM_REVISED.abilityCategories)) {
      for (const key of keys) {
        const label = game.i18n.localize(`VTM_REVISED.Ability.${key}`);
        const value = foundry.utils.getProperty(this.actor, `system.abilities.${group}.${key}.value`);
        push(`ability.${group}.${key}`, label, value, game.i18n.localize(`VTM_REVISED.AbilityGroup.${group}`));
      }
    }

    push("virtue.conscience", game.i18n.localize("VTM_REVISED.Virtue.Conscience"), this.actor.system?.virtues?.conscience, game.i18n.localize("VTM_REVISED.Section.Virtues"));
    push("virtue.selfControl", game.i18n.localize("VTM_REVISED.Virtue.SelfControl"), this.actor.system?.virtues?.selfControl, game.i18n.localize("VTM_REVISED.Section.Virtues"));
    push("virtue.courage", game.i18n.localize("VTM_REVISED.Virtue.Courage"), this.actor.system?.virtues?.courage, game.i18n.localize("VTM_REVISED.Section.Virtues"));
    push("resource.willpower", game.i18n.localize("VTM_REVISED.Resource.Willpower"), this.actor.system?.resources?.willpower?.value, game.i18n.localize("VTM_REVISED.Section.Resources"));
    push("resource.humanity", game.i18n.localize("VTM_REVISED.Resource.Humanity"), this.actor.system?.resources?.humanity?.value, game.i18n.localize("VTM_REVISED.Section.Resources"));

    return options;
  }

  _resolveTraitOption(key) {
    if (!key) return null;
    const [type, group, trait] = String(key).split(".");

    if (type === "attribute") {
      const value = Number(foundry.utils.getProperty(this.actor, `system.attributes.${group}.${trait}`) || 0);
      return { key, label: game.i18n.localize(`VTM_REVISED.Attribute.${trait}`), value };
    }

    if (type === "ability") {
      const value = Number(foundry.utils.getProperty(this.actor, `system.abilities.${group}.${trait}.value`) || 0);
      return { key, label: game.i18n.localize(`VTM_REVISED.Ability.${trait}`), value };
    }

    if (type === "virtue") {
      const field = group;
      const labelKey = field === "selfControl" ? "SelfControl" : field.charAt(0).toUpperCase() + field.slice(1);
      const value = Number(foundry.utils.getProperty(this.actor, `system.virtues.${field}`) || 0);
      return { key, label: game.i18n.localize(`VTM_REVISED.Virtue.${labelKey}`), value };
    }

    if (type === "resource") {
      const resource = group;
      const labelKey = resource === "willpower" ? "Willpower" : "Humanity";
      const value = Number(foundry.utils.getProperty(this.actor, `system.resources.${resource}.value`) || 0);
      return { key, label: game.i18n.localize(`VTM_REVISED.Resource.${labelKey}`), value };
    }

    return null;
  }

  _buildRollSelectHtml(name, selected = "", includeEmpty = false) {
    const options = this._buildRollTraitOptions();
    const grouped = new Map();
    for (const option of options) {
      if (!grouped.has(option.group)) grouped.set(option.group, []);
      grouped.get(option.group).push(option);
    }

    const empty = includeEmpty ? `<option value="">${game.i18n.localize("VTM_REVISED.Roll.NoSecondTrait")}</option>` : "";
    const body = Array.from(grouped.entries()).map(([group, entries]) => {
      const inner = entries.map(option => {
        const isSelected = option.key === selected ? " selected" : "";
        return `<option value="${foundry.utils.escapeHTML(option.key)}"${isSelected}>${foundry.utils.escapeHTML(option.display)}</option>`;
      }).join("");
      return `<optgroup label="${foundry.utils.escapeHTML(group)}">${inner}</optgroup>`;
    }).join("");

    return `<select class="vtm-trait-roll-select" name="${name}" data-roll-field="${name}" data-vtm-searchable-select="true">${empty}${body}</select>`;
  }

  async _openRollDialog({ firstTrait = "", secondTrait = "", difficulty = 6, label = "" } = {}) {
    const content = `
      <form class="vtm-roll-dialog">
        <div class="form-group">
          <label>${game.i18n.localize("VTM_REVISED.Roll.FirstTrait")}</label>
          ${this._buildRollSelectHtml("firstTrait", firstTrait, false)}
        </div>
        <div class="form-group">
          <label>${game.i18n.localize("VTM_REVISED.Roll.SecondTrait")}</label>
          ${this._buildRollSelectHtml("secondTrait", secondTrait, true)}
        </div>
        <div class="form-group">
          <label>${game.i18n.localize("VTM_REVISED.Roll.Difficulty")}</label>
          <input type="number" name="difficulty" min="2" max="10" value="${Number(difficulty || 6)}"/>
        </div>
        <div class="form-group">
          <label>${game.i18n.localize("VTM_REVISED.Roll.Label")}</label>
          <input type="text" name="label" value="${foundry.utils.escapeHTML(label || game.i18n.localize("VTM_REVISED.Roll.Label"))}"/>
        </div>
      </form>`;

    return new Promise(resolve => {
      new DialogV1({
        title: game.i18n.localize("VTM_REVISED.Roll.DialogTitle"),
        content,
        buttons: {
          roll: {
            icon: '<i class="fas fa-dice-d10"></i>',
            label: game.i18n.localize("VTM_REVISED.Roll.RollButton"),
            callback: async html => {
              await this._rollFromForm(html);
              resolve(true);
            }
          },
          cancel: {
            label: game.i18n.localize("Cancel"),
            callback: () => resolve(false)
          }
        },
        default: "roll",
        close: () => resolve(false)
      }, { width: 460 }).render(true);
    });
  }

  _getFormElement(htmlOrElement) {
    if (htmlOrElement instanceof HTMLFormElement) return htmlOrElement;
    if (htmlOrElement instanceof HTMLElement) return htmlOrElement.querySelector("form") ?? htmlOrElement;
    if (htmlOrElement?.[0] instanceof HTMLElement) return htmlOrElement[0].querySelector("form") ?? htmlOrElement[0];
    if (htmlOrElement?.find) return htmlOrElement.find("form")?.[0] ?? htmlOrElement[0];
    return null;
  }

  async _rollFromForm(htmlOrElement) {
    const form = this._getFormElement(htmlOrElement);
    if (!form) return;

    const firstTraitKey = form.querySelector("[name='firstTrait']")?.value ?? "";
    const secondTraitKey = form.querySelector("[name='secondTrait']")?.value ?? "";
    const difficulty = Number(form.querySelector("[name='difficulty']")?.value || 6);
    const customLabel = form.querySelector("[name='label']")?.value?.trim() ?? "";

    const first = this._resolveTraitOption(firstTraitKey);
    const second = this._resolveTraitOption(secondTraitKey);
    if (!first) {
      ui.notifications?.warn?.(game.i18n.localize("VTM_REVISED.Roll.NoTraitSelected"));
      return;
    }

    const components = [first, second].filter(Boolean);
    const basePool = components.reduce((total, component) => total + Number(component.value || 0), 0);
    const healthPenalty = this._resolveHealthPenalty();

    if (healthPenalty.incapacitated) {
      ui.notifications?.warn?.(game.i18n.localize("VTM_REVISED.Roll.HealthBlocked"));
      return;
    }

    const label = customLabel || components.map(component => component.label).join(" + ");
    const activeModifier = activeAutomationRollModifier(this.actor, [firstTraitKey, secondTraitKey]);
    const pool = basePool + healthPenalty.value + activeModifier.dice;
    if (pool <= 0) { ui.notifications?.warn?.("После штрафов нет кубиков для действия."); return; }

    await rollDicePool({
      actor: this.actor,
      pool,
      basePool,
      healthPenalty: healthPenalty.value,
      healthPenaltyLabel: healthPenalty.label,
      difficulty: Math.max(2, Math.min(10, difficulty + activeModifier.difficulty)),
      label,
      components: [...components, ...activeModifier.effects.map(effect => ({ label: effect.name, value: Number(effect.diceModifier || effect.difficultyModifier || 0) }))]
    });
  }

  async _rollFortitudeSoak() {
    if (!this.actor?.isOwner || this.actor.type !== "vampire" || !isFortitudeDiscipline(this.discipline)) return;
    if (fortitudeRating(this.actor, this.discipline) <= 0) {
      ui.notifications?.warn?.("У персонажа нет изученной Стойкости. Укажи её рейтинг в карточке дисциплины.");
      return;
    }
    const poolSummary = (damageType = "bashing", ignoreArmor = false, damageSource = "unknown") => {
      const soak = fortitudeSoakPool(this.actor, damageType, { discipline: this.discipline, ignoreArmor, damageSource });
      return [["Выносливость", soak.stamina], ["Стойкость", soak.fortitude], ["Броня", soak.armor]]
        .filter(([, value]) => value > 0).map(([name, value]) => `${name} ${value}`).join(" + ") + ` = ${soak.pool} куб.`;
    };
    const content = `<form class="vtm-roll-dialog vtm-fortitude-soak-dialog">
      <div class="form-group">
        <label>Тип урона</label>
        <select name="damageType">
          <option value="bashing">Ударный</option><option value="lethal">Летальный</option><option value="aggravated">Аггравированный</option>
        </select>
      </div>
      <div class="form-group">
        <label>Запас кубиков</label>
        <input type="text" name="poolSummary" value="${poolSummary()}" readonly/>
      </div>
      <div class="form-group">
        <label>${game.i18n.localize("VTM_REVISED.Roll.Difficulty")}</label>
        <input type="number" name="difficulty" min="2" max="10" value="6"/>
      </div>
      <div class="form-group">
        <label class="vtm-soak-armor-option"><input type="checkbox" name="ignoreArmor"/> Игнорировать броню</label>
      </div>
      <div class="form-group"><label>Источник аггравированного урона</label><select name="damageSource"><option value="unknown">Иной / не указан — без обычной брони</option><option value="physical">Клыки, когти</option><option value="fire">Огонь</option><option value="sunlight">Солнце</option></select></div>
      <p class="muted">Без траты крови и штрафа от ран. Бросок не изменяет здоровье.</p>
    </form>`;
    const selection = await new Promise(resolve => new DialogV1({
      title: "Стойкость · Бросок поглощения", content,
      buttons: {
        roll: { icon: '<i class="fas fa-dice-d10"></i>', label: game.i18n.localize("VTM_REVISED.Roll.RollButton"), callback: html => {
          const root = html?.querySelector ? html : html?.[0];
          resolve({
            damageType: root?.querySelector("[name='damageType']")?.value || "bashing",
            difficulty: Number(root?.querySelector("[name='difficulty']")?.value || 6),
            ignoreArmor: Boolean(root?.querySelector("[name='ignoreArmor']")?.checked),
            damageSource: root?.querySelector("[name='damageSource']")?.value || "unknown"
          });
        } },
        cancel: { label: game.i18n.localize("Cancel"), callback: () => resolve(null) }
      }, default: "roll", close: () => resolve(null),
      render: html => {
        const root = html?.querySelector ? html : html?.[0];
        if (!root) return;
        const refresh = () => {
          const summary = root.querySelector("[name='poolSummary']");
          if (summary) summary.value = poolSummary(root.querySelector("[name='damageType']")?.value || "bashing",
            Boolean(root.querySelector("[name='ignoreArmor']")?.checked), root.querySelector("[name='damageSource']")?.value || "unknown");
        };
        root.querySelectorAll("[name='damageType'], [name='ignoreArmor'], [name='damageSource']").forEach(input => input.addEventListener("change", refresh));
        refresh();
      }
    }, { width: 460, classes: ["vtm-themed-dialog-window", "vtm-roll-dialog-window", "vampire-roll-dialog-window"] }).render(true));
    if (!selection || !this.actor?.isOwner) return;
    const soak = fortitudeSoakPool(this.actor, selection.damageType, { discipline: this.discipline, ignoreArmor: selection.ignoreArmor, damageSource: selection.damageSource });
    if (soak.pool <= 0) return;
    const labels = { bashing: "Ударный", lethal: "Летальный", aggravated: "Аггравированный" };
    const components = [
      ...(soak.stamina ? [{ label: "Выносливость", value: soak.stamina }] : []),
      ...(soak.fortitude ? [{ label: "Стойкость", value: soak.fortitude }] : []),
      ...(soak.armor ? [{ label: "Броня", value: soak.armor }] : [])
    ];
    return rollDicePool({ rollKind: "soak", actor: this.actor, pool: soak.pool, basePool: soak.pool, healthPenalty: 0,
      automaticSuccesses: 0, difficulty: selection.difficulty,
      label: `Поглощение · ${labels[selection.damageType]} урон`, components });
  }

  async _useItemAutomation(item) {
    if (!this.actor?.isOwner) return;
    if (this.actor.type === "vampire" && isFortitudeDiscipline(this.discipline) &&
        item.type === "disciplinePower" && matchParentDiscipline(item, this.discipline) &&
        Number(item.system?.level) >= 1 && Number(item.system?.level) <= 5) {
      return this._rollFortitudeSoak();
    }
    item = await resolveReferenceItem(item, Array.from(game.items ?? []), buildSystemData);

    const auto = item.system?.automation ?? {};
    const roll = auto.roll ?? {};
    const cost = normalizeAutomationCost(auto.cost ?? {}, item);
    const hasRoll = Boolean(roll.firstTrait || roll.secondTrait);

    if (hasRoll) {
      const rolled = await this._openRollDialog({
        firstTrait: roll.firstTrait || "",
        secondTrait: roll.secondTrait || "",
        difficulty: Number(roll.difficulty || 6),
        label: roll.label || item.name
      });
      if (!rolled) return;
    }

    const appliedCost = await this._applyAutomationCosts(cost, item);
    const activeEffect = await registerAutomationEffect(this.actor, item);

    const content = await renderTemplateCompat("systems/vtm-revised/templates/chat/item-use-card.hbs", {
      actor: this.actor,
      item,
      cost: appliedCost,
      activeEffect,
      description: interpolateMechanics(item.system?.description?.chat || item.system?.description?.system || item.system?.description?.value || item.system?.description?.system || "", {
        actor: this.actor,
        discipline: this.discipline,
        rating: Number(this.discipline?.system?.rating || 0),
        item
      })
    });
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content,
      flags: { "vtm-revised": { type: "itemUse", actorId: this.actor.id, itemUuid: item.uuid, hadRoll: hasRoll } }
    });
  }

  async _applyAutomationCosts(cost = {}, item = null) {
    return applyAutomationCost(this.actor, cost, item, { reason: cost.text || item?.name || "Автоматизация дисциплины" });
  }

  _resolveAutomationResource(resource) {
    if (!resource) return "";
    const key = String(resource).trim().toLowerCase();
    if (["blood", "bloodpool", "кровь"].includes(key)) return "resources.blood";
    if (["willpower", "wp", "воля", "сила воли"].includes(key)) return "resources.willpower";
    return "";
  }
}
