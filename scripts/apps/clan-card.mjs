const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

function normalizeName(value = "") {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replaceAll("ё", "е")
    .replace(/[\s_\-]+/g, " ");
}

function splitList(value = "") {
  return String(value ?? "")
    .split(/[,;]+/g)
    .map(part => part.trim())
    .filter(Boolean);
}

export class VTMClanCard extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "vtm-revised-clan-card-{id}",
    classes: ["vtm-revised", "clan-card"],
    position: { width: 720, height: 740 },
    window: { resizable: true }
  };

  static PARTS = {
    card: {
      template: "systems/vtm-revised/templates/apps/clan-card.hbs",
      scrollable: [".vtm-clan-card-body"]
    }
  };

  constructor({ actor, clan } = {}, options = {}) {
    super(options);
    this.actor = actor;
    this.clan = clan;
  }

  get title() {
    return `${game.i18n.localize("VTM_REVISED.Clan.CardTitle")} · ${this.clan?.name ?? this.actor?.system?.profile?.clan ?? ""}`.trim();
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const clan = this.clan;
    const system = clan?.system ?? {};
    const disciplines = splitList(system.disciplines);
    const sourceUrl = system.sourceUrl || system.audit?.sourceUrl || system.automation?.source?.url || "";
    const sourceBook = system.sourceBook || system.audit?.sourceBook || "";
    const sourcePage = system.sourcePage || system.audit?.sourcePage || "";

    return {
      ...context,
      actor: this.actor,
      clan,
      system,
      disciplines,
      sourceUrl,
      sourceBook,
      sourcePage,
      hasClan: Boolean(clan),
      selectedClanName: this.actor?.system?.profile?.clan || "",
      description: system.description?.value || "",
      shortDescription: system.description?.chat || "",
      systemText: system.description?.system || "",
      weakness: system.weakness || system.mechanics?.limits || "",
      organization: system.organization || "",
      stereotypes: system.stereotypes || "",
      opinion: system.opinion || "",
      roleplayTips: system.roleplayTips || system.mechanics?.automationNotes || ""
    };
  }
}

export function findClanItemForName(name = "") {
  const wanted = normalizeName(name);
  if (!wanted) return null;
  return Array.from(game.items ?? [])
    .filter(item => item.type === "clan")
    .find(item => {
      const aliases = String(item.system?.aliases ?? "").split(/[,;]+/g);
      const names = [item.name, item.system?.rawName, item.system?.slug, item.system?.nameEn, ...aliases].filter(Boolean);
      return names.some(value => normalizeName(value) === wanted);
    }) ?? null;
}
