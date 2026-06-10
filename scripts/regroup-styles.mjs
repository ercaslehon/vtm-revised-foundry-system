#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root = process.cwd();
const sourceDir = path.join(root, "styles", "source");
const manifestPath = path.join(sourceDir, "manifest.json");
const outputPath = path.join(root, "styles", "vtm-revised.css");

if (!fs.existsSync(manifestPath)) {
  throw new Error("Missing styles/source/manifest.json. Run npm run styles:split first.");
}

const oldManifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const oldFiles = oldManifest.files ?? [];

function numberOf(entry) {
  const base = path.basename(entry.file);
  const match = base.match(/^(\d+)-/);
  return match ? Number(match[1]) : 9999;
}

function sha(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function entriesInRange(min, max) {
  return oldFiles
    .filter(entry => {
      const number = numberOf(entry);
      return number >= min && number <= max;
    })
    .sort((a, b) => numberOf(a) - numberOf(b));
}

function readEntry(entry) {
  return fs.readFileSync(path.join(root, entry.file), "utf8");
}

const currentBuilt = oldFiles
  .sort((a, b) => numberOf(a) - numberOf(b))
  .map(readEntry)
  .join("");

const currentCss = fs.existsSync(outputPath)
  ? fs.readFileSync(outputPath, "utf8")
  : "";

if (currentCss !== currentBuilt) {
  console.error("Refusing to regroup: current styles/vtm-revised.css does not match existing source manifest.");
  console.error(`css:    ${sha(currentCss)}`);
  console.error(`source: ${sha(currentBuilt)}`);
  process.exit(1);
}

const groups = [
  {
    file: "01-foundation-and-legacy-apps.css",
    title: "Foundation, legacy base styles, cards, wizard, morality, early app styles",
    ranges: [[1, 1]]
  },
  {
    file: "02-vampire-sheet-layout-history.css",
    title: "Vampire sheet layout history from v9.5.2 to v9.5.10",
    ranges: [[2, 10]]
  },
  {
    file: "03-traits-health-blood-magic-and-pips.css",
    title: "Trait pips, health states, blood magic rows and discipline list polish",
    ranges: [[11, 24]]
  },
  {
    file: "04-chat-portrait-clan-and-experience.css",
    title: "Readable chat cards, portrait viewer, clan cards and experience journal",
    ranges: [[25, 29]]
  },
  {
    file: "05-release-hotfixes-and-item-directory.css",
    title: "Release hotfixes and item directory import button layout",
    ranges: [[30, 31]]
  },
  {
    file: "06-clan-icon-overrides.css",
    title: "Clan icon placement overrides",
    ranges: [[32, 41]]
  },
  {
    file: "07-search-dialogs-and-wizard.css",
    title: "Searchable dialogs and character creation wizard select polish",
    ranges: [[42, 53]]
  },
  {
    file: "08-merit-flaw-and-catalog-pickers.css",
    title: "Merit/flaw and extended catalog picker previews",
    ranges: [[54, 65]]
  },
  {
    file: "09-health-damage-state-overrides.css",
    title: "Final health damage state colors and strong tint overrides",
    ranges: [[66, 69]]
  }
];

const newEntries = [];
const generated = [];

for (const group of groups) {
  const entries = group.ranges.flatMap(([min, max]) => entriesInRange(min, max));
  if (!entries.length) continue;

  const content = entries.map(readEntry).join("");
  generated.push({
    file: `styles/source/${group.file}`,
    title: group.title,
    content,
    sourceFiles: entries.map(entry => entry.file)
  });
}

const newBuilt = generated.map(entry => entry.content).join("");

if (newBuilt !== currentCss) {
  console.error("Refusing to write: regrouped CSS would change built output.");
  console.error(`current: ${sha(currentCss)}`);
  console.error(`new:     ${sha(newBuilt)}`);
  process.exit(1);
}

for (const entry of oldFiles) {
  const absolute = path.join(root, entry.file);
  if (fs.existsSync(absolute)) fs.unlinkSync(absolute);
}

for (const entry of generated) {
  const absolute = path.join(root, entry.file);
  fs.writeFileSync(absolute, entry.content, "utf8");
  newEntries.push({
    file: entry.file,
    title: entry.title,
    sourceFiles: entry.sourceFiles
  });
}

const newManifest = {
  generatedFrom: "styles/vtm-revised.css",
  note: "Edit these grouped source files, then run npm run styles:build and npm run styles:check. The loaded CSS file is styles/vtm-revised.css.",
  grouping: "Grouped from the initial 69 split modules without changing generated CSS output.",
  files: newEntries
};

fs.writeFileSync(manifestPath, JSON.stringify(newManifest, null, 2) + "\n", "utf8");

console.log(`Regrouped ${oldFiles.length} CSS modules into ${newEntries.length} grouped module(s).`);
console.log(`sha256: ${sha(newBuilt)}`);
for (const entry of newEntries) {
  console.log(`- ${entry.file} :: ${entry.title}`);
}
