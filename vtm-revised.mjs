import { VTM_REVISED } from "./scripts/config.mjs";
import { VTMActor } from "./scripts/documents/vtm-actor.mjs";
import { VTMItem } from "./scripts/documents/vtm-item.mjs";
import { VTMVampireActorData, VTMNpcActorData } from "./scripts/data-models/actor-data.mjs";
import {
  VTMDisciplineItemData,
  VTMDisciplinePowerItemData,
  VTMDisciplinePathItemData,
  VTMRitualItemData,
  VTMRatedItemData,
  VTMEquipmentItemData,
  VTMWeaponItemData,
  VTMRuleEntryItemData,
  VTMClanItemData
} from "./scripts/data-models/item-data.mjs";
import { VTMVampireActorSheet } from "./scripts/sheets/vampire-actor-sheet.mjs";
import { VTMItemSheet } from "./scripts/sheets/item-sheet.mjs";
import { VTMDisciplineCard } from "./scripts/apps/discipline-card.mjs";
import { VTMRitualCard } from "./scripts/apps/ritual-card.mjs";
import { VTMClanCard, findClanItemForName } from "./scripts/apps/clan-card.mjs";
import { VTMMeritFlawCard } from "./scripts/apps/merit-flaw-card.mjs";
import { VTMArchetypeCard, findArchetypeForName } from "./scripts/apps/archetype-card.mjs";
import { VTMCharacterCreationWizard } from "./scripts/apps/character-creation-wizard.mjs";
import { rollDicePool } from "./scripts/dice/dice-pool.mjs";
import { TrechkalovJsonImporter } from "./scripts/import/trechkalov-json-importer.mjs";
import { RulesJsonImporter } from "./scripts/import/rules-json-importer.mjs";


const registerHandlebarsHelpers = () => {
  Handlebars.registerHelper("concat", (...parts) => parts.slice(0, -1).join(""));
  Handlebars.registerHelper("eq", (a, b) => a === b);
  Handlebars.registerHelper("gt", (a, b) => Number(a ?? 0) > Number(b ?? 0));
  Handlebars.registerHelper("or", (...args) => args.slice(0, -1).some(Boolean));
  Handlebars.registerHelper("and", (...args) => args.slice(0, -1).every(Boolean));
};

const loadTemplatesCompat = foundry.applications?.handlebars?.loadTemplates ?? globalThis.loadTemplates;
const ActorSheetV1 = foundry.appv1?.sheets?.ActorSheet ?? globalThis.ActorSheet;
const ItemSheetV1 = foundry.appv1?.sheets?.ItemSheet ?? globalThis.ItemSheet;
const DocumentSheetConfig = foundry.applications?.apps?.DocumentSheetConfig;


function registerSheets() {
  const actorTypes = ["vampire", "npc"];
  const itemTypes = VTM_REVISED.itemTypes;

  if (!DocumentSheetConfig) {
    console.error("VtM Revised | DocumentSheetConfig is unavailable. Foundry V13+ is required for this dev build.");
    return;
  }

  try {
    DocumentSheetConfig.unregisterSheet(Actor, "core", ActorSheetV1);
  } catch (err) {
    console.debug("VtM Revised | Core ActorSheet unregister skipped", err);
  }

  DocumentSheetConfig.registerSheet(Actor, VTM_REVISED.systemId, VTMVampireActorSheet, {
    types: actorTypes,
    makeDefault: true,
    label: "VTM_REVISED.Sheet.Vampire"
  });

  try {
    DocumentSheetConfig.unregisterSheet(Item, "core", ItemSheetV1);
  } catch (err) {
    console.debug("VtM Revised | Core ItemSheet unregister skipped", err);
  }

  // Item sheet remains AppV1 for now. It opens only from within the Actor sheet and is not the current blocker.
  DocumentSheetConfig.registerSheet(Item, VTM_REVISED.systemId, VTMItemSheet, {
    types: itemTypes,
    makeDefault: true,
    label: "VTM_REVISED.Sheet.Item"
  });
}

