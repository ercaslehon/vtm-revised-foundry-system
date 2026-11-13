import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import { VTM_REVISED } from "../scripts/config.mjs";
import { DEMON_ARCHETYPES } from "../scripts/data/demon/demon-archetypes.mjs";
import { DEMON_CATALOGS } from "../scripts/data/demon/demon-catalogs.mjs";
import { DEMON_RULES } from "../scripts/data/demon/demon-rules.mjs";
import { DEMON_APOCALYPTIC_FORMS } from "../scripts/data/demon/demon-apocalyptic-forms.mjs";
import { getDemonInvocation } from "../scripts/data/demon/demon-invocations.mjs";
import { TRAIT_SOURCE_TEXT } from "../scripts/data/trait-source-text.generated.mjs";

const kinds = ["disciplines", "disciplinePaths", "disciplinePowers", "rituals", "clans", "backgrounds", "merits", "flaws", "moralityPaths", "weapons"];
const textKeys = ["description", "system", "ethics", "hierarchy", "aura", "initiation", "virtues", "weakness", "organization", "stereotypes", "summary", "shortDescription", "chat"];
let total = 0, confirmed = 0, unconfirmed = 0;
for (const file of fs.readdirSync(new URL("../data/", import.meta.url)).filter(name => name.endsWith(".generated.json"))) {
  const data = JSON.parse(fs.readFileSync(new URL(`../data/${file}`, import.meta.url), "utf8"));
  assert.equal(data.catalogRevision, "wod-local-text-20261008-2");
  for (const kind of kinds) for (const entry of data[kind] ?? []) {
    total++;
    assert.ok(entry.description.trim(), entry.name);
    for (const key of textKeys) assert.ok(!/<a\b/i.test(String(entry[key] ?? "")), `${entry.name}: ${key} is not a hyperlink substitute`);
    assert.ok(!entry.system || entry.description !== entry.system, `${entry.name}: duplicate description/system`);
    if (entry.contentMode === "local-source-text") {
      confirmed++;
      assert.equal(entry.audit.textStatus, "verified");
      assert.ok(entry.audit.localSourceFile.endsWith(".html"));
      assert.match(entry.audit.sourceTextSha256, /^[a-f0-9]{64}$/);
    } else {
      unconfirmed++;
      assert.equal(entry.contentMode, "unconfirmed-local-text");
      assert.equal(entry.audit.textStatus, "unconfirmed");
      assert.equal(entry.audit.status, "needs-review");
      assert.equal(entry.isHomebrew, true);
    }
  }
}
assert.equal(total, 1583);
assert.equal(confirmed, 1552);
assert.equal(unconfirmed, 31);
for (const [kind, count] of [["backgrounds", 11], ["virtues", 3]]) {
  assert.equal(DEMON_CATALOGS[kind].length, count);
  for (const entry of DEMON_CATALOGS[kind]) {
    assert.ok(entry.summary.trim(), entry.label);
    assert.equal(entry.audit.textStatus, "verified");
    assert.equal(DEMON_RULES[kind].find(rule => rule.key === entry.key).summary, entry.summary);
  }
}
assert.equal(VTM_REVISED.archetypeOptions.length, 30);
assert.equal(DEMON_ARCHETYPES.length, 31);
for (const entry of [...VTM_REVISED.archetypeOptions, ...DEMON_ARCHETYPES]) {
  assert.ok(entry.summary.trim(), entry.name);
  assert.ok(entry.regain.trim(), `${entry.name}: willpower regain rule`);
  assert.equal(entry.motto, "");
}
for (const [profile, count] of [["vampire", 39], ["demon", 45]]) {
  const entries = Object.values(TRAIT_SOURCE_TEXT[profile]).flatMap(Object.values);
  assert.equal(entries.length, count);
  for (const entry of entries) {
    assert.ok(entry.summary.trim(), entry.label);
    assert.ok(entry.examples.trim(), `${entry.label}: ratings/specializations`);
    assert.match(entry.sourceUrl, /^https:\/\/wod\.su\//);
  }
}
const fixture = JSON.parse(fs.readFileSync(new URL("./fixtures/local-text-mechanics.json", import.meta.url), "utf8"));
let powers = 0;
for (const [key, invocations] of Object.entries(fixture.invocations)) for (const before of invocations) {
  powers++;
  const actual = getDemonInvocation(key, before.level);
  for (const [field, value] of Object.entries(before)) assert.deepEqual(actual[field], value, `${key} ${before.level}: ${field}`);
}
assert.equal(powers, 130);
assert.equal(crypto.createHash("sha256").update(JSON.stringify(DEMON_APOCALYPTIC_FORMS)).digest("hex"), fixture.demonFormsSha256);
console.log("local source prose: 1583 cards, 61 archetypes, 84 traits; 130 invocations and forms retain numerical behavior");
