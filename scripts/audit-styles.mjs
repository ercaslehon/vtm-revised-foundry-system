#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root = process.cwd();
const sourceDir = path.join(root, "styles", "source");
const manifestPath = path.join(sourceDir, "manifest.json");
const builtCssPath = path.join(root, "styles", "vtm-revised.css");
const docsDir = path.join(root, "docs");
const reportPath = path.join(docsDir, "styles-audit.md");
const jsonPath = path.join(docsDir, "styles-audit.json");

function sha(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function countMatches(text, regex) {
  return [...text.matchAll(regex)].length;
}

function normalizeDeclarations(body = "") {
  return body
    .replace(/\s+/g, " ")
    .replace(/\s*([:;,])\s*/g, "$1")
    .trim();
}

function extractRules(css) {
  const clean = stripComments(css);
  const rules = [];
  const regex = /([^{}@][^{}]*)\{([^{}]*)\}/g;
  let match;

  while ((match = regex.exec(clean))) {
    const selector = match[1].trim().replace(/\s+/g, " ");
    const body = normalizeDeclarations(match[2]);

    if (!selector || !body) continue;
    if (selector.includes("from") || selector.includes("to")) continue;

    rules.push({ selector, body });
  }

  return rules;
}

if (!fs.existsSync(manifestPath)) {
  throw new Error("Missing styles/source/manifest.json");
}

if (!fs.existsSync(builtCssPath)) {
  throw new Error("Missing styles/vtm-revised.css");
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const files = manifest.files ?? [];

const builtCss = fs.readFileSync(builtCssPath, "utf8");
const builtFromSource = files.map(entry => read(entry.file)).join("");

if (builtCss !== builtFromSource) {
  console.error("styles/vtm-revised.css differs from styles/source build.");
  console.error(`built css: ${sha(builtCss)}`);
  console.error(`source:    ${sha(builtFromSource)}`);
  process.exit(1);
}

const modules = [];
const selectorCounts = new Map();
const importantBySelector = new Map();
const exactRuleCounts = new Map();
const exactRuleSamples = new Map();

for (const entry of files) {
  const css = read(entry.file);
  const rules = extractRules(css);

  const selectors = new Set();
  for (const rule of rules) {
    selectors.add(rule.selector);
    selectorCounts.set(rule.selector, (selectorCounts.get(rule.selector) ?? 0) + 1);

    if (rule.body.includes("!important")) {
      importantBySelector.set(rule.selector, (importantBySelector.get(rule.selector) ?? 0) + 1);
    }

    const exactKey = `${rule.selector} { ${rule.body} }`;
    exactRuleCounts.set(exactKey, (exactRuleCounts.get(exactKey) ?? 0) + 1);
    if (!exactRuleSamples.has(exactKey)) {
      exactRuleSamples.set(exactKey, {
        selector: rule.selector,
        body: rule.body,
        files: []
      });
    }
    exactRuleSamples.get(exactKey).files.push(entry.file);
  }

  modules.push({
    file: entry.file,
    title: entry.title ?? "",
    bytes: Buffer.byteLength(css, "utf8"),
    lines: css.split(/\r?\n/).length,
    rules: rules.length,
    uniqueSelectors: selectors.size,
    important: countMatches(css, /!important/g),
    media: countMatches(css, /@media\b/g),
    keyframes: countMatches(css, /@keyframes\b/g)
  });
}

const topSelectors = [...selectorCounts.entries()]
  .filter(([, count]) => count > 1)
  .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  .slice(0, 40)
  .map(([selector, count]) => ({ selector, count }));

const importantHotspots = [...importantBySelector.entries()]
  .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  .slice(0, 40)
  .map(([selector, count]) => ({ selector, count }));

const exactDuplicates = [...exactRuleCounts.entries()]
  .filter(([, count]) => count > 1)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 30)
  .map(([key, count]) => ({
    count,
    selector: exactRuleSamples.get(key).selector,
    files: [...new Set(exactRuleSamples.get(key).files)]
  }));

const summary = {
  generatedAt: new Date().toISOString(),
  sourceModules: files.length,
  cssBytes: Buffer.byteLength(builtCss, "utf8"),
  cssLines: builtCss.split(/\r?\n/).length,
  cssSha256: sha(builtCss),
  totalImportant: modules.reduce((sum, item) => sum + item.important, 0),
  totalRules: modules.reduce((sum, item) => sum + item.rules, 0),
  modules,
  topSelectors,
  importantHotspots,
  exactDuplicates
};

fs.mkdirSync(docsDir, { recursive: true });
fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2) + "\n", "utf8");

function table(headers, rows) {
  const escape = (value) => String(value ?? "").replaceAll("|", "\\|").replace(/\n/g, " ");
  const head = `| ${headers.map(escape).join(" | ")} |`;
  const sep = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map(row => `| ${row.map(escape).join(" | ")} |`);
  return [head, sep, ...body].join("\n");
}

const moduleRows = modules
  .sort((a, b) => b.lines - a.lines)
  .map(item => [
    item.file,
    item.lines,
    item.rules,
    item.uniqueSelectors,
    item.important,
    item.media,
    item.keyframes
  ]);

const selectorRows = topSelectors.map(item => [item.count, item.selector]);
const importantRows = importantHotspots.map(item => [item.count, item.selector]);
const duplicateRows = exactDuplicates.map(item => [
  item.count,
  item.selector,
  item.files.join(", ")
]);

const markdown = `# CSS audit

Generated: ${summary.generatedAt}

## Summary

- Source modules: ${summary.sourceModules}
- CSS size: ${summary.cssBytes} bytes
- CSS lines: ${summary.cssLines}
- CSS SHA-256: \`${summary.cssSha256}\`
- Total rules found: ${summary.totalRules}
- Total \`!important\`: ${summary.totalImportant}

## Modules by size

${table(
  ["File", "Lines", "Rules", "Unique selectors", "!important", "@media", "@keyframes"],
  moduleRows
)}

## Most repeated selectors

${selectorRows.length ? table(["Count", "Selector"], selectorRows) : "_No repeated selectors found._"}

## !important hotspots

${importantRows.length ? table(["Count", "Selector"], importantRows) : "_No !important hotspots found._"}

## Exact duplicate rule candidates

These are exact selector + declaration duplicates. They are candidates for manual review, not automatic deletion.

${duplicateRows.length ? table(["Count", "Selector", "Files"], duplicateRows) : "_No exact duplicate rules found._"}

## Notes

This report does not modify \`styles/vtm-revised.css\`.
Before any cleanup, run:

\`\`\`bash
npm run styles:check
npm run check
\`\`\`
`;

fs.writeFileSync(reportPath, markdown, "utf8");

console.log(`Wrote ${reportPath}`);
console.log(`Wrote ${jsonPath}`);
console.log(`CSS SHA-256: ${summary.cssSha256}`);
console.log(`Modules: ${summary.sourceModules}`);
console.log(`!important count: ${summary.totalImportant}`);
