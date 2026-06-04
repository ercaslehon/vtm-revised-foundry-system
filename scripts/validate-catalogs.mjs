#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();

const GENERATED_CATALOGS = [
  "data/vtm-revised-core-disciplines.generated.json",
  "data/vtm-revised-blood-magic.generated.json",
  "data/vtm-revised-rituals.generated.json",
  "data/vtm-revised-clans.generated.json",
  "data/vtm-revised-weapons.generated.json",
  "data/vtm-revised-backgrounds.generated.json",
  "data/vtm-revised-merits-flaws.generated.json",
  "data/vtm-revised-morality.generated.json"
];

const COLLECTION_KEYS = [
  "clans", "sects", "disciplines", "powers", "disciplinePowers", "paths", "disciplinePaths",
  "rituals", "merits", "flaws", "backgrounds", "equipment", "weapons",
  "moralityPaths", "pathsOfEnlightenment", "roads", "rules", "ruleEntries"
];

const REQUIRED_CLAN_FIELDS = ["name", "slug", "description", "shortDescription"];
const REQUIRED_EXPANDED_CLAN_FIELDS = ["theme", "embrace", "societyPlace", "characterHooks", "storytellerHooks"];
const REQUIRED_MORALITY_FIELDS = ["name", "slug", "description", "ethics", "hierarchy"];
const REQUIRED_DISCIPLINE_FIELDS = ["name", "slug", "description"];
const REQUIRED_POWER_FIELDS = ["name", "level", "parentDiscipline", "description"];

const DISCIPLINE_PLACEHOLDER_NAMES = new Set([
  "любые с разрешения мастера",
  "по выбору рассказчика",
  "по выбору мастера",
  "по крови",
  "по истории",
  "нет фиксированного набора",
  "по выбору игрока"
].map(normalizeName));

let failures = 0;
let warnings = 0;

function logOk(message) { console.log(`✓ ${message}`); }
function warn(message) { warnings += 1; console.warn(`⚠ ${message}`); }
function fail(message) { failures += 1; console.error(`✗ ${message}`); }

function readText(file) { return fs.readFileSync(file, "utf8"); }

function readJson(relativePath) {
  const file = path.join(ROOT, relativePath);
  try { return JSON.parse(readText(file)); }
  catch (err) {
    fail(`${relativePath}: invalid JSON: ${err.message}`);
    return null;
  }
}

function isMeaningful(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") return Object.keys(value).length > 0;
  return String(value ?? "").trim().length > 0;
}

