const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

function normalizeName(value = "") {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replaceAll("ё", "е")
    .replace(/[\s_\-]+/g, " ");
}

export class VTMMeritFlawCard extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "vtm-revised-merit-flaw-card-{id}",
    classes: ["vtm-revised", "merit-flaw-card"],
    position: { width: 720, height: 760 },
    window: { resizable: true }
  };

  static PARTS = {
    card: {
      template: "systems/vtm-revised/templates/apps/merit-flaw-card.hbs",
      scrollable: [".vtm-merit-flaw-card-body"]
    }
  };

  constructor({ actor, item } = {}, options = {}) {
    super(options);
    this.actor = actor;
    this.item = item;
  }

  get title() {
    const typeLabel = this.item?.type === "flaw" ? game.i18n.localize("TYPES.Item.flaw") : (this.item?.type === "background" ? game.i18n.localize("TYPES.Item.background") : game.i18n.localize("TYPES.Item.merit"));
    return `${typeLabel} · ${this.item?.name ?? ""}`.trim();
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const item = this.item;
    const system = item?.system ?? {};
    const sourceUrl = system.audit?.sourceUrl || system.automation?.source?.url || "";
    const sourceBook = system.audit?.sourceBook || "";
    const sourcePage = system.audit?.sourcePage || system.automation?.source?.page || "";
    const hasRoll = Boolean(system.automation?.roll?.firstTrait || system.automation?.roll?.secondTrait);
    const hasCost = Boolean(system.automation?.cost?.resource && Number(system.automation?.cost?.amount || 0) > 0);
    const hasEffect = Boolean(system.effect?.type || system.effect?.notes || system.effect?.target);

    return {
      ...context,
      actor: this.actor,
      item,
      system,
      hasItem: Boolean(item),
      sourceUrl,
      sourceBook,
      sourcePage,
      typeLabel: item?.type === "flaw" ? game.i18n.localize("TYPES.Item.flaw") : (item?.type === "background" ? game.i18n.localize("TYPES.Item.background") : game.i18n.localize("TYPES.Item.merit")),
      description: system.description?.value || "",
      shortDescription: system.description?.chat || "",
      systemText: system.description?.system || "",
      hasRoll,
      hasCost,
      hasEffect,
      effect: system.effect ?? {},
      automation: system.automation ?? {},
      mechanics: system.mechanics ?? {},
      audit: system.audit ?? {},
      trigger: system.trigger || ""
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const element = this.element;
    if (!element) return;

    element.querySelectorAll(".merit-flaw-use").forEach(button => {
      button.addEventListener("click", async event => {
        event.preventDefault();
        await this._useFromCard();
      });
    });
  }

  async _useFromCard() {
    if (!this.actor || !this.item) return;
    const sheet = this.actor.sheet;
    if (sheet?._useItemAutomation) return sheet._useItemAutomation(this.item);

    const renderTemplate = foundry.applications?.handlebars?.renderTemplate ?? globalThis.renderTemplate;
    const content = await renderTemplate("systems/vtm-revised/templates/chat/item-use-card.hbs", {
      actor: this.actor,
      item: this.item,
      cost: this.item.system?.automation?.cost ?? {},
      description: this.item.system?.description?.chat || this.item.system?.description?.system || this.item.system?.description?.value || this.item.system?.effect?.notes || ""
    });
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content,
      flags: { "vtm-revised": { type: "itemUse", actorId: this.actor.id, itemId: this.item.id } }
    });
  }
}

export function findMeritFlawItemForName(name = "", type = "") {
  const wanted = normalizeName(name);
  if (!wanted) return null;
  return Array.from(game.items ?? [])
    .filter(item => !type || item.type === type)
    .filter(item => ["merit", "flaw", "background"].includes(item.type))
    .find(item => {
      const original = item.flags?.["vtm-revised"]?.original ?? {};
      const aliases = Array.isArray(original.aliases) ? original.aliases : [];
      const names = [item.name, item.system?.rawName, ...(aliases ?? [])].filter(Boolean);
      return names.some(value => normalizeName(value) === wanted);
    }) ?? null;
}