const preloadTemplates = async () => loadTemplatesCompat([
  "systems/vtm-revised/templates/actors/vampire-sheet.hbs",
  "systems/vtm-revised/templates/actors/vampire-sheet-v2.hbs",
  "systems/vtm-revised/templates/actors/parts/profile.hbs",
  "systems/vtm-revised/templates/actors/parts/attributes.hbs",
  "systems/vtm-revised/templates/actors/parts/abilities.hbs",
  "systems/vtm-revised/templates/actors/parts/advantages.hbs",
  "systems/vtm-revised/templates/actors/parts/blood-magic.hbs",
  "systems/vtm-revised/templates/actors/parts/weapons.hbs",
  "systems/vtm-revised/templates/actors/parts/notes.hbs",
  "systems/vtm-revised/templates/actors/parts/notes-v2.hbs",
  "systems/vtm-revised/templates/items/item-sheet.hbs",
  "systems/vtm-revised/templates/chat/roll-card.hbs",
  "systems/vtm-revised/templates/apps/import-json-dialog.hbs",
  "systems/vtm-revised/templates/apps/import-rules-dialog.hbs",
  "systems/vtm-revised/templates/apps/discipline-card.hbs",
  "systems/vtm-revised/templates/apps/ritual-card.hbs",
  "systems/vtm-revised/templates/apps/clan-card.hbs",
  "systems/vtm-revised/templates/apps/merit-flaw-card.hbs",
  "systems/vtm-revised/templates/apps/archetype-card.hbs",
  "systems/vtm-revised/templates/apps/character-creation-wizard.hbs",
  "systems/vtm-revised/templates/chat/item-use-card.hbs",
  "systems/vtm-revised/templates/chat/weapon-damage-card.hbs"
]);

Hooks.once("init", async () => {
  console.log("VtM Revised | Initializing system");

  CONFIG.VTM_REVISED = VTM_REVISED;
  registerHandlebarsHelpers();
  CONFIG.Actor.documentClass = VTMActor;
  CONFIG.Item.documentClass = VTMItem;

  CONFIG.Actor.dataModels.vampire = VTMVampireActorData;
  CONFIG.Actor.dataModels.npc = VTMNpcActorData;

  CONFIG.Item.dataModels.discipline = VTMDisciplineItemData;
  CONFIG.Item.dataModels.disciplinePower = VTMDisciplinePowerItemData;
  CONFIG.Item.dataModels.disciplinePath = VTMDisciplinePathItemData;
  CONFIG.Item.dataModels.ritual = VTMRitualItemData;
  CONFIG.Item.dataModels.merit = VTMRatedItemData;
  CONFIG.Item.dataModels.flaw = VTMRatedItemData;
  CONFIG.Item.dataModels.background = VTMRatedItemData;
  CONFIG.Item.dataModels.equipment = VTMEquipmentItemData;
  CONFIG.Item.dataModels.weapon = VTMWeaponItemData;
  CONFIG.Item.dataModels.clan = VTMClanItemData;
  CONFIG.Item.dataModels.sect = VTMRuleEntryItemData;
  CONFIG.Item.dataModels.ruleEntry = VTMRuleEntryItemData;

  CONFIG.Actor.trackableAttributes = {
    vampire: {
      bar: ["resources.blood", "resources.willpower", "resources.humanity"],
      value: ["resources.bloodPerTurn"]
    },
    npc: {
      bar: ["resources.blood", "resources.willpower", "resources.humanity"],
      value: ["resources.bloodPerTurn"]
    }
  };

  registerSheets();

  await preloadTemplates();

  game.vtmRevised = {
    config: VTM_REVISED,
    rollDicePool,
    importer: TrechkalovJsonImporter,
    rulesImporter: RulesJsonImporter,
    openActorSheet,
    openDisciplineCard,
    openFirstActor: () => openActorSheet(game.actors?.contents?.[0], true),
    debugFirstActorSheet: () => debugActorSheet(game.actors?.contents?.[0]),
    importJsonText: TrechkalovJsonImporter.importText.bind(TrechkalovJsonImporter),
    importRulesText: RulesJsonImporter.importText.bind(RulesJsonImporter),
    importBuiltInDisciplineCatalog: RulesJsonImporter.importBuiltInCoreDisciplines.bind(RulesJsonImporter),
    importBuiltInBloodMagicCatalog: RulesJsonImporter.importBuiltInBloodMagicCatalog.bind(RulesJsonImporter),
    importBuiltInRitualCatalog: RulesJsonImporter.importBuiltInRitualCatalog.bind(RulesJsonImporter),
    importBuiltInWeaponCatalog: RulesJsonImporter.importBuiltInWeaponCatalog.bind(RulesJsonImporter),
    importBuiltInClanCatalog: RulesJsonImporter.importBuiltInClanCatalog.bind(RulesJsonImporter),
    importBuiltInMeritsFlawsCatalog: RulesJsonImporter.importBuiltInMeritsFlawsCatalog.bind(RulesJsonImporter),
    openClanCard,
    openArchetypeCard,
    openCharacterCreationWizard: (actorOrRef) => openCharacterCreationWizard(actorOrRef),
    openFirstActorCreationWizard: () => openCharacterCreationWizard(game.actors?.contents?.[0]),
    syncActorRitualsFromCatalog,
    syncFirstActorRitualsFromCatalog: () => syncActorRitualsFromCatalog(game.actors?.contents?.[0]),
    applyGenerationCaps: (actorOrRef) => applyGenerationCaps(actorOrRef),
    applyFirstActorGenerationCaps: () => applyGenerationCaps(game.actors?.contents?.[0]),
    renderRulesImportDialog: RulesJsonImporter.renderDialog.bind(RulesJsonImporter)
  };
});

