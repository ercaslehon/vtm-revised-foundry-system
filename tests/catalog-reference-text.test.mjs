import assert from "node:assert/strict";
import fs from "node:fs";
import { referenceTextUpdate, normalizeReferenceText, isSourceLinkPlaceholder } from "../scripts/import/catalog-reference-text.mjs";
import { registerReferenceCatalog } from "../scripts/import/catalog-reference-cache.mjs";
import { referenceDisplayItem } from "../scripts/import/catalog-reference-view.mjs";

class ApplicationStub {
  constructor() {}
  async _prepareContext() { return {}; }
}
globalThis.foundry = { applications: { api: { ApplicationV2: ApplicationStub, HandlebarsApplicationMixin: base => base } }, appv1: {} };
globalThis.ui = { notifications: {} };
globalThis.game = { items: [], folders: [], i18n: { localize: key => key } };
const { RulesJsonImporter, buildSystemData } = await import("../scripts/import/rules-json-importer.mjs");
const { VTMMoralityPathCard } = await import("../scripts/apps/morality-path-card.mjs");
const clone = value => JSON.parse(JSON.stringify(value));
const catalog = JSON.parse(fs.readFileSync(new URL("../data/vtm-revised-morality.generated.json", import.meta.url), "utf8"));
registerReferenceCatalog(catalog);
const entry = catalog.moralityPaths.find(entry => entry.name === "Человечность");
const placeholder = '<p><a href="https://wod.su/vampire/paths/humanity" target="_blank" rel="noopener">Описание и правила на wod.su</a></p>';
const old = { ...entry, description: placeholder, system: placeholder, ethics: placeholder, hierarchy: placeholder, contentMode: "source-reference", mechanics: { activation: "Obsolete scaffold kept in merged flags" } };
const folder = { id: "morality", name: catalog.folderName, type: "Item" };
const item = { id: "existing-path", uuid: "Item.existing-path", name: entry.name, type: "moralityPath", folder,
  system: buildSystemData("moralityPath", old),
  flags: { otherModule: { preserve: "foreign flags" }, "vtm-revised": { original: clone(old), catalogRevision: "wod-content-20261008-1" } } };
item.system.mechanics.activation = ""; // Actual model state no longer matches the recursively merged flags.
item.system.automation.roll.difficulty = 9; // A genuine numerical customization.
item.toObject = () => clone({ _id: item.id, name: item.name, type: item.type, system: item.system, flags: item.flags });
const before = clone(item.system);
const plan = referenceTextUpdate(item, entry, buildSystemData);
assert.ok(plan.changed.includes("description.value"));
assert.equal(plan.system.description.value, entry.description);
assert.equal(plan.system.hierarchy, entry.hierarchy);
assert.deepEqual(plan.system.automation, before.automation);
assert.deepEqual(item.system, before, "a display plan does not mutate stored documents");
assert.equal(normalizeReferenceText('<p>&quot;Текст&#x27; &amp; правила&nbsp;</p>'), '"Текст\' & правила');
assert.ok(isSourceLinkPlaceholder(placeholder));
assert.ok(!isSourceLinkPlaceholder("<p>My custom explanation.</p>" + placeholder));
const edited = { ...item, system: clone(item.system) };
edited.system.description.value = "<p>My own history for this Path.</p>";
assert.equal(referenceTextUpdate(edited, entry, buildSystemData).system.description.value, edited.system.description.value);
const view = referenceDisplayItem(item, [item], buildSystemData);
assert.equal(view.system.description.value, entry.description);
assert.deepEqual(view.system.automation, before.automation);
assert.equal(view.uuid, item.uuid);
game.items = [item]; game.folders = [folder];
const card = new VTMMoralityPathCard({ actor: { system: { resources: { humanity: { value: 7, max: 10 } } } }, moralityPath: item });
const context = await card._prepareContext({});
assert.equal(context.description, entry.description);
assert.equal(context.system.hierarchy, entry.hierarchy);
assert.ok(!context.description.includes("<a"));

globalThis.Folder = { create() { throw Error("must reuse folder"); } };
globalThis.Item = {
  createDocuments() { throw Error("must preserve existing ID, not create a duplicate"); },
  async updateDocuments(updates, options) {
    assert.equal(options.recursive, false);
    for (const update of updates) { item.system = clone(update.system); item.flags = clone(update.flags); }
    return updates;
  }
};
const payload = { ...catalog, moralityPaths: [entry], repairReferenceTexts: true };
const first = await RulesJsonImporter.importData(payload, { notify: false });
assert.equal(first.catalogReport.updated, 1);
assert.equal(item.id, "existing-path");
assert.equal(item.system.description.value, entry.description);
assert.deepEqual(item.system.automation, before.automation);
assert.deepEqual(item.flags.otherModule, { preserve: "foreign flags" });
assert.deepEqual(item.flags["vtm-revised"].original, entry, "obsolete original fields must not survive a deep merge");
assert.deepEqual(item.flags["vtm-revised"].catalogBackup.system, before);
const repeat = await RulesJsonImporter.importData(payload, { notify: false });
assert.equal(repeat.catalogReport.updated, 0);
assert.equal(repeat.length, 0);
console.log("reference text repair: stale links and merged flags, full morality card, numerical/manual edits, backups and repeat import");
