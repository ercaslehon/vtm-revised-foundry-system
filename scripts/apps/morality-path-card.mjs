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

export class VTMMoralityPathCard extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "vtm-revised-morality-path-card-{id}",
    classes: ["vtm-revised", "morality-path-card"],
    position: { width: 760, height: 780 },
    window: { resizable: true }
  };

  static PARTS = {
    card: {
      template: "systems/vtm-revised/templates/apps/morality-path-card.hbs",
      scrollable: [".vtm-morality-card-body"]
    }
  };

  constructor({ actor, moralityPath } = {}, options = {}) {
    super(options);
    this.actor = actor;
    this.moralityPath = moralityPath;
  }

  get title() {
    const name = this.moralityPath?.name ?? this.actor?.system?.resources?.pathName ?? "Человечность / Путь";
    return `Путь / Дорога · ${name}`;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const item = this.moralityPath;
    const system = item?.system ?? {};
    const category = system.category === "road" ? "Дорога" : system.category === "humanity" ? "Человечность" : "Путь Просветления";
    const sourceUrl = system.audit?.sourceUrl || system.automation?.source?.url || "";
    const sourceBook = system.audit?.sourceBook || "";
    const sourcePage = system.audit?.sourcePage || "";
    const aliases = splitList(system.aliases);

    return {
      ...context,
      actor: this.actor,
      item,
      system,
      hasPath: Boolean(item),
      selectedName: this.actor?.system?.resources?.pathName || "",
      category,
      aliases,
      sourceUrl,
      sourceBook,
      sourcePage,
      rating: Number(this.actor?.system?.resources?.humanity?.value ?? 0),
      description: system.description?.value || "",
      summary: system.description?.chat || "",
      systemText: system.description?.system || "",
      mechanics: system.mechanics || {},
      audit: system.audit || {}
    };
  }
}

export function findMoralityPathItemForName(name = "") {
  const wanted = normalizeName(name || "Человечность");
  if (!wanted) return null;
  return Array.from(game.items ?? [])
    .filter(item => item.type === "moralityPath")
    .find(item => {
      const aliases = String(item.system?.aliases ?? "").split(/[,;]+/g);
      const names = [item.name, item.system?.rawName, item.system?.slug, item.system?.nameEn, ...aliases].filter(Boolean);
      return names.some(value => normalizeName(value) === wanted);
    }) ?? null;
}