function getRenderedElement(app, html) {
  if (html instanceof HTMLElement) return html;
  if (html?.[0] instanceof HTMLElement) return html[0];
  if (app?.element instanceof HTMLElement) return app.element;
  if (app?.element?.[0] instanceof HTMLElement) return app.element[0];
  return null;
}


function resolveActorFromElement(element) {
  const row = element?.closest?.("[data-document-id], [data-entry-id], [data-document-uuid], [data-uuid]");
  if (!row) return null;

  const id = row.dataset.documentId ?? row.dataset.entryId;
  const uuid = row.dataset.documentUuid ?? row.dataset.uuid;

  if (id && game.actors?.get(id)) return game.actors.get(id);
  if (uuid) {
    // fromUuid is async, so handled by the caller if needed.
    return { uuid };
  }
  return null;
}

async function renderApplicationCompat(app) {
  try {
    return await app.render({ force: true });
  } catch (err) {
    // Some AppV1 compatibility classes still use render(true). Keep this fallback while Item sheets are AppV1.
    return app.render(true);
  }
}

async function openActorSheet(actorOrRef, forceNew = false) {
  let actor = actorOrRef;
  if (typeof actorOrRef === "string") actor = game.actors?.get(actorOrRef) ?? await fromUuid(actorOrRef);
  if (actorOrRef?.uuid && !actorOrRef?.render) actor = await fromUuid(actorOrRef.uuid);
  if (!actor) {
    ui.notifications?.warn?.("VtM Revised | Actor not found for sheet opening");
    return null;
  }

  try {
    if (!forceNew && actor.sheet?.render) return await renderApplicationCompat(actor.sheet);
  } catch (err) {
    console.warn("VtM Revised | actor.sheet.render failed, using direct ActorSheetV2 fallback", err);
  }

  const sheet = new VTMVampireActorSheet({ document: actor });
  return renderApplicationCompat(sheet);
}

async function openDisciplineCard(actorOrRef, disciplineOrRef) {
  let actor = actorOrRef;
  if (typeof actorOrRef === "string") actor = game.actors?.get(actorOrRef) ?? await fromUuid(actorOrRef);
  if (actorOrRef?.uuid && !actorOrRef?.render) actor = await fromUuid(actorOrRef.uuid);

  let discipline = disciplineOrRef;
  if (typeof disciplineOrRef === "string") {
    discipline = actor?.items?.get(disciplineOrRef) ?? game.items?.get(disciplineOrRef) ?? await fromUuid(disciplineOrRef);
  }
  if (disciplineOrRef?.uuid && !disciplineOrRef?.render) discipline = await fromUuid(disciplineOrRef.uuid);

  if (!actor || !discipline) {
    ui.notifications?.warn?.("VtM Revised | Actor or Discipline not found for card opening");
    return null;
  }

  const app = new VTMDisciplineCard({ actor, discipline });
  return renderApplicationCompat(app);
}

