import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const zipPath = path.join(root, "tools/demon/rules-source/demons.zip");
const extractDir = path.join(root, "tools/demon/rules-source/extracted");
const outDir = path.join(root, "data/demon");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function cleanText(value = "") {
  return String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, "\"")
    .replace(/&laquo;/g, "«")
    .replace(/&raquo;/g, "»")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}

function decodeEscapedUnicodeName(name = "") {
  return name.replace(/#U([0-9a-fA-F]{4})/g, (_, hex) =>
    String.fromCharCode(Number.parseInt(hex, 16))
  );
}

function extractHeadings(html) {
  const headingRegex = /<(h[1-4])\b[^>]*>([\s\S]*?)<\/\1>/gi;
  const headings = [];
  let match;

  while ((match = headingRegex.exec(html))) {
    const level = Number(match[1].slice(1));
    const title = cleanText(match[2]);
    if (!title) continue;

    headings.push({
      level,
      title,
      offset: match.index
    });
  }

  return headings;
}

function sectionText(html, startOffset, endOffset) {
  const fragment = html.slice(startOffset, endOffset);
  return cleanText(fragment);
}

function findRuleSections(sections, terms) {
  return sections.filter(section => {
    const haystack = `${section.title}\n${section.text}`.toLowerCase();
    return terms.some(term => haystack.includes(term.toLowerCase()));
  });
}

ensureDir(path.dirname(zipPath));
ensureDir(extractDir);
ensureDir(outDir);

if (!fs.existsSync(zipPath)) {
  console.error(`Не найден архив: ${zipPath}`);
  console.error("Положи Демоны.zip сюда: tools/demon/rules-source/demons.zip");
  process.exit(1);
}

fs.rmSync(extractDir, { recursive: true, force: true });
ensureDir(extractDir);

try {
  execFileSync("unzip", ["-q", zipPath, "-d", extractDir], { stdio: "inherit" });
} catch (error) {
  console.error("Не удалось распаковать zip. В WSL должен быть unzip.");
  throw error;
}

const htmlFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.toLowerCase().endsWith(".html")) htmlFiles.push(full);
  }
}
walk(extractDir);

if (!htmlFiles.length) {
  console.error("HTML внутри архива не найден.");
  process.exit(1);
}

const htmlPath = htmlFiles.sort((a, b) => fs.statSync(b).size - fs.statSync(a).size)[0];
const rawHtml = fs.readFileSync(htmlPath, "utf8");
const decodedHtmlName = decodeEscapedUnicodeName(path.basename(htmlPath));

const headings = extractHeadings(rawHtml);
const sections = headings.map((heading, index) => {
  const next = headings[index + 1];
  const end = next?.offset ?? rawHtml.length;

  return {
    id: `section-${String(index + 1).padStart(4, "0")}`,
    level: heading.level,
    title: heading.title,
    offset: heading.offset,
    text: sectionText(rawHtml, heading.offset, end)
  };
});

const rulesMap = {
  source: {
    htmlFile: decodedHtmlName,
    extractedAt: new Date().toISOString(),
    sections: sections.length,
    note: "Internal working index. Do not publish full book text in compendiums."
  },
  groups: {
    characterCreation: findRuleSections(sections, [
      "создание персонажа",
      "шаг 1",
      "шаг 2",
      "шаг 3",
      "шаг 4",
      "шаг 5",
      "дополнительные баллы"
    ]).map(s => s.id),

    houses: findRuleSections(sections, [
      "дома тьмы",
      "дома",
      "осквернители",
      "дьяволы",
      "пожиратели",
      "изверги",
      "преступники",
      "кнуты",
      "убийцы"
    ]).map(s => s.id),

    factions: findRuleSections(sections, [
      "группировки",
      "фаустианцы",
      "криптики",
      "люцифериане",
      "жаждущие",
      "миротворцы"
    ]).map(s => s.id),

    faithTormentWillpower: findRuleSections(sections, [
      "вера",
      "расходование веры",
      "получение веры",
      "мука",
      "сила воли"
    ]).map(s => s.id),

    lores: findRuleSections(sections, [
      "знания",
      "знание",
      "небесные силы",
      "апокалиптическая форма"
    ]).map(s => s.id),

    pactsAndThralls: findRuleSections(sections, [
      "договор",
      "договоры",
      "последователи",
      "жатва веры",
      "thrall",
      "слуги"
    ]).map(s => s.id),

    exorcismSummoning: findRuleSections(sections, [
      "экзорцизм",
      "вызов"
    ]).map(s => s.id)
  }
};

const toc = sections.map(({ id, level, title, offset }) => ({ id, level, title, offset }));

const publicSections = sections.map(({ id, level, title, text }) => ({
  id,
  level,
  title,
  // Для рабочей навигации оставляем короткий превью-текст.
  // Полный текст книги в модуль не тащим, потому что мы не варвары. Почти.
  preview: text.slice(0, 500)
}));

fs.writeFileSync(path.join(outDir, "demon-rules-toc.json"), JSON.stringify(toc, null, 2) + "\n", "utf8");
fs.writeFileSync(path.join(outDir, "demon-rules-map.json"), JSON.stringify(rulesMap, null, 2) + "\n", "utf8");
fs.writeFileSync(path.join(outDir, "demon-rules-sections-preview.json"), JSON.stringify(publicSections, null, 2) + "\n", "utf8");

// Полный текст кладём только в tools, не в data/ и не в compendium.
fs.writeFileSync(
  path.join(root, "tools/demon/rules-source/demon-rules-fulltext.local.txt"),
  sections.map(s => `# ${s.id} ${s.title}\n\n${s.text}`).join("\n\n---\n\n"),
  "utf8"
);

console.log("HTML:", decodedHtmlName);
console.log("Sections:", sections.length);
console.log("Generated:");
console.log(" - data/demon/demon-rules-toc.json");
console.log(" - data/demon/demon-rules-map.json");
console.log(" - data/demon/demon-rules-sections-preview.json");
console.log(" - tools/demon/rules-source/demon-rules-fulltext.local.txt");
