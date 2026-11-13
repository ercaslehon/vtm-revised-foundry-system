// Pure prose reconciliation. Gameplay parameters are deliberately not part of this list.
export const REFERENCE_TEXT_PATHS = [
  "description.value", "description.system", "description.chat", "description.components",
  "weakness", "organization", "stereotypes", "opinion", "roleplayTips",
  "theme", "embrace", "societyPlace", "characterHooks", "storytellerHooks",
  "virtues", "aura", "ethics", "hierarchy", "initiation", "components",
  ...["activation", "duration", "successScaling", "resistance", "failure", "botch", "limits", "automationNotes"].map(key => "mechanics." + key)
];

const NAMED_ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", hellip: "…" };
export function normalizeReferenceText(value) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
      if (entity[0] !== "#") return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
      const number = entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
      return number >= 0 && number <= 0x10ffff ? String.fromCodePoint(number) : match;
    })
    .replace(/\s+/g, " ").trim();
}

export function getReferencePath(object, path) {
  return path.split(".").reduce((value, key) => value?.[key], object);
}

function setPath(object, path, value) {
  const keys = path.split(".");
  let cursor = object;
  for (const key of keys.slice(0, -1)) cursor = cursor[key] ??= {};
  cursor[keys.at(-1)] = value;
}

export function isSourceLinkPlaceholder(value) {
  const text = String(value ?? "").trim();
  if (/^https:\/\/wod\.su\/\S+$/.test(text)) return true;
  const anchors = [...text.matchAll(/<a\b[^>]*href=["'](https:\/\/wod\.su\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  if (!anchors.length || normalizeReferenceText(text.replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, ""))) return false;
  return anchors.every(([, , label]) => /^(?:описание|правила|система|механика|этика|иерархия|аура|посвящение|добродетели|источник|открыть|перейти|читать)/i.test(normalizeReferenceText(label)));
}

const clone = value => JSON.parse(JSON.stringify(value ?? {}));
export function referenceTextUpdate(item, entry, buildSystemData) {
  const desired = buildSystemData(item.type, entry);
  const current = clone(item.system?.toObject?.() ?? item.system);
  const original = item.flags?.["vtm-revised"]?.original;
  const baseline = original ? buildSystemData(item.type, original) : {};
  const changed = [], preserved = [];
  for (const path of REFERENCE_TEXT_PATHS) {
    const next = getReferencePath(desired, path);
    if (typeof next !== "string") continue;
    const actual = getReferencePath(current, path) ?? "";
    if (normalizeReferenceText(actual) === normalizeReferenceText(next)) continue;
    const old = getReferencePath(baseline, path);
    if (isSourceLinkPlaceholder(actual) || (original && old !== undefined &&
        normalizeReferenceText(actual) === normalizeReferenceText(old))) {
      setPath(current, path, next);
      changed.push(path);
    } else if (normalizeReferenceText(actual)) preserved.push(path);
  }
  return { system: current, changed, preserved };
}
