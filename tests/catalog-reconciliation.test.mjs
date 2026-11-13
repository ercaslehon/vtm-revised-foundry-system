import assert from "node:assert/strict";
import { webcrypto, createHash } from "node:crypto";
import { originalDigest, canonicalJson, isUntouchedImportedItem } from "../scripts/import/catalog-reconciliation.mjs";
import { referenceDisplayItem, isUneditedInventedRarePower } from "../scripts/import/catalog-reference-view.mjs";

globalThis.crypto ??= webcrypto;
globalThis.foundry = { applications: {}, appv1: {} };
globalThis.ui = { notifications: {} };
const settings = new Map();
const folder = { id: "catalog", name: "test-catalog", type: "Item", delete() { throw Error("must not delete folder"); } };
globalThis.game = {
  folders: [folder], items: [],
  i18n: { localize: key => key },
  settings: { register() {}, get: (scope, key) => settings.get(key), async set(scope, key, value) { settings.set(key, value); } }
};
globalThis.Folder = { create() { throw Error("existing folder must be reused"); } };
const { RulesJsonImporter, buildSystemData } = await import("../scripts/import/rules-json-importer.mjs");
const clone = value => JSON.parse(JSON.stringify(value));
function item(id, entry, target = folder) {
  const type = entry.type ?? "disciplinePower";
  const doc = { id, _id: id, name: entry.name, type, folder: target,
    system: buildSystemData(type, entry), flags: { "vtm-revised": { original: clone(entry), source: "test" } } };
  doc.toObject = () => clone({ ...doc, toObject: undefined });
  return doc;
}
const entry = { type: "disciplinePower", name: "source power", parentDiscipline: "test", level: 1, description: "old description", system: "old rules" };
const retired = { ...entry, name: "invented power" };
const untouched = item("untouched", entry);
const edited = item("edited", entry);
edited.system.description.value = "user modification";
const manual = item("manual", entry); manual.flags = {};
const obsolete = item("obsolete", retired);
const obsoleteEdited = item("obsolete-edited", retired); obsoleteEdited.system.description.chat = "user modification";
const outside = item("outside", retired, { id: "another-folder" });
game.items.push(untouched, edited, manual, obsolete, obsoleteEdited, outside);
let backupBeforeDeletion = false;
globalThis.Item = {
  async deleteDocuments(ids) {
    backupBeforeDeletion = ids.every(id => settings.get("catalogRetirementBackup")?.repair?.some(doc => doc._id === id));
    assert.ok(backupBeforeDeletion, "persist backup before removal");
    game.items = game.items.filter(doc => !ids.includes(doc.id));
  },
  async updateDocuments(updates) {
    for (const update of updates) {
      const doc = game.items.find(doc => doc.id === update._id);
      if (update.system) doc.system = update.system;
      if (update.flags) doc.flags = update.flags;
      for (const [key, value] of Object.entries(update)) {
        if (key.startsWith("flags.vtm-revised.")) doc.flags["vtm-revised"][key.slice("flags.vtm-revised.".length)] = value;
      }
    }
    return updates;
  },
  async createDocuments(docs) { assert.equal(docs.length, 0, "must not create duplicates"); return []; }
};
assert.equal(isUntouchedImportedItem(untouched, buildSystemData), true);
assert.equal(isUntouchedImportedItem(edited, buildSystemData), false);
assert.equal(isUntouchedImportedItem(manual, buildSystemData), false);
const rare = { ...retired, audit: { checkedBy: "OpenAI rare advanced disciplines pass" }, mechanics: { duration: "invented" } };
const embeddedRare = item("embedded-rare", rare);
assert.equal(isUneditedInventedRarePower(embeddedRare, buildSystemData), true);
embeddedRare.system.description.value = "customized";
assert.equal(isUneditedInventedRarePower(embeddedRare, buildSystemData), false);
assert.equal(await originalDigest({ z: 1, a: "ё" }), await originalDigest({ a: "ё", z: 1 }));
const savedCrypto = globalThis.crypto;
Object.defineProperty(globalThis, "crypto", { value: undefined, configurable: true });
for (const value of [{}, { a: "ё 漢 🦇" }, { long: "abc".repeat(10000) }, entry, retired]) {
  assert.equal(await originalDigest(value), createHash("sha256").update(canonicalJson(value)).digest("hex"), "HTTP fallback hash");
}
Object.defineProperty(globalThis, "crypto", { value: savedCrypto, configurable: true });
const payload = { folderName: folder.name, replaceFolder: true, reconcileImported: true, dedupe: true,
  catalogRevision: "repair", disciplinePowers: [{ ...entry, description: "source description", system: "source rules" }],
  removedEntries: [{ originalDigest: await originalDigest(retired) }] };
const result = await RulesJsonImporter.importData(payload, { notify: false });
assert.deepEqual(result.catalogReport, { updated: 1, removed: 1, preserved: 2 });
assert.equal(untouched.id, "untouched");
assert.equal(untouched.system.description.value, "source description");
assert.equal(untouched.flags["vtm-revised"].catalogBackup.original.description, "old description");
assert.equal(edited.system.description.value, "user modification");
assert.ok(game.items.includes(manual));
assert.ok(game.items.includes(outside));
assert.ok(game.items.includes(obsoleteEdited));
assert.ok(!game.items.includes(obsolete));
const repeat = await RulesJsonImporter.importData(payload, { notify: false });
assert.equal(repeat.catalogReport.updated, 0);
assert.equal(repeat.catalogReport.removed, 0);
assert.equal(settings.get("catalogRetirementBackup").repair.length, 1);
const twinOriginal = { ...retired, name: entry.name, description: "invented duplicate of canonical identity" };
const twin = item("obsolete-twin", twinOriginal);
game.items.push(twin);
const twinResult = await RulesJsonImporter.importData({ ...payload, removedEntries: [{ originalDigest: await originalDigest(twinOriginal) }] }, { notify: false });
assert.equal(twinResult.catalogReport.removed, 1);
assert.equal(twinResult.catalogReport.updated, 0, "must not update already removed duplicate");
assert.ok(!game.items.includes(twin));
assert.ok(game.items.includes(untouched));
const embedded = item("embedded", entry);
embedded.system.rating = 4;
assert.equal(referenceDisplayItem(embedded, game.items, buildSystemData), untouched);
assert.equal(embedded.system.description.value, "old description", "display must not mutate actor item");
embedded.system.description.value = "customized";
assert.equal(referenceDisplayItem(embedded, game.items, buildSystemData), embedded);
const customizedRoll = item("customized-roll", entry);
customizedRoll.system.automation.roll.difficulty = 8;
assert.equal(referenceDisplayItem(customizedRoll, game.items, buildSystemData), customizedRoll);
const oldFlight = item("old-flight", { type: "discipline", name: "Полёт", description: "invented overview" });
oldFlight.system.rating = 4;
const sourceFlight = item("source-flight", { type: "discipline", name: "Полёт Горгулий", aliases: ["Полёт"], description: "source reference" });
sourceFlight.flags["vtm-revised"].catalogRevision = "repair";
assert.equal(referenceDisplayItem(oldFlight, [sourceFlight], buildSystemData), sourceFlight);
assert.equal(oldFlight.system.rating, 4);
console.log("catalog reconciliation tests passed");
