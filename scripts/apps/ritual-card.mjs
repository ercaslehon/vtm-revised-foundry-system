import { rollDicePool } from "../dice/dice-pool.mjs";
import { VTM_REVISED } from "../config.mjs";
import { applyAutomationCost, normalizeAutomationCost } from "../utils/automation-costs.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const DialogV1 = foundry.appv1?.api?.Dialog ?? globalThis.Dialog;
const renderTemplateCompat = foundry.applications?.handlebars?.renderTemplate ?? globalThis.renderTemplate;

function normalizeName(value = "") {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replaceAll("ё", "е")
    .replace(/^(т\d+|уровень\s*\d+|ритуал)\s*[·:\-.]?\s*/i, "")
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/[«»"']/g, "")
    .replace(/[\s_\-]+/g, " ")
    .trim();
}

function firstNonEmpty(...values) {
  return values.find(value => String(value ?? "").trim().length > 0) ?? "";
}

function itemDescription(item) {
  const desc = item?.system?.description ?? {};
  return desc.value || desc.system || desc.chat || "";
}

function getRitualAliases(item) {
  const names = [item?.name, item?.system?.rawName, item?.system?.rulesId].filter(Boolean);
  const aliasText = item?.system?.audit?.notes || item?.flags?.["vtm-revised"]?.original?.aliases || "";
  if (Array.isArray(aliasText)) names.push(...aliasText);
  else if (aliasText) names.push(...String(aliasText).split(/[,;|]/g));
  return names.map(normalizeName).filter(Boolean);
}

function matchRitualItem(candidate, ritual) {
  if (!candidate || candidate.type !== "ritual") return false;
  const left = new Set(getRitualAliases(candidate));
  const right = getRitualAliases(ritual);
  return right.some(name => left.has(name));
}

function interpolateText(text = "", { actor, ritual } = {}) {
  const level = Number(ritual?.system?.level || 0);
  const replacements = {
    actorName: actor?.name ?? "",
    ritualName: ritual?.name ?? "",
    level,
    difficulty: level ? level + 3 : 6,
    blood: Number(actor?.system?.resources?.blood?.value ?? 0),
    willpower: Number(actor?.system?.resources?.willpower?.value ?? 0)
  };
  return String(text ?? "").replace(/\{(actorName|ritualName|level|difficulty|blood|willpower)\}/g, (_match, key) => String(replacements[key] ?? ""));
}

export class VTMRitualCard extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "vtm-revised-ritual-card-{id}",
    classes: ["vtm-revised", "ritual-card"],
    position: { width: 780, height: 760 },
    window: { resizable: true }
  };

  static PARTS = {
    card: {
      template: "systems/vtm-revised/templates/apps/ritual-card.hbs",
      scrollable: [".vtm-ritual-card-body"]
    }
  };

  constructor({ actor, ritual } = {}, options = {}) {
    super(options);
    this.actor = actor;
    this.ritual = ritual;
  }

  get title() {
    const ritualName = this.ritual?.name ?? game.i18n.localize("TYPES.Item.ritual");
    return `${ritualName} · ${this.actor?.name ?? ""}`.trim();
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actorItems = Array.from(this.actor?.items ?? []);
    const worldItems = Array.from(game.items ?? []);
    const libraryRitual = [...actorItems, ...worldItems]
      .find(item => item !== this.ritual && matchRitualItem(item, this.ritual));

    const source = libraryRitual ?? this.ritual;
    const embeddedRitual = this.ritual?.parent === this.actor ? this.ritual : null;
    const system = source?.system ?? {};
    const embeddedSystem = embeddedRitual?.system ?? {};
    const level = Number(embeddedSystem.level || system.level || 0);

    const description = firstNonEmpty(itemDescription(source), itemDescription(this.ritual));
    const systemText = firstNonEmpty(system.description?.system, this.ritual?.system?.description?.system);
    const chatText = firstNonEmpty(system.description?.chat, this.ritual?.system?.description?.chat);
    const components = firstNonEmpty(system.description?.components, system.components, this.ritual?.system?.description?.components, this.ritual?.system?.components);
    const mechanics = system.mechanics ?? {};
    const audit = system.audit ?? {};
    const automation = system.automation ?? this.ritual?.system?.automation ?? {};

    return {
      ...context,
      actor: this.actor,
      ritual: this.ritual,
      source,
      sourceIsLibrary: Boolean(libraryRitual),
      level,
      discipline: embeddedSystem.discipline || system.discipline || "",
      castingTime: firstNonEmpty(embeddedSystem.castingTime, system.castingTime),
      costText: firstNonEmpty(embeddedSystem.cost, system.cost, automation?.cost?.text),
      components: interpolateText(components, { actor: this.actor, ritual: source }),
      description: interpolateText(description, { actor: this.actor, ritual: source }),
      systemText: interpolateText(systemText, { actor: this.actor, ritual: source }),
      chatText: interpolateText(chatText, { actor: this.actor, ritual: source }),
      activation: interpolateText(mechanics.activation || "", { actor: this.actor, ritual: source }),
      duration: interpolateText(mechanics.duration || "", { actor: this.actor, ritual: source }),
      successScaling: interpolateText(mechanics.successScaling || "", { actor: this.actor, ritual: source }),
      resistance: interpolateText(mechanics.resistance || "", { actor: this.actor, ritual: source }),
      limits: interpolateText(mechanics.limits || "", { actor: this.actor, ritual: source }),
      failure: interpolateText(mechanics.failure || "", { actor: this.actor, ritual: source }),
      botch: interpolateText(mechanics.botch || "", { actor: this.actor, ritual: source }),
      automationNotes: interpolateText(mechanics.automationNotes || "", { actor: this.actor, ritual: source }),
      auditStatus: audit.status || "draft",
      auditStatusLabel: this._auditStatusLabel(audit.status || "draft"),
      auditNotes: audit.notes || "",
      sourceUrl: audit.sourceUrl || automation?.source?.url || "",
      sourceBook: audit.sourceBook || "",
      sourcePage: audit.sourcePage || automation?.source?.page || "",
      canUse: Boolean(this.actor?.isOwner),
      editable: Boolean(this.ritual?.isOwner)
    };
  }

  _auditStatusLabel(status = "draft") {
    const key = String(status || "draft").trim().toLowerCase();
    if (key === "verified") return "Проверено";
    if (key === "needs-review") return "Требует проверки";
    return "Черновик";
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const element = this.element;
    if (!element) return;

    element.querySelectorAll(".ritual-use").forEach(button => {
      button.addEventListener("click", async event => {
        event.preventDefault();
        await this._useRitual();
      });
    });

    element.querySelectorAll(".ritual-edit").forEach(button => {
      button.addEventListener("click", event => {
        event.preventDefault();
        this.ritual?.sheet?.render(true);
      });
    });
  }

  _resolveHealthPenalty() {
    const health = this.actor?.system?.health ?? {};
    const activeKey = [...VTM_REVISED.healthLevels].reverse().find(key => Number(health[key] || 0) > 0);
    if (!activeKey) return { key: "healthy", value: 0, label: game.i18n.localize("VTM_REVISED.HealthPenalty.none"), incapacitated: false };
    const rawPenalty = VTM_REVISED.healthPenalties[activeKey] ?? 0;
    const label = game.i18n.localize(`VTM_REVISED.Health.${activeKey}`);
    if (rawPenalty === "out") return { key: activeKey, value: 0, label, incapacitated: true };
    return { key: activeKey, value: Number(rawPenalty || 0), label, incapacitated: false };
  }

  _buildRollTraitOptions() {
    const options = [];
    const push = (key, label, value, group) => options.push({ key, label, value: Number(value || 0), group, display: `${label} (${Number(value || 0)})` });

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

    push("resource.willpower", game.i18n.localize("VTM_REVISED.Resource.Willpower"), this.actor.system?.resources?.willpower?.value, game.i18n.localize("VTM_REVISED.Section.Resources"));
    return options;
  }

  _resolveTraitOption(key) {
    if (!key) return null;
    const [type, group, trait] = String(key).split(".");
    if (type === "attribute") return { key, label: game.i18n.localize(`VTM_REVISED.Attribute.${trait}`), value: Number(foundry.utils.getProperty(this.actor, `system.attributes.${group}.${trait}`) || 0) };
    if (type === "ability") return { key, label: game.i18n.localize(`VTM_REVISED.Ability.${trait}`), value: Number(foundry.utils.getProperty(this.actor, `system.abilities.${group}.${trait}.value`) || 0) };
    if (type === "resource" && group === "willpower") return { key, label: game.i18n.localize("VTM_REVISED.Resource.Willpower"), value: Number(this.actor.system?.resources?.willpower?.value || 0) };
    return null;
  }

  _buildRollSelectHtml(name, selected = "", includeEmpty = false) {
    const grouped = new Map();
    for (const option of this._buildRollTraitOptions()) {
      if (!grouped.has(option.group)) grouped.set(option.group, []);
      grouped.get(option.group).push(option);
    }
    const empty = includeEmpty ? `<option value="">${game.i18n.localize("VTM_REVISED.Roll.NoSecondTrait")}</option>` : "";
    const body = Array.from(grouped.entries()).map(([group, entries]) => {
      const inner = entries.map(option => `<option value="${foundry.utils.escapeHTML(option.key)}"${option.key === selected ? " selected" : ""}>${foundry.utils.escapeHTML(option.display)}</option>`).join("");
      return `<optgroup label="${foundry.utils.escapeHTML(group)}">${inner}</optgroup>`;
    }).join("");
    return `<select name="${name}">${empty}${body}</select>`;
  }

  async _openRollDialog({ firstTrait = "attribute.mental.intelligence", secondTrait = "ability.knowledges.occult", difficulty = 6, label = "" } = {}) {
    const content = `
      <form class="vtm-roll-dialog">
        <div class="form-group"><label>${game.i18n.localize("VTM_REVISED.Roll.FirstTrait")}</label>${this._buildRollSelectHtml("firstTrait", firstTrait, false)}</div>
        <div class="form-group"><label>${game.i18n.localize("VTM_REVISED.Roll.SecondTrait")}</label>${this._buildRollSelectHtml("secondTrait", secondTrait, true)}</div>
        <div class="form-group"><label>${game.i18n.localize("VTM_REVISED.Roll.Difficulty")}</label><input type="number" name="difficulty" min="2" max="10" value="${Number(difficulty || 6)}"/></div>
        <div class="form-group"><label>${game.i18n.localize("VTM_REVISED.Roll.Label")}</label><input type="text" name="label" value="${foundry.utils.escapeHTML(label || this.ritual?.name || "Ритуал")}"/></div>
      </form>`;

    return new Promise(resolve => {
      new DialogV1({
        title: game.i18n.localize("VTM_REVISED.Roll.DialogTitle"),
        content,
        buttons: {
          roll: { icon: '<i class="fas fa-dice-d10"></i>', label: game.i18n.localize("VTM_REVISED.Roll.RollButton"), callback: async html => { await this._rollFromForm(html); resolve(true); } },
          cancel: { label: game.i18n.localize("Cancel"), callback: () => resolve(false) }
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
    const first = this._resolveTraitOption(form.querySelector("[name='firstTrait']")?.value ?? "");
    const second = this._resolveTraitOption(form.querySelector("[name='secondTrait']")?.value ?? "");
    const difficulty = Number(form.querySelector("[name='difficulty']")?.value || 6);
    const customLabel = form.querySelector("[name='label']")?.value?.trim() ?? "";
    if (!first) return ui.notifications?.warn?.(game.i18n.localize("VTM_REVISED.Roll.NoTraitSelected"));
    const components = [first, second].filter(Boolean);
    const basePool = Math.max(1, components.reduce((total, component) => total + Number(component.value || 0), 0));
    const healthPenalty = this._resolveHealthPenalty();
    if (healthPenalty.incapacitated) return ui.notifications?.warn?.(game.i18n.localize("VTM_REVISED.Roll.HealthBlocked"));
    await rollDicePool({ actor: this.actor, pool: Math.max(1, basePool + healthPenalty.value), basePool, healthPenalty: healthPenalty.value, healthPenaltyLabel: healthPenalty.label, difficulty, label: customLabel || this.ritual?.name || "Ритуал", components });
  }

  async _useRitual() {
    const source = (await this._prepareContext({})).source ?? this.ritual;
    const auto = source?.system?.automation ?? this.ritual?.system?.automation ?? {};
    const roll = auto.roll ?? {};
    const cost = normalizeAutomationCost(auto.cost ?? {}, source ?? this.ritual);
    const hasRoll = Boolean(roll.firstTrait || roll.secondTrait);

    if (hasRoll) {
      const rolled = await this._openRollDialog({
        firstTrait: roll.firstTrait || "attribute.mental.intelligence",
        secondTrait: roll.secondTrait || "ability.knowledges.occult",
        difficulty: Number(roll.difficulty || (Number(source?.system?.level || this.ritual?.system?.level || 0) + 3) || 6),
        label: roll.label || this.ritual?.name || source?.name
      });
      if (!rolled) return;
    }

    const appliedCost = await this._applyAutomationCosts(cost, source);
    const description = source?.system?.description?.chat || source?.system?.description?.system || source?.system?.description?.value || this.ritual?.system?.description?.value || "";
    const content = await renderTemplateCompat("systems/vtm-revised/templates/chat/item-use-card.hbs", { actor: this.actor, item: source, cost: appliedCost, description });
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: this.actor }), content, flags: { "vtm-revised": { type: "ritualUse", actorId: this.actor.id, itemUuid: source?.uuid ?? this.ritual?.uuid, hadRoll: hasRoll } } });
  }

  async _applyAutomationCosts(cost = {}, item = null) {
    return applyAutomationCost(this.actor, cost, item, { reason: cost.text || item?.name || "Ритуал" });
  }

  _resolveAutomationResource(resource) {
    const key = String(resource || "").trim().toLowerCase();
    if (["blood", "bloodpool", "кровь"].includes(key)) return "resources.blood";
    if (["willpower", "wp", "воля", "сила воли"].includes(key)) return "resources.willpower";
    return "";
  }
}
