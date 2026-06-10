#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import process from "node:process";

const root = process.cwd();
const manifestPath = path.join(root, "styles", "source", "manifest.json");
const outputPath = path.join(root, "styles", "vtm-revised.css");

if (!fs.existsSync(manifestPath)) {
  throw new Error("Missing styles/source/manifest.json. Run npm run styles:split first.");
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const built = manifest.files
  .map(entry => fs.readFileSync(path.join(root, entry.file), "utf8"))
  .join("");

function sha(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

const mode = process.argv.includes("--check") ? "check" : "write";

if (mode === "check") {
  const current = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, "utf8") : "";
  if (current !== built) {
    console.error("styles/vtm-revised.css differs from styles/source build.");
    console.error(`current: ${sha(current)}`);
    console.error(`built:   ${sha(built)}`);
    process.exit(1);
  }

  console.log("OK: styles/vtm-revised.css matches styles/source build.");
  console.log(`sha256: ${sha(current)}`);
  process.exit(0);
}

fs.writeFileSync(outputPath, built, "utf8");
console.log(`Built ${outputPath}`);
console.log(`sha256: ${sha(built)}`);
