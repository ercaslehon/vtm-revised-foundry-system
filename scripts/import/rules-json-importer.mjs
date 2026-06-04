const renderTemplateCompat = foundry.applications?.handlebars?.renderTemplate ?? globalThis.renderTemplate;
const DialogV1 = foundry.appv1?.api?.Dialog ?? globalThis.Dialog;

const TYPE_MAP = {
  clans: "clan",
  sects: "sect",
  disciplines: "discipline",
  powers: "disciplinePower",
  disciplinePowers: "disciplinePower",
  paths: "disciplinePath",
  disciplinePaths: "disciplinePath",
  rituals: "ritual",
  merits: "merit",
  flaws: "flaw",
  backgrounds: "background",
  equipment: "equipment",
  weapons: "weapon",
  weapon: "weapon",
  moralityPaths: "moralityPath",
  pathsOfEnlightenment: "moralityPath",
  roads: "moralityPath",
  morality: "moralityPath",
  rules: "ruleEntry",
  ruleEntries: "ruleEntry"
};

function normalizeArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function html(value = "") {
  return String(value ?? "");
}

function buildSystemData(type, entry = {}) {
  const description = {
    value: html(entry.description ?? entry.summary ?? ""),
    system: html(entry.system ?? entry.systemText ?? ""),
    chat: html(entry.chat ?? entry.short ?? entry.shortDescription ?? "")
  };

  const automation = {
    roll: {
      firstTrait: entry.roll?.firstTrait ?? entry.rollFirstTrait ?? "",
      secondTrait: entry.roll?.secondTrait ?? entry.rollSecondTrait ?? "",
      difficulty: safeNumber(entry.roll?.difficulty ?? entry.difficulty, 6),
      label: entry.roll?.label ?? entry.rollLabel ?? entry.name ?? ""
    },
    cost: {
      resource: entry.cost?.resource ?? entry.costResource ?? "",
      amount: safeNumber(entry.cost?.amount ?? entry.costAmount, 0),
      blood: safeNumber(entry.cost?.blood ?? entry.costBlood, 0),
      willpower: safeNumber(entry.cost?.willpower ?? entry.costWillpower, 0),
      text: entry.cost?.text ?? entry.costText ?? ""
    },
    source: {
      url: entry.source?.url ?? entry.sourceUrl ?? entry.audit?.sourceUrl ?? "",
      page: String(entry.source?.page ?? entry.page ?? entry.audit?.sourcePage ?? ""),
      section: entry.source?.section ?? entry.section ?? ""
    }
  };

  const mechanics = {
    activation: html(entry.mechanics?.activation ?? entry.activation ?? ""),
    duration: html(entry.mechanics?.duration ?? entry.duration ?? ""),
    successScaling: html(entry.mechanics?.successScaling ?? entry.successScaling ?? ""),
    resistance: html(entry.mechanics?.resistance ?? entry.resistance ?? ""),
    failure: html(entry.mechanics?.failure ?? entry.failure ?? ""),
    botch: html(entry.mechanics?.botch ?? entry.botch ?? ""),
    limits: html(entry.mechanics?.limits ?? entry.limits ?? ""),
    automationNotes: html(entry.mechanics?.automationNotes ?? entry.automationNotes ?? "")
  };

  const audit = {
    status: entry.audit?.status ?? entry.mechanicsStatus ?? entry.status ?? "draft",
    sourceUrl: entry.audit?.sourceUrl ?? entry.sourceUrl ?? entry.source?.url ?? "",
    sourceBook: entry.audit?.sourceBook ?? entry.sourceBook ?? "",
    sourcePage: String(entry.audit?.sourcePage ?? entry.page ?? entry.source?.page ?? ""),
    checkedAt: entry.audit?.checkedAt ?? entry.checkedAt ?? "",
    checkedBy: entry.audit?.checkedBy ?? entry.checkedBy ?? "",
    notes: html(entry.audit?.notes ?? entry.auditNotes ?? "")
  };

  if (type === "clan") return {
    slug: entry.slug ?? "",
    nameEn: entry.nameEn ?? entry.englishName ?? "",
    sect: entry.sect ?? "",
    aliases: normalizeArray(entry.aliases).join(", "),
    disciplines: normalizeArray(entry.disciplines ?? entry.clanDisciplines).join(", "),
    weakness: html(entry.weakness ?? entry.clanWeakness ?? entry.flaw ?? ""),
    organization: html(entry.organization ?? ""),
    stereotypes: html(entry.stereotypes ?? entry.opinion ?? ""),
    opinion: html(entry.clanOpinion ?? entry.inCharacterOpinion ?? entry.view ?? ""),
    roleplayTips: html(entry.roleplayTips ?? entry.playTips ?? entry.notes ?? ""),
    theme: html(entry.theme ?? ""),
    embrace: html(entry.embrace ?? ""),
    societyPlace: html(entry.societyPlace ?? ""),
    characterHooks: html(entry.characterHooks ?? ""),
    storytellerHooks: html(entry.storytellerHooks ?? ""),
    sourceUrl: entry.sourceUrl ?? entry.source?.url ?? entry.audit?.sourceUrl ?? "",
    sourceBook: entry.sourceBook ?? entry.audit?.sourceBook ?? "",
    sourcePage: String(entry.sourcePage ?? entry.page ?? entry.audit?.sourcePage ?? ""),
    description,
    mechanics,
    audit,
    rawName: entry.rawName ?? entry.name ?? "",
    isHomebrew: Boolean(entry.isHomebrew ?? false)
  };

  if (type === "discipline") return {
    rating: safeNumber(entry.rating ?? entry.value, 0),
    rulesId: entry.rulesId ?? entry.slug ?? "",
    source: entry.sourceText ?? entry.source ?? "",
    description,
    mechanics,
    audit,
    automation,
    rawName: entry.rawName ?? entry.name ?? "",
    isHomebrew: Boolean(entry.isHomebrew ?? false)
  };

  if (type === "disciplinePower") return {
    level: safeNumber(entry.level ?? entry.rating, 0),
    levelLabel: entry.levelLabel ?? entry.levelText ?? "",
    parentDiscipline: entry.parentDiscipline ?? entry.discipline ?? "",
    rulesId: entry.rulesId ?? entry.slug ?? "",
    description,
    mechanics,
    audit,
    automation,
    rawName: entry.rawName ?? entry.name ?? "",
    isHomebrew: Boolean(entry.isHomebrew ?? false)
  };

  if (type === "disciplinePath") return {
    rating: safeNumber(entry.rating ?? entry.value, 0),
    parentDiscipline: entry.parentDiscipline ?? entry.discipline ?? "",
    rulesId: entry.rulesId ?? entry.slug ?? "",
    description,
    mechanics,
    audit,
    automation,
    rawName: entry.rawName ?? entry.name ?? "",
    isHomebrew: Boolean(entry.isHomebrew ?? false)
  };

  if (type === "ritual") return {
    level: safeNumber(entry.level, 0),
    discipline: entry.discipline ?? "Тауматургия",
    castingTime: entry.castingTime ?? "",
    cost: entry.costText ?? entry.cost?.text ?? "",
    components: entry.components ?? entry.componentsText ?? "",
    rulesId: entry.rulesId ?? entry.slug ?? "",
    description: { ...description, components: html(entry.components ?? entry.componentsText ?? "") },
    mechanics,
    audit,
    automation,
    rawName: entry.rawName ?? entry.name ?? "",
    isHomebrew: Boolean(entry.isHomebrew ?? false)
  };

  if (["merit", "flaw", "background"].includes(type)) return {
    rating: safeNumber(entry.rating ?? entry.value, 0),
    points: safeNumber(entry.points, 0),
    category: entry.category ?? "",
    trigger: entry.trigger ?? "",
    description,
    mechanics,
    audit,
    automation,
    effect: {
      type: entry.effect?.type ?? entry.effectType ?? "",
      target: entry.effect?.target ?? entry.effectTarget ?? "",
      mode: entry.effect?.mode ?? entry.effectMode ?? "",
      amount: safeNumber(entry.effect?.amount ?? entry.effectAmount, 0),
      difficultyModifier: safeNumber(entry.effect?.difficultyModifier ?? entry.difficultyModifier, 0),
      diceModifier: safeNumber(entry.effect?.diceModifier ?? entry.diceModifier, 0),
      notes: html(entry.effect?.notes ?? entry.effectNotes ?? entry.effect ?? "")
    },
    rawText: entry.rawText ?? entry.name ?? "",
    rawName: entry.rawName ?? entry.name ?? "",
    isHomebrew: Boolean(entry.isHomebrew ?? false)
  };

  if (type === "weapon") return {
    quantity: safeNumber(entry.quantity, 1),
    description,
    mechanics,
    audit,
    automation,
    weapon: {
      category: entry.weapon?.category ?? entry.category ?? "melee",
      damageType: entry.weapon?.damageType ?? entry.damageType ?? "lethal",
      difficulty: safeNumber(entry.weapon?.difficulty ?? entry.difficulty, 6),
      damageDifficulty: safeNumber(entry.weapon?.damageDifficulty ?? entry.damageDifficulty, 6),
      damageBonus: safeNumber(entry.weapon?.damageBonus ?? entry.damageBonus, 1),
      damageDice: safeNumber(entry.weapon?.damageDice ?? entry.damageDice, 4),
      usesStrength: Boolean(entry.weapon?.usesStrength ?? entry.usesStrength ?? true),
      addsAttackSuccesses: Boolean(entry.weapon?.addsAttackSuccesses ?? entry.addsAttackSuccesses ?? true),
      attackFirstTrait: entry.weapon?.attackFirstTrait ?? entry.attackFirstTrait ?? "attribute.physical.dexterity",
      attackSecondTrait: entry.weapon?.attackSecondTrait ?? entry.attackSecondTrait ?? (String(entry.weapon?.category ?? entry.category ?? "melee") === "firearm" ? "ability.skills.firearms" : "ability.skills.melee"),
      range: String(entry.weapon?.range ?? entry.range ?? ""),
      rate: String(entry.weapon?.rate ?? entry.rate ?? ""),
      clip: String(entry.weapon?.clip ?? entry.clip ?? ""),
      conceal: String(entry.weapon?.conceal ?? entry.conceal ?? ""),
      minimumStrength: safeNumber(entry.weapon?.minimumStrength ?? entry.minimumStrength, 0),
      notes: entry.weapon?.notes ?? entry.notes ?? ""
    },
    rawText: entry.rawText ?? entry.name ?? "",
    rawName: entry.rawName ?? entry.name ?? "",
    isHomebrew: Boolean(entry.isHomebrew ?? false)
  };


  if (type === "moralityPath") return {
    slug: entry.slug ?? "",
    category: entry.category ?? entry.kind ?? "path",
    nameEn: entry.nameEn ?? entry.englishName ?? "",
    aliases: normalizeArray(entry.aliases).join(", "),
    sourceEra: entry.sourceEra ?? entry.era ?? "modern",
    virtues: html(entry.virtues ?? entry.virtueText ?? ""),
    aura: html(entry.aura ?? ""),
    ethics: html(entry.ethics ?? entry.tenets ?? entry.code ?? ""),
    hierarchy: html(entry.hierarchy ?? entry.hierarchyOfSins ?? entry.sins ?? ""),
    initiation: html(entry.initiation ?? entry.adoption ?? ""),
    description,
    mechanics,
    audit,
    automation,
    rawName: entry.rawName ?? entry.name ?? "",
    isHomebrew: Boolean(entry.isHomebrew ?? false)
  };

  if (type === "equipment") return {
    quantity: safeNumber(entry.quantity, 1),
    description: { value: html(entry.description ?? entry.summary ?? "") },
    rawText: entry.rawText ?? entry.name ?? ""
  };

  return {
    category: entry.category ?? type,
    slug: entry.slug ?? "",
    aliases: normalizeArray(entry.aliases).join(", "),
    description,
    mechanics,
    audit,
    automation,
    rawName: entry.rawName ?? entry.name ?? "",
    isHomebrew: Boolean(entry.isHomebrew ?? false)
  };
}

