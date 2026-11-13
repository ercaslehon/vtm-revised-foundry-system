import assert from "node:assert/strict";
import fs from "node:fs";
import { sourceIntegrityErrors } from "../scripts/import/catalog-source-integrity.mjs";

const catalog = name => JSON.parse(fs.readFileSync(new URL(`../data/vtm-revised-${name}.generated.json`, import.meta.url), "utf8"));
const core = catalog("core-disciplines");
assert.equal(core.disciplinePowers.filter(power => power.parentDiscipline === "Демонизм").length, 15);
assert.equal(core.removedEntries.filter(power => power.parentDiscipline === "Демонизм").length, 10);
assert.equal(core.removedEntries.filter(entry => entry.type === "disciplinePower").length, 87);
assert.ok(!core.disciplines.some(entry => entry.name === "Полёт"));
assert.ok(core.disciplines.find(entry => entry.name === "Полёт Горгулий").aliases.includes("Полёт"));
assert.ok(!catalog("clans").clans.some(entry => entry.name === "Цимисхи антитрибу"));
const merits = catalog("merits-flaws");
for (const entry of [...merits.merits, ...merits.flaws]) assert.ok(entry.description.trim(), entry.name);
for (const name of ["core-disciplines", "blood-magic", "rituals", "clans", "backgrounds", "merits-flaws", "morality", "weapons"]) {
  const data = catalog(name);
  assert.equal(data.replaceFolder, false);
  assert.equal(data.reconcileImported, true);
  for (const key of ["disciplines", "disciplinePowers", "disciplinePaths", "rituals", "clans", "backgrounds", "merits", "flaws", "moralityPaths", "weapons"]) {
    for (const entry of data[key] ?? []) assert.deepEqual(sourceIntegrityErrors(entry), [], `${name}: ${entry.name}`);
  }
}
const sample = { sourceUrl: "https://wod.su/vampire/disciplines/daimoinon", description: "local prose", contentMode: "source-reference", audit: { status: "verified" } };
assert.ok(sourceIntegrityErrors(sample).includes("non-source content marked verified"));
assert.deepEqual(sourceIntegrityErrors({ ...sample, contentMode: "local-source-text" }), []);
assert.ok(sourceIntegrityErrors({ ...sample, description: '<p><a href="https://wod.su/vampire/paths/humanity">Описание</a></p>' }).includes("source hyperlink substituted for reference text"));
assert.ok(sourceIntegrityErrors({ ...sample, description: "Литературно: invented" }).includes("invented template or captured website navigation"));
assert.ok(sourceIntegrityErrors({ ...sample, sourceUrl: "" }).includes("missing wod.su source URL"));
console.log("catalog source integrity tests passed");