async function openClanCard(actorOrRef) {
  let actor = actorOrRef;
  if (typeof actorOrRef === "string") actor = game.actors?.get(actorOrRef) ?? await fromUuid(actorOrRef);
  if (actorOrRef?.uuid && !actorOrRef?.render) actor = await fromUuid(actorOrRef.uuid);
  if (!actor) actor = game.actors?.contents?.[0];
  if (!actor) {
    ui.notifications?.warn?.("VtM Revised | Actor not found for clan card");
    return null;
  }
  const clanName = actor.system?.profile?.clan;
  const clan = findClanItemForName(clanName);
  if (!clan) ui.notifications?.warn?.(game.i18n?.localize?.("VTM_REVISED.Clan.CatalogMissing") ?? "Clan catalog entry not found.");
  const app = new VTMClanCard({ actor, clan });
  return renderApplicationCompat(app);
}

async function openArchetypeCard(actorOrRef, kind = "nature", force = true) {
  let actor = actorOrRef;
  if (typeof actorOrRef === "string") actor = game.actors?.get(actorOrRef) ?? await fromUuid(actorOrRef);
  if (actorOrRef?.uuid && !actorOrRef?.render) actor = await fromUuid(actorOrRef.uuid);
  if (!actor) actor = game.actors?.contents?.[0];
  if (!actor) {
    ui.notifications?.warn?.("VtM Revised | Actor not found for archetype card");
    return null;
  }
  const key = kind === "demeanor" ? "demeanor" : "nature";
  const value = key === "demeanor" ? actor.system?.profile?.demeanor : actor.system?.profile?.nature;
  const archetype = findArchetypeForName(value);
  const app = new VTMArchetypeCard({ actor, archetype, kind: key });
  return renderApplicationCompat(app);
}

async function applyGenerationCaps(actorOrRef) {
  let actor = actorOrRef;
  if (typeof actorOrRef === "string") actor = game.actors?.get(actorOrRef) ?? await fromUuid(actorOrRef);
  if (actorOrRef?.uuid && !actorOrRef?.render) actor = await fromUuid(actorOrRef.uuid);
  if (!actor?.applyGenerationCaps) {
    ui.notifications?.warn?.("VtM Revised | Actor not found for generation caps");
    return null;
  }
  return actor.applyGenerationCaps(actor.system?.profile?.generation, { clampTraits: true, notify: true });
}


async function openCharacterCreationWizard(actorOrRef) {
  let actor = actorOrRef;
  if (typeof actorOrRef === "string") actor = game.actors?.get(actorOrRef) ?? await fromUuid(actorOrRef);
  if (actorOrRef?.uuid && !actorOrRef?.render) actor = await fromUuid(actorOrRef.uuid);
  if (!actor) {
    ui.notifications?.warn?.("VtM Revised | Actor not found for character creation wizard");
    return null;
  }
  return new VTMCharacterCreationWizard({ actor }).render({ force: true });
}

async function syncActorRitualsFromCatalog(actorOrRef) {
  let actor = actorOrRef;
  if (typeof actorOrRef === "string") actor = game.actors?.get(actorOrRef) ?? await fromUuid(actorOrRef);
  if (actorOrRef?.uuid && !actorOrRef?.render) actor = await fromUuid(actorOrRef.uuid);
  if (!actor) {
    ui.notifications?.warn?.("VtM Revised | Actor not found for ritual sync");
    return [];
  }

  const normalize = value => String(value ?? "").trim().toLowerCase().replaceAll("ё", "е").replace(/[\s_\-]+/g, " ");
  const catalog = Array.from(game.items ?? []).filter(item => item.type === "ritual");
  const namesFor = item => {
    const original = item?.flags?.["vtm-revised"]?.original ?? {};
    const aliases = Array.isArray(original.aliases) ? original.aliases : [];
    return [item?.name, item?.system?.rawName, ...aliases].filter(Boolean).map(normalize);
  };

  const updates = [];
  for (const ritual of Array.from(actor.items ?? []).filter(item => item.type === "ritual")) {
    const wanted = new Set([ritual.name, ritual.system?.rawName].filter(Boolean).map(normalize));
    let source = null;
    const sourceUuid = ritual.flags?.["vtm-revised"]?.catalogSourceUuid;
    if (sourceUuid) source = catalog.find(item => item.uuid === sourceUuid);
    if (!source) source = catalog.find(item => namesFor(item).some(name => wanted.has(name)));
    if (!source) continue;
    const system = foundry.utils.deepClone(source.system ?? {});
    system.rulesId = system.rulesId || source.system?.rulesId || source.id;
    system.rawName = system.rawName || source.name;
    system.isHomebrew = false;
    updates.push({
      _id: ritual.id,
      name: source.name,
      img: source.img,
      system,
      flags: {
        "vtm-revised": {
          ...(ritual.flags?.["vtm-revised"] ?? {}),
          catalogSourceUuid: source.uuid,
          syncedFromCatalogAt: new Date().toISOString()
        }
      }
    });
  }

  if (!updates.length) {
    ui.notifications?.warn?.(game.i18n?.localize?.("VTM_REVISED.Ritual.SyncNothing") ?? "No ritual catalog matches found.");
    return [];
  }
  const updated = await actor.updateEmbeddedDocuments("Item", updates);
  ui.notifications?.info?.(game.i18n?.format?.("VTM_REVISED.Ritual.SyncDone", { count: updated.length }) ?? `Updated ${updated.length} rituals.`);
  return updated;
}