function normalizeName(value = "") {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replaceAll("ё", "е")
    .replace(/[«»"']/g, "")
    .replace(/[\\/_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function normalizeArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return String(value).split(",").map(part => part.trim()).filter(Boolean);
}

function collectEntries(payload, sourcePath) {
  const entries = [];
  if (!payload) return entries;

  if (Array.isArray(payload)) {
    payload.forEach((entry, index) => entries.push({ key: "items", entry, index, sourcePath }));
    return entries;
  }

  for (const key of COLLECTION_KEYS) {
    const collection = payload[key];
    if (!collection) continue;
    if (!Array.isArray(collection)) {
      fail(`${sourcePath}: collection "${key}" must be an array`);
      continue;
    }
    collection.forEach((entry, index) => entries.push({ key, entry, index, sourcePath }));
  }

  if (Array.isArray(payload.items)) payload.items.forEach((entry, index) => entries.push({ key: "items", entry, index, sourcePath }));
  return entries;
}

function entryType(key, entry) {
  if (entry?.type) return entry.type;
  if (key === "clans") return "clan";
  if (key === "sects") return "sect";
  if (key === "disciplines") return "discipline";
  if (key === "powers" || key === "disciplinePowers") return "disciplinePower";
  if (key === "paths" || key === "disciplinePaths") return "disciplinePath";
  if (key === "rituals") return "ritual";
  if (key === "merits") return "merit";
  if (key === "flaws") return "flaw";
  if (key === "backgrounds") return "background";
  if (key === "weapons") return "weapon";
  if (key === "equipment") return "equipment";
  if (["moralityPaths", "pathsOfEnlightenment", "roads"].includes(key)) return "moralityPath";
  return "ruleEntry";
}

function checkRequiredFields(entry, fields, label) {
  for (const field of fields) if (!isMeaningful(entry[field])) fail(`${label}: missing required field "${field}"`);
}

function collectNameAliases(entry) {
  const values = [entry.name, entry.nameEn, entry.slug, entry.rulesId, entry.rawName, entry.parentClan];
  for (const alias of normalizeArray(entry.aliases)) values.push(alias);
  return values.map(normalizeName).filter(Boolean);
}

function parseAbilityCategories(configText) {
  const match = configText.match(/abilityCategories:\s*\{\s*talents:\s*(\[[^\]]*\]),\s*skills:\s*(\[[^\]]*\]),\s*knowledges:\s*(\[[^\]]*\])/s);
  if (!match) {
    fail("scripts/config.mjs: could not parse abilityCategories");
    return null;
  }
  try {
    return { talents: JSON.parse(match[1]), skills: JSON.parse(match[2]), knowledges: JSON.parse(match[3]) };
  } catch (err) {
    fail(`scripts/config.mjs: abilityCategories are not JSON-like arrays: ${err.message}`);
    return null;
  }
}

function validateSystemManifest(system) {
  if (!system) return;
  if (!isMeaningful(system.id)) fail("system.json: missing id");
  if (!isMeaningful(system.title)) fail("system.json: missing title");
  if (!isMeaningful(system.version)) fail("system.json: missing version");
  if (!isMeaningful(system.url)) fail("system.json: missing public repository url");
  if (!isMeaningful(system.manifest)) fail("system.json: missing public manifest url");
  if (!isMeaningful(system.download)) fail("system.json: missing public download url");

  if (isMeaningful(system.manifest) && String(system.manifest).includes("/blob/")) {
    fail("system.json: manifest must use a raw JSON URL, not a github.com/blob URL");
  }

  if (isMeaningful(system.manifest) && !String(system.manifest).endsWith("/system.json")) {
    warn("system.json: manifest URL does not end with /system.json");
  }

  if (isMeaningful(system.download) && !String(system.download).endsWith(".zip")) {
    fail("system.json: download URL must point to a .zip archive");
  }

  for (const esm of system.esmodules ?? []) if (!fs.existsSync(path.join(ROOT, esm))) fail(`system.json: esmodule does not exist: ${esm}`);
  for (const style of system.styles ?? []) if (!fs.existsSync(path.join(ROOT, style))) fail(`system.json: style does not exist: ${style}`);

  for (const language of system.languages ?? []) {
    if (!language.path) { fail("system.json: language entry missing path"); continue; }
    if (!fs.existsSync(path.join(ROOT, language.path))) fail(`system.json: language file does not exist: ${language.path}`);
  }

  logOk(`system.json manifest checked, version ${system.version}`);
}

function validateCatalogJsonFiles() {
  const payloads = new Map();
  for (const catalogPath of GENERATED_CATALOGS) {
    const full = path.join(ROOT, catalogPath);
    if (!fs.existsSync(full)) { fail(`${catalogPath}: catalog file is missing`); continue; }
    const payload = readJson(catalogPath);
    if (payload) { payloads.set(catalogPath, payload); logOk(`${catalogPath} parsed`); }
  }
  return payloads;
}

function uniqueIdentity(type, entry) {
  const parent = normalizeName(entry.parentDiscipline ?? entry.discipline ?? entry.parentClan ?? "");
  const name = normalizeName(entry.name ?? "");
  const slug = normalizeName(entry.slug ?? "");
  const rulesId = normalizeName(entry.rulesId ?? "");

  if (type === "disciplinePower") return `${type}::${parent || "no-parent"}::${name || rulesId || String(entry.level ?? entry.rating ?? "")}`;
  if (type === "disciplinePath") return `${type}::${parent || "no-parent"}::${name || slug || rulesId}`;
  if (type === "ritual") return `${type}::${normalizeName(entry.discipline ?? "ritual")}::${name || slug || rulesId}`;
  return `${type}::${slug || rulesId || name}`;
}

function validateUniqueEntries(allEntries) {
  const seen = new Map();

  for (const item of allEntries) {
    const { key, entry, index, sourcePath } = item;
    const type = entryType(key, entry);
    const label = `${sourcePath}:${key}[${index}]`;

    if (!entry || typeof entry !== "object") { fail(`${label}: entry must be an object`); continue; }
    if (!isMeaningful(entry.name)) fail(`${label}: missing name`);

    const identity = uniqueIdentity(type, entry);
    if (identity.endsWith("::")) continue;

    if (seen.has(identity)) {
      if (type === "discipline" || type === "disciplinePath") warn(`${label}: duplicate ${type} identity "${identity}" also used by ${seen.get(identity)}; built-in import dedupe should skip duplicates`);
      else fail(`${label}: duplicate identity "${identity}" also used by ${seen.get(identity)}`);
    } else {
      seen.set(identity, label);
    }
  }

  logOk("catalog uniqueness checked");
}

function buildDisciplineIndex(allEntries) {
  const names = new Set();
  for (const { key, entry } of allEntries) {
    const type = entryType(key, entry);
    if (type !== "discipline" && type !== "disciplinePath") continue;
    for (const name of collectNameAliases(entry)) names.add(name);
  }
  return names;
}

function validateDisciplinesAndPowers(allEntries) {
  const disciplineNames = buildDisciplineIndex(allEntries);
  const powersByParent = new Map();

  for (const item of allEntries) {
    const { key, entry, index, sourcePath } = item;
    const type = entryType(key, entry);
    const label = `${sourcePath}:${key}[${index}]`;

    if (type === "discipline") checkRequiredFields(entry, REQUIRED_DISCIPLINE_FIELDS, label);

    if (type === "disciplinePower") {
      checkRequiredFields(entry, REQUIRED_POWER_FIELDS, label);

      if (!isMeaningful(entry.systemText) && !isMeaningful(entry.system) && !isMeaningful(entry.mechanics?.automationNotes)) warn(`${label}: missing recommended mechanics/system text`);

      const parent = normalizeName(entry.parentDiscipline ?? entry.discipline ?? "");
      if (!parent) continue;
      if (!disciplineNames.has(parent)) fail(`${label}: parentDiscipline "${entry.parentDiscipline}" has no matching discipline or discipline path`);

      const level = Number(entry.level ?? entry.rating);
      if (!Number.isInteger(level) || level < 1) {
        fail(`${label}: level must be a positive integer`);
      } else {
        if (!powersByParent.has(parent)) powersByParent.set(parent, new Set());
        powersByParent.get(parent).add(level);
      }
    }
  }

  for (const [parent, levelSet] of powersByParent.entries()) {
    const levels = Array.from(levelSet).sort((a, b) => a - b);
    const min = levels[0];
    const max = levels.at(-1);
    if (min > 1) { warn(`discipline powers for "${parent}": starts at level ${min}; lower levels may be represented by passive dots or another catalog`); continue; }
    for (let level = 1; level <= max; level += 1) if (!levelSet.has(level)) warn(`discipline powers for "${parent}": missing level ${level}; present levels: ${levels.join(", ")}`);
  }

  logOk("disciplines and discipline powers checked");
}

function validateClanDisciplineLinks(allEntries) {
  const disciplineNames = buildDisciplineIndex(allEntries);
  for (const item of allEntries) {
    const { key, entry, index, sourcePath } = item;
    const type = entryType(key, entry);
    if (type !== "clan") continue;

    const label = `${sourcePath}:${key}[${index}]`;
    checkRequiredFields(entry, REQUIRED_CLAN_FIELDS, label);

    const hasExpandedSections = REQUIRED_EXPANDED_CLAN_FIELDS.some(field => isMeaningful(entry[field]));
    if (hasExpandedSections) checkRequiredFields(entry, REQUIRED_EXPANDED_CLAN_FIELDS, label);

    const disciplines = normalizeArray(entry.disciplines ?? entry.clanDisciplines);
    if (!disciplines.length) { warn(`${label}: clan has no fixed disciplines`); continue; }

    for (const discipline of disciplines) {
      const normalized = normalizeName(discipline);
      if (DISCIPLINE_PLACEHOLDER_NAMES.has(normalized)) { warn(`${label}: discipline placeholder "${discipline}" is allowed`); continue; }
      if (!disciplineNames.has(normalized)) fail(`${label}: clan discipline "${discipline}" has no matching discipline in catalogs`);
    }
  }
  logOk("clan discipline links checked");
}

function validateMorality(allEntries) {
  for (const item of allEntries) {
    const { key, entry, index, sourcePath } = item;
    if (entryType(key, entry) !== "moralityPath") continue;
    checkRequiredFields(entry, REQUIRED_MORALITY_FIELDS, `${sourcePath}:${key}[${index}]`);
  }
  logOk("morality path cards checked");
}

function validateConfigAndLocalization() {
  const configFile = path.join(ROOT, "scripts/config.mjs");
  if (!fs.existsSync(configFile)) { fail("scripts/config.mjs: file is missing"); return; }

  const abilities = parseAbilityCategories(readText(configFile));
  if (!abilities) return;

  const expectedAbilities = {
    talents: ["athletics", "alertness", "brawl", "intimidation", "expression", "leadership", "dodge", "streetwise", "subterfuge", "empathy"],
    skills: ["security", "drive", "survival", "performance", "animalken", "crafts", "stealth", "firearms", "melee", "etiquette"],
    knowledges: ["academics", "science", "law", "computer", "linguistics", "medicine", "occult", "politics", "investigation", "finance"]
  };

  for (const group of Object.keys(expectedAbilities)) {
    if (JSON.stringify(abilities[group] ?? []) !== JSON.stringify(expectedAbilities[group])) fail(`scripts/config.mjs: ${group} ability list differs from expected V20 project sheet`);
  }

  const allAbilities = Object.values(expectedAbilities).flat();
  for (const langPath of ["lang/ru.json", "lang/en.json"]) {
    const lang = readJson(langPath);
    if (!lang) continue;
    for (const ability of allAbilities) if (!isMeaningful(lang?.VTM_REVISED?.Ability?.[ability]) && !isMeaningful(lang?.[`VTM_REVISED.Ability.${ability}`])) fail(`${langPath}: missing localization for ability "${ability}"`);
  }

  logOk("config abilities and localization checked");
}

function validateTemplatesPreloaded() {
  const mainFile = path.join(ROOT, "vtm-revised.mjs");
  if (!fs.existsSync(mainFile)) { fail("vtm-revised.mjs: file is missing"); return; }
  const text = readText(mainFile);
  const templateMatches = Array.from(text.matchAll(/"systems\/vtm-revised\/([^"]+\.hbs)"/g)).map(match => match[1]);
  for (const templatePath of templateMatches) if (!fs.existsSync(path.join(ROOT, templatePath))) fail(`vtm-revised.mjs: preloaded template does not exist: ${templatePath}`);
  logOk(`preloaded templates checked (${templateMatches.length})`);
}

function validateVersionReferences(systemVersion) {
  if (!systemVersion) return;
  for (const docPath of ["CHANGELOG.md", "README.md"]) {
    const file = path.join(ROOT, docPath);
    if (!fs.existsSync(file)) { warn(`${docPath}: file is missing`); continue; }
    if (!readText(file).includes(systemVersion)) fail(`${docPath}: does not mention current system version ${systemVersion}`);
  }
  logOk("version references checked");
}

function validateNodeSyntax() {
  const files = ["vtm-revised.mjs", "scripts/import/rules-json-importer.mjs", "scripts/import/catalog-auto-seeder.mjs", "scripts/validate-catalogs.mjs"].filter(file => fs.existsSync(path.join(ROOT, file)));
  for (const file of files) {
    const result = spawnSync(process.execPath, ["--check", path.join(ROOT, file)], { encoding: "utf8" });
    if (result.status !== 0) fail(`${file}: JavaScript syntax check failed: ${result.stderr || result.stdout || `exit code ${result.status}`}`);
  }
  if (files.length) logOk(`JavaScript syntax checked (${files.length})`);
}

function validate() {
  const system = readJson("system.json");
  validateSystemManifest(system);
  const payloads = validateCatalogJsonFiles();
  const allEntries = Array.from(payloads.entries()).flatMap(([sourcePath, payload]) => collectEntries(payload, sourcePath));

  validateUniqueEntries(allEntries);
  validateDisciplinesAndPowers(allEntries);
  validateClanDisciplineLinks(allEntries);
  validateMorality(allEntries);
  validateConfigAndLocalization();
  validateTemplatesPreloaded();
  validateVersionReferences(system?.version);
  validateNodeSyntax();

  console.log("");
  console.log(`Catalog validation complete: ${failures} error(s), ${warnings} warning(s).`);
  if (failures > 0) process.exit(1);
}

validate();