function collectEntries(payload) {
  const entries = [];

  if (Array.isArray(payload)) {
    for (const entry of payload) entries.push({ type: entry.type ?? "ruleEntry", entry });
    return entries;
  }

  for (const [key, type] of Object.entries(TYPE_MAP)) {
    for (const entry of normalizeArray(payload[key])) entries.push({ type: entry.type ?? type, entry });
  }

  for (const entry of normalizeArray(payload.items)) entries.push({ type: entry.type ?? "ruleEntry", entry });
  return entries;
}

async function loadBuiltInCatalog(url, errorLabel) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to load ${errorLabel}: ${response.status} ${response.statusText}`);
  return response.json();
}

export class RulesJsonImporter {
  static renderDialog() {
    new DialogV1({
      title: game.i18n.localize("VTM_REVISED.Import.RulesJson"),
      content: `<form><p>${game.i18n.localize("VTM_REVISED.Import.RulesPasteJson")}</p><textarea name="json" rows="14" style="width:100%;"></textarea></form>`,
      buttons: {
        import: {
          icon: '<i class="fas fa-file-import"></i>',
          label: game.i18n.localize("VTM_REVISED.Import.Import"),
          callback: async html => {
            const text = html.find("textarea[name='json']").val();
            await this.importText(text);
          }
        },
        cancel: { label: game.i18n.localize("Cancel") }
      },
      default: "import"
    }, { width: 720 }).render(true);
  }

  static async importBuiltInCoreDisciplines(options = {}) {
    const payload = await loadBuiltInCatalog("systems/vtm-revised/data/vtm-revised-core-disciplines.generated.json", "built-in discipline catalog");
    return this.importData({ ...payload, dedupe: true }, options);
  }

  static async importBuiltInBloodMagicCatalog(options = {}) {
    const payload = await loadBuiltInCatalog("systems/vtm-revised/data/vtm-revised-blood-magic.generated.json", "built-in blood magic catalog");
    return this.importData({ ...payload, dedupe: true }, options);
  }

  static async importBuiltInRitualCatalog(options = {}) {
    const payload = await loadBuiltInCatalog("systems/vtm-revised/data/vtm-revised-rituals.generated.json", "built-in ritual catalog");
    return this.importData({ ...payload, dedupe: true }, options);
  }

  static async importBuiltInClanCatalog(options = {}) {
    const payload = await loadBuiltInCatalog("systems/vtm-revised/data/vtm-revised-clans.generated.json", "built-in clan catalog");
    return this.importData({ ...payload, dedupe: true }, options);
  }

  static async importBuiltInWeaponCatalog(options = {}) {
    const payload = await loadBuiltInCatalog("systems/vtm-revised/data/vtm-revised-weapons.generated.json", "built-in weapon catalog");
    return this.importData({ ...payload, dedupe: true }, options);
  }

  static async importBuiltInBackgroundCatalog(options = {}) {
    const payload = await loadBuiltInCatalog("systems/vtm-revised/data/vtm-revised-backgrounds.generated.json", "built-in backgrounds catalog");
    return this.importData({ ...payload, dedupe: true }, options);
  }

  static async importBuiltInMeritsFlawsCatalog(options = {}) {
    const payload = await loadBuiltInCatalog("systems/vtm-revised/data/vtm-revised-merits-flaws.generated.json", "built-in merits/flaws catalog");
    return this.importData({ ...payload, dedupe: true }, options);
  }

  static async importBuiltInMoralityCatalog(options = {}) {
    const payload = await loadBuiltInCatalog("systems/vtm-revised/data/vtm-revised-morality.generated.json", "built-in morality catalog");
    return this.importData({ ...payload, dedupe: true }, options);
  }

  static async importBuiltInAllCatalogs(options = {}) {
    const created = [];
    const runs = [
      () => this.importBuiltInCoreDisciplines(options),
      () => this.importBuiltInBloodMagicCatalog(options),
      () => this.importBuiltInRitualCatalog(options),
      () => this.importBuiltInWeaponCatalog(options),
      () => this.importBuiltInClanCatalog(options),
      () => this.importBuiltInBackgroundCatalog(options),
      () => this.importBuiltInMeritsFlawsCatalog(options),
      () => this.importBuiltInMoralityCatalog(options)
    ];
    for (const run of runs) created.push(...await run());
    return created;
  }

  static async importText(text, options = {}) {
    let payload;
    try {
      payload = JSON.parse(text);
    } catch (err) {
      ui.notifications?.error?.(game.i18n.localize("VTM_REVISED.Import.InvalidJson"));
      throw err;
    }

    return this.importData(payload, options);
  }

  static async importData(payload, options = {}) {
    const notify = options.notify !== false;
    const collected = collectEntries(payload);
    if (!collected.length) {
      if (notify) ui.notifications?.warn?.(game.i18n.localize("VTM_REVISED.Import.NoRulesEntries"));
      return [];
    }

    const folderName = payload.folderName ?? "VtM Revised Rules Catalog";
    let folder = game.folders?.find(f => f.type === "Item" && f.name === folderName);

    if (payload.replaceFolder && folder) {
      const oldItems = Array.from(game.items ?? []).filter(item => item.folder?.id === folder.id);
      if (oldItems.length) await Item.deleteDocuments(oldItems.map(item => item.id));
      try {
        await folder.delete();
      } catch (err) {
        console.warn("VtM Revised | Could not delete old rules folder, reusing it", err);
      }
      folder = null;
    }

    if (!folder) folder = await Folder.create({ name: folderName, type: "Item", sorting: "a" });

    const existingKeys = new Set(Array.from(game.items ?? [])
      .filter(item => item.folder?.id === folder.id || item.folder?.name === folderName)
      .map(item => `${item.type}::${String(item.name).trim().toLowerCase()}`));

    const docs = collected
      .map(({ type, entry }) => ({
        name: entry.name ?? entry.title ?? entry.slug ?? game.i18n.localize(`TYPES.Item.${type}`),
        type,
        folder: folder.id,
        system: buildSystemData(type, entry),
        flags: {
          "vtm-revised": {
            source: payload.source ?? entry.sourceUrl ?? "manual-json",
            importedAt: new Date().toISOString(),
            original: entry
          }
        }
      }))
      .filter(doc => !payload.dedupe || !existingKeys.has(`${doc.type}::${String(doc.name).trim().toLowerCase()}`));

    if (!docs.length) {
      if (notify) ui.notifications?.info?.(game.i18n.localize("VTM_REVISED.Import.RulesAlreadyImported"));
      return [];
    }

    const created = await Item.createDocuments(docs);
    if (notify) ui.notifications?.info?.(game.i18n.format("VTM_REVISED.Import.RulesCreated", { count: created.length }));
    return created;
  }
}