async function debugActorSheet(actorOrRef) {
  const sheet = await openActorSheet(actorOrRef, true);
  console.log("VtM Revised | debug sheet", {
    sheet,
    element: sheet?.element,
    rendered: sheet?.rendered,
    state: sheet?.state,
    visible: sheet?.isVisible,
    position: sheet?.position
  });
  return sheet;
}


function shouldOpenCreationWizardForNewActor(actor, options = {}, userId = null) {
  if (!actor || actor.type !== "vampire") return false;
  if (userId && game.user?.id !== userId) return false;
  if (options?.vtmRevised?.suppressCreationWizard) return false;
  if (options?.["vtm-revised"]?.suppressCreationWizard) return false;
  if (actor.flags?.["vtm-revised"]?.suppressCreationWizard) return false;
  if (actor.flags?.["vtm-revised"]?.creationWizard?.completed) return false;
  return true;
}

async function closeNativeSheetIfOpen(actor) {
  try {
    const sheet = actor?.sheet;
    if (sheet?.rendered || sheet?._state > 0) await sheet.close({ force: true });
  } catch (err) {
    console.debug("VtM Revised | Native actor sheet close before wizard skipped", err);
  }
}

async function openCreationWizardForNewActor(actor) {
  // Foundry opens the default sheet after the create dialog callback. Give it a moment,
  // then close the normal sheet and replace it with the guided creation wizard.
  window.setTimeout(async () => {
    try {
      await closeNativeSheetIfOpen(actor);
      await actor.setFlag("vtm-revised", "creationWizard.started", true);
      await openCharacterCreationWizard(actor);
    } catch (err) {
      console.error("VtM Revised | Failed to open character creation wizard for new actor", err);
      ui.notifications?.error?.("VtM Revised | Не удалось открыть мастер создания персонажа. Подробности в консоли.");
    }
  }, 600);
}

Hooks.on("createActor", (actor, options, userId) => {
  if (!shouldOpenCreationWizardForNewActor(actor, options, userId)) return;
  openCreationWizardForNewActor(actor);
});

Hooks.on("renderActorDirectory", (app, html) => {
  const element = getRenderedElement(app, html);
  if (!element) return;

  // Fallback opener for appv1 sheets in Foundry V14.
  // If the native directory handler fails to resolve actor.sheet, this still opens our sheet on double click.
  if (!element.dataset.vtmSheetFallbackBound) {
    element.dataset.vtmSheetFallbackBound = "true";
    element.addEventListener("dblclick", async event => {
      const ref = resolveActorFromElement(event.target);
      if (!ref) return;
      event.preventDefault();
      event.stopPropagation();
      await openActorSheet(ref, true);
    }, true);
  }

  if (!game.user?.isGM) return;

  const footer = element.querySelector(".directory-footer") ?? element.querySelector("footer");
  if (!footer || footer.querySelector(".vtm-import-json")) return;

  const button = document.createElement("button");
  button.type = "button";
  button.classList.add("vtm-import-json");
  button.innerHTML = `<i class="fas fa-file-import"></i> ${game.i18n.localize("VTM_REVISED.Import.Json")}`;
  button.addEventListener("click", () => TrechkalovJsonImporter.renderDialog());
  footer.append(button);
});


