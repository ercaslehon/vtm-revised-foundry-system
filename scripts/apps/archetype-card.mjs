import { VTM_REVISED } from "../config.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

function normalizeName(value = "") {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replaceAll("ё", "е")
    .replace(/[\s_\-]+/g, " ");
}

export function findArchetypeForName(value = "") {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const normalized = normalizeName(raw);
  return (VTM_REVISED.archetypeOptions ?? []).find(archetype => {
    const names = [archetype.name, archetype.slug, ...(archetype.aliases ?? [])].filter(Boolean);
    return names.some(name => normalizeName(name) === normalized);
  }) ?? null;
}

export class VTMArchetypeCard extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "vtm-revised-archetype-card-{id}",
    classes: ["vtm-revised", "archetype-card-app"],
    position: { width: 620, height: 640 },
    window: { resizable: true }
  };

  static PARTS = {
    card: {
      template: "systems/vtm-revised/templates/apps/archetype-card.hbs",
      scrollable: [".vtm-archetype-card-body"]
    }
  };

  constructor({ actor = null, archetype = null, kind = "nature" } = {}, options = {}) {
    super(options);
    this.actor = actor;
    this.archetype = archetype;
    this.kind = kind;
  }

  get title() {
    const label = this.kind === "demeanor"
      ? game.i18n.localize("VTM_REVISED.Archetype.Demeanor")
      : game.i18n.localize("VTM_REVISED.Archetype.Nature");
    return `${label}: ${this.archetype?.name ?? game.i18n.localize("VTM_REVISED.Empty")}`;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const custom = !this.archetype;
    const selectedName = this.kind === "demeanor"
      ? this.actor?.system?.profile?.demeanor
      : this.actor?.system?.profile?.nature;
    return {
      ...context,
      actor: this.actor,
      kind: this.kind,
      kindLabel: this.kind === "demeanor"
        ? game.i18n.localize("VTM_REVISED.Archetype.Demeanor")
        : game.i18n.localize("VTM_REVISED.Archetype.Nature"),
      archetype: this.archetype ?? {
        name: selectedName || game.i18n.localize("VTM_REVISED.Empty"),
        motto: game.i18n.localize("VTM_REVISED.Archetype.CustomMotto"),
        summary: game.i18n.localize("VTM_REVISED.Archetype.CustomSummary"),
        regain: game.i18n.localize("VTM_REVISED.Archetype.CustomRegain")
      },
      isCustom: custom,
      isNature: this.kind !== "demeanor"
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    this.element?.querySelector(".archetype-card-restore-willpower")?.addEventListener("click", async event => {
      event.preventDefault();
      if (!this.actor || this.kind === "demeanor") return;
      const label = this.archetype?.name || this.actor.system?.profile?.nature || game.i18n.localize("VTM_REVISED.Profile.Nature");
      await this.actor.changeResource("resources.willpower", 1, `${game.i18n.localize("VTM_REVISED.Archetype.Nature")}: ${label}`);
    });
  }
}
