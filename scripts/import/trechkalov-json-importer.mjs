const renderTemplateCompat = foundry.applications?.handlebars?.renderTemplate ?? globalThis.renderTemplate;
const DialogV1 = foundry.appv1?.api?.Dialog ?? globalThis.Dialog;

function getDialogValue(html, selector) {
  if (html?.find) return html.find(selector).val();
  const element = html instanceof HTMLElement ? html : html?.[0];
  return element?.querySelector(selector)?.value;
}

const PROFILE_MAP = {
  player: "player",
  chronicle: "chronicle",
  nature: "nature",
  demeanor: "demeanor",
  concept: "concept",
  clan: "clan",
  generation: "generation",
  sire: "sire",
  sect: "sect",
  age: "age",
  sex: "sex"
};

const ATTRIBUTE_MAP = {
  strength: "physical.strength",
  dexterity: "physical.dexterity",
  stamina: "physical.stamina",
  charisma: "social.charisma",
  manipulation: "social.manipulation",
  appearance: "social.appearance",
  perception: "mental.perception",
  intelligence: "mental.intelligence",
  wits: "mental.wits"
};

const TALENTS = ["athletics", "alertness", "brawl", "intimidation", "expression", "leadership", "dodge", "streetwise", "subterfuge", "empathy"];
const SKILLS = ["security", "drive", "survival", "performance", "animalken", "crafts", "stealth", "firearms", "melee", "etiquette"];
const KNOWLEDGES = ["academics", "science", "law", "computer", "linguistics", "medicine", "occult", "politics", "investigation", "finance"];

export class TrechkalovJsonImporter {
  static async renderDialog() {
    const content = await renderTemplateCompat("systems/vtm-revised/templates/apps/import-json-dialog.hbs", {});
    new DialogV1({
      title: game.i18n.localize("VTM_REVISED.Import.Json"),
      content,
      buttons: {
        import: {
          icon: '<i class="fas fa-file-import"></i>',
          label: game.i18n.localize("VTM_REVISED.Import.Import"),
          callback: html => {
            const jsonText = getDialogValue(html, "textarea[name='json']");
            return this.importText(jsonText);
          }
        },
        cancel: { label: game.i18n.localize("Cancel") }
      },
      default: "import"
    }, { width: 720, height: 600 }).render(true);
  }

  static async importText(jsonText) {
    if (!jsonText?.trim()) throw new Error("Empty JSON");
    const data = JSON.parse(jsonText);
    return this.importData(data, jsonText);
  }

  static async importData(data, rawJson = null) {
    const sheet = data.Charsheet ?? data.charsheet ?? data;
    const profile = sheet.profile ?? {};
    const actorData = this._buildActorData(sheet, data, rawJson ?? JSON.stringify(data));
    const actor = await Actor.create(actorData, { vtmRevised: { suppressCreationWizard: true } });
    const items = this._buildItems(sheet);
    if (items.length) await actor.createEmbeddedDocuments("Item", items);
    ui.notifications?.info(game.i18n.format("VTM_REVISED.Import.Created", { name: actor.name }));
    return actor;
  }

