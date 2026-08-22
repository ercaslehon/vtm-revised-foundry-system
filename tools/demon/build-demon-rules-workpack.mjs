import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const tocPath = path.join(root, "data/demon/demon-rules-toc.json");
const fulltextPath = path.join(root, "tools/demon/rules-source/demon-rules-fulltext.local.txt");
const outDir = path.join(root, "tools/demon/rules-source/workpack");

function clean(value = "") {
  return String(value)
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function slugify(value = "") {
  return value
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function findSectionsByTitle(toc, patterns) {
  return toc.filter(section => {
    const title = section.title.toLowerCase();
    return patterns.some(pattern => pattern.test(title));
  });
}

function parseFulltext(fulltext) {
  const chunks = fulltext.split(/\n\n---\n\n/g);
  const map = new Map();

  for (const chunk of chunks) {
    const match = chunk.match(/^#\s+(section-\d+)\s+(.+?)\n\n([\s\S]*)$/);
    if (!match) continue;

    map.set(match[1], {
      id: match[1],
      title: match[2].trim(),
      text: clean(match[3])
    });
  }

  return map;
}

function sectionPreview(section, max = 1400) {
  const text = clean(section.text);
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function writeSectionPack(name, sections) {
  const file = path.join(outDir, `${name}.md`);
  const body = [
    `# ${name}`,
    "",
    `Sections: ${sections.length}`,
    "",
    ...sections.map(section => [
      `## ${section.id} ${section.title}`,
      "",
      sectionPreview(section),
      ""
    ].join("\n"))
  ].join("\n");

  fs.writeFileSync(file, body, "utf8");
  return file;
}

fs.mkdirSync(outDir, { recursive: true });

if (!fs.existsSync(tocPath)) {
  console.error(`Не найден ${tocPath}. Сначала запусти extract-demon-rules.mjs`);
  process.exit(1);
}

if (!fs.existsSync(fulltextPath)) {
  console.error(`Не найден ${fulltextPath}. Сначала запусти extract-demon-rules.mjs`);
  process.exit(1);
}

const toc = JSON.parse(fs.readFileSync(tocPath, "utf8"));
const fulltext = fs.readFileSync(fulltextPath, "utf8");
const sectionsById = parseFulltext(fulltext);

const chapters = toc.filter(section => /^глава\s+\d+/i.test(section.title));
const chapterRanges = chapters.map((chapter, index) => {
  const next = chapters[index + 1];
  return {
    id: chapter.id,
    title: chapter.title,
    startOffset: chapter.offset,
    endOffset: next?.offset ?? Number.POSITIVE_INFINITY
  };
});

const chapterIndex = chapters.map((chapter, index) => {
  const range = chapterRanges[index];
  const childTitles = toc
    .filter(section => section.offset > range.startOffset && section.offset < range.endOffset)
    .slice(0, 80)
    .map(section => ({
      id: section.id,
      level: section.level,
      title: section.title
    }));

  return {
    id: chapter.id,
    title: chapter.title,
    children: childTitles
  };
});

fs.writeFileSync(
  path.join(outDir, "chapter-index.json"),
  JSON.stringify(chapterIndex, null, 2) + "\n",
  "utf8"
);

const targetGroups = {
  "01-character-creation": [
    /создание персонажа/i,
    /персонаж/i,
    /шаг\s*\d+/i,
    /атрибут/i,
    /способност/i,
    /дополнен/i,
    /добродетел/i,
    /свободн/i,
    /опыт/i
  ],
  "02-faith-torment-willpower": [
    /^вера$/i,
    /получение веры/i,
    /расходование веры/i,
    /^мука$/i,
    /сила воли/i,
    /временная вера/i,
    /постоянная вера/i
  ],
  "03-houses-factions": [
    /дома/i,
    /дом/i,
    /фракц/i,
    /группировк/i,
    /фаустиан/i,
    /люцифери/i,
    /криптик/i,
    /миротвор/i,
    /жаждущ/i
  ],
  "04-lores": [
    /^знания$/i,
    /знание /i,
    /уровень/i,
    /мука/i,
    /бросок/i
  ],
  "05-apocalyptic-form": [
    /апокалиптичес/i,
    /облик/i,
    /форма/i,
    /высокая мука/i
  ],
  "06-pacts-thralls": [
    /договор/i,
    /последовател/i,
    /слуг/i,
    /жатва/i,
    /веры/i
  ],
  "07-systems": [
    /броск/i,
    /сложност/i,
    /успех/i,
    /провал/i,
    /действи/i,
    /урон/i,
    /здоров/i
  ]
};

const written = [];

for (const [name, patterns] of Object.entries(targetGroups)) {
  const candidates = findSectionsByTitle(toc, patterns)
    .map(section => sectionsById.get(section.id))
    .filter(Boolean);

  const unique = [];
  const seen = new Set();

  for (const section of candidates) {
    if (seen.has(section.id)) continue;
    seen.add(section.id);
    unique.push(section);
  }

  written.push(writeSectionPack(name, unique.slice(0, 80)));
}

const implementationIndex = {
  generatedAt: new Date().toISOString(),
  chapters: chapterIndex.map(chapter => ({
    id: chapter.id,
    title: chapter.title,
    childCount: chapter.children.length
  })),
  workpacks: written.map(file => path.relative(root, file))
};

fs.writeFileSync(
  path.join(outDir, "implementation-index.json"),
  JSON.stringify(implementationIndex, null, 2) + "\n",
  "utf8"
);

console.log("Generated workpack:");
for (const file of written) console.log(" -", path.relative(root, file));
console.log(" -", path.relative(root, path.join(outDir, "chapter-index.json")));
console.log(" -", path.relative(root, path.join(outDir, "implementation-index.json")));