Hooks.on("renderItemDirectory", (app, html) => {
  const element = getRenderedElement(app, html);
  if (!element || !game.user?.isGM) return;

  const footer = element.querySelector(".directory-footer") ?? element.querySelector("footer");
  if (!footer || footer.querySelector(".vtm-import-rules-json")) return;

  const button = document.createElement("button");
  button.type = "button";
  button.classList.add("vtm-import-rules-json");
  button.innerHTML = `<i class="fas fa-book"></i> ${game.i18n.localize("VTM_REVISED.Import.RulesJson")}`;
  button.addEventListener("click", () => RulesJsonImporter.renderDialog());
  footer.append(button);

  if (!footer.querySelector(".vtm-import-core-disciplines")) {
    const builtInButton = document.createElement("button");
    builtInButton.type = "button";
    builtInButton.classList.add("vtm-import-core-disciplines");
    builtInButton.innerHTML = `<i class="fas fa-droplet"></i> ${game.i18n.localize("VTM_REVISED.Import.CoreDisciplines")}`;
    builtInButton.addEventListener("click", async () => RulesJsonImporter.importBuiltInCoreDisciplines());
    footer.append(builtInButton);
  }

  if (!footer.querySelector(".vtm-import-blood-magic")) {
    const bloodMagicButton = document.createElement("button");
    bloodMagicButton.type = "button";
    bloodMagicButton.classList.add("vtm-import-blood-magic");
    bloodMagicButton.innerHTML = `<i class="fas fa-wand-magic-sparkles"></i> ${game.i18n.localize("VTM_REVISED.Import.BloodMagic")}`;
    bloodMagicButton.addEventListener("click", async () => RulesJsonImporter.importBuiltInBloodMagicCatalog());
    footer.append(bloodMagicButton);
  }


  if (!footer.querySelector(".vtm-import-rituals")) {
    const ritualsButton = document.createElement("button");
    ritualsButton.type = "button";
    ritualsButton.classList.add("vtm-import-rituals");
    ritualsButton.innerHTML = `<i class="fas fa-scroll"></i> ${game.i18n.localize("VTM_REVISED.Import.Rituals")}`;
    ritualsButton.addEventListener("click", async () => RulesJsonImporter.importBuiltInRitualCatalog());
    footer.append(ritualsButton);
  }

  if (!footer.querySelector(".vtm-import-clans")) {
    const clansButton = document.createElement("button");
    clansButton.type = "button";
    clansButton.classList.add("vtm-import-clans");
    clansButton.innerHTML = `<i class="fas fa-users"></i> ${game.i18n.localize("VTM_REVISED.Import.Clans")}`;
    clansButton.addEventListener("click", async () => RulesJsonImporter.importBuiltInClanCatalog());
    footer.append(clansButton);
  }

  if (!footer.querySelector(".vtm-import-weapons")) {
    const weaponsButton = document.createElement("button");
    weaponsButton.type = "button";
    weaponsButton.classList.add("vtm-import-weapons");
    weaponsButton.innerHTML = `<i class="fas fa-gun"></i> ${game.i18n.localize("VTM_REVISED.Import.Weapons")}`;
    weaponsButton.addEventListener("click", async () => RulesJsonImporter.importBuiltInWeaponCatalog());
    footer.append(weaponsButton);
  }


  if (!footer.querySelector(".vtm-import-merits-flaws")) {
    const meritsFlawsButton = document.createElement("button");
    meritsFlawsButton.type = "button";
    meritsFlawsButton.classList.add("vtm-import-merits-flaws");
    meritsFlawsButton.innerHTML = `<i class="fas fa-scale-balanced"></i> ${game.i18n.localize("VTM_REVISED.Import.MeritsFlaws")}`;
    meritsFlawsButton.addEventListener("click", async () => RulesJsonImporter.importBuiltInMeritsFlawsCatalog());
    footer.append(meritsFlawsButton);
  }
});

Hooks.once("ready", () => {
  console.log("VtM Revised | Ready. Use game.vtmRevised.importJsonText(jsonText) for sheets or game.vtmRevised.importRulesText(jsonText) for authorized rules catalog imports.");
});