  static _buildActorData(sheet, root, rawJson) {
    const profile = sheet.profile ?? {};
    const system = {
      profile: {},
      attributes: { physical: {}, social: {}, mental: {} },
      abilities: { talents: {}, skills: {}, knowledges: {}, custom: [] },
      virtues: {},
      resources: { humanity: {}, willpower: {}, blood: {}, experience: {} },
      health: {},
      import: {
        sourceFormat: "trechkalov_json",
        sourceVersion: String(root.Version ?? root.version ?? ""),
        rawJson
      }
    };

    for (const [source, target] of Object.entries(PROFILE_MAP)) system.profile[target] = profile[source] ?? "";
    system.profile.appearance = sheet.appearanceDescription ?? "";
    system.profile.history = sheet.charHistory ?? "";
    system.profile.goals = sheet.goals ?? "";
    system.profile.notes = sheet.notes ?? "";
    system.profile.alliesContacts = sheet.alliesAndContacts ?? "";
    system.profile.possessions = sheet.possessions ?? "";

    const attrs = sheet.attributes ?? {};
    for (const [source, target] of Object.entries(ATTRIBUTE_MAP)) foundry.utils.setProperty(system.attributes, target, Number(attrs[source] ?? 1));

    this._mapAbilities(system, sheet.abilities ?? {});

    const virtues = sheet.virtues ?? {};
    system.virtues.conscience = Number(virtues.conscience ?? 1);
    system.virtues.selfControl = Number(virtues.self_control ?? virtues.selfControl ?? 1);
    system.virtues.courage = Number(virtues.courage ?? 1);

    const state = sheet.state ?? {};
    system.resources.humanity = { value: Number(state.humanity ?? 7), max: 10 };
    system.resources.willpower = { value: Number(state.willpowerPool ?? state.willpower_pool ?? 3), max: Number(state.willpowerRating ?? state.willpower_rating ?? 3) };
    system.resources.blood = { value: Number(state.bloodpool ?? 10), max: this._generationBloodMax(profile.generation) };
    system.resources.bloodPerTurn = Number(state.bloodPerTurn ?? state.blood_per_turn ?? 1);
    system.resources.pathName = state.pathName ?? state.path_name ?? "";
    system.resources.weakness = state.weakness ?? "";
    const xpTotal = Number(state.experienceTotal ?? state.experience_total ?? state.experience ?? 0) || 0;
    const xpSpent = Number(state.experienceSpent ?? state.experience_spent ?? 0) || 0;
    system.resources.experience = { total: xpTotal, spent: xpSpent, available: Math.max(0, xpTotal - xpSpent) };

    const health = sheet.health ?? {};
    for (const level of ["bruised", "hurt", "injured", "wounded", "mauled", "crippled", "incapacitated"]) {
      system.health[level] = Number(health[level] ?? 0);
    }

    return {
      name: profile.name || "Imported Vampire",
      type: "vampire",
      system,
      img: sheet.characterImage || "icons/svg/mystery-man.svg"
    };
  }

  static _mapAbilities(system, abilities) {
    for (const key of TALENTS) system.abilities.talents[key] = { label: "", value: Number(abilities[key] ?? 0), specialization: "" };
    for (const key of SKILLS) system.abilities.skills[key] = { label: "", value: Number(abilities[key] ?? 0), specialization: "" };
    for (const key of KNOWLEDGES) system.abilities.knowledges[key] = { label: "", value: Number(abilities[key] ?? 0), specialization: "" };
  }

  static _buildItems(sheet) {
    const items = [];
    for (const entry of sheet.disciplines ?? []) {
      items.push({ name: entry.name || "Discipline", type: "discipline", system: { rating: Number(entry.value ?? 0), rawName: entry.name || "" } });
    }
    for (const entry of sheet.disciplinePaths ?? []) {
      items.push({ name: entry.name || "Path", type: "disciplinePath", system: { rating: Number(entry.value ?? 0), rawName: entry.name || "", parentDiscipline: entry.disciplineName || "Тауматургия" } });
    }
    for (const entry of sheet.rituals ?? []) {
      const parsed = this._parseRitual(entry);
      items.push({ name: parsed.name, type: "ritual", system: { level: parsed.level, rawName: parsed.rawName, discipline: "Тауматургия" } });
    }
    for (const entry of sheet.backgrounds ?? []) {
      items.push({ name: entry.name || "Background", type: "background", system: { rating: Number(entry.value ?? 0), rawText: entry.name || "" } });
    }
    for (const rawText of sheet.merits ?? []) {
      const parsed = this._parseRatedText(rawText);
      items.push({ name: parsed.name, type: "merit", system: { points: parsed.points, rawText } });
    }
    for (const rawText of sheet.flaws ?? []) {
      const parsed = this._parseRatedText(rawText);
      items.push({ name: parsed.name, type: "flaw", system: { points: parsed.points, rawText } });
    }
    return items;
  }

  static _parseRitual(entry) {
    const rawName = typeof entry === "string" ? entry : (entry.name || "Ritual");
    const explicitLevel = Number(entry?.level || 0) || 0;
    const match = rawName.match(/^\s*[ТT](\d+)\s+(.+)$/i);
    return {
      rawName,
      level: explicitLevel || Number(match?.[1] ?? 0),
      name: match?.[2]?.trim() || rawName
    };
  }

  static _parseRatedText(rawText) {
    const text = String(rawText || "");
    const match = text.match(/^(.*?)(?:\s*\((\d+)\s*(?:пункт|пункта|пунктов|pt|pts).*)?\)?$/i);
    return { name: (match?.[1] || text).trim(), points: Number(match?.[2] || 0) };
  }

  static _generationBloodMax(generation) {
    const value = Number(String(generation || "").match(/\d+/)?.[0] || 13);
    const table = { 13: 10, 12: 11, 11: 12, 10: 13, 9: 14, 8: 15, 7: 20, 6: 30, 5: 40, 4: 50 };
    return table[value] ?? 10;
  }
}
