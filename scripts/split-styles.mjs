#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourceFile = path.join(root, "styles", "vtm-revised.css");
const sourceDir = path.join(root, "styles", "source");

if (!fs.existsSync(sourceFile)) {
  throw new Error(`Missing ${sourceFile}`);
}

const content = fs.readFileSync(sourceFile, "utf8");
const lines = content.match(/[^\n]*\n|[^\n]+$/g) ?? [];

function isBannerStart(line) {
  return /^\/\*\s*=+/.test(line.trim());
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/vtm revised/g, "vtm")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "section";
}

function titleOf(chunk, index) {
  const vtmTitle = chunk.match(/VTM Revised[^\n\r*]*/i)?.[0];
  if (vtmTitle) return vtmTitle.trim();

  const readableComment = chunk
    .split(/\r?\n/)
    .map(line => line.replace(/^\/\*+|\*\/$/g, "").replace(/^[-=\s]+|[-=\s]+$/g, "").trim())
    .find(line => line && !/^[-=]+$/.test(line));

  return readableComment || (index === 0 ? "Base legacy styles" : `CSS section ${index}`);
}

const starts = [];
for (let i = 0; i < lines.length; i += 1) {
  if (isBannerStart(lines[i])) starts.push(i);
}

const chunks = [];

if (!starts.length) {
  chunks.push({ title: "Base legacy styles", content });
} else {
  if (starts[0] > 0) {
    chunks.push({
      title: "Base legacy styles before versioned overrides",
      content: lines.slice(0, starts[0]).join("")
    });
  }

  for (let i = 0; i < starts.length; i += 1) {
    const start = starts[i];
    const end = starts[i + 1] ?? lines.length;
    const chunk = lines.slice(start, end).join("");
    chunks.push({
      title: titleOf(chunk, chunks.length),
      content: chunk
    });
  }
}

fs.rmSync(sourceDir, { recursive: true, force: true });
fs.mkdirSync(sourceDir, { recursive: true });

const manifest = {
  generatedFrom: "styles/vtm-revised.css",
  note: "Do not edit styles/vtm-revised.css directly. Edit files listed in order, then run npm run styles:build.",
  files: []
};

for (let i = 0; i < chunks.length; i += 1) {
  const number = String(i + 1).padStart(2, "0");
  const filename = `${number}-${slugify(chunks[i].title)}.css`;
  const relativePath = `styles/source/${filename}`;
  fs.writeFileSync(path.join(root, relativePath), chunks[i].content, "utf8");
  manifest.files.push({
    file: relativePath,
    title: chunks[i].title
  });
}

fs.writeFileSync(
  path.join(sourceDir, "manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
  "utf8"
);

console.log(`Split ${sourceFile} into ${manifest.files.length} module(s).`);
for (const entry of manifest.files) console.log(`- ${entry.file} :: ${entry.title}`);
