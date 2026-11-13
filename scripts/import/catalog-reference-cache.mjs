const FILES = ["core-disciplines", "blood-magic", "rituals", "clans", "weapons", "backgrounds", "merits-flaws", "morality"];
const TYPES = { disciplines: "discipline", disciplinePaths: "disciplinePath", disciplinePowers: "disciplinePower", rituals: "ritual", clans: "clan", weapons: "weapon", backgrounds: "background", merits: "merit", flaws: "flaw", moralityPaths: "moralityPath" };
const index = new Map();
let loading = null;
const normalize = value => String(value ?? "").trim().toLowerCase().replaceAll("ё", "е").replace(/[\s_-]+/g, " ");
function key(type, name, system = {}) {
  return [type, normalize(name), ...(type === "disciplinePower" ? [Number(system.level || 0), normalize(system.parentDiscipline)] : [])].join("::");
}
export function registerReferenceCatalog(payload) {
  for (const [collection, type] of Object.entries(TYPES)) {
    for (const entry of payload[collection] ?? []) {
      for (const name of [entry.name, entry.rawName, entry.nameEn, entry.slug, ...(Array.isArray(entry.aliases) ? entry.aliases : [])].filter(Boolean)) {
        index.set(key(type, name, entry), { entry, revision: payload.catalogRevision });
      }
    }
  }
}
export function cachedReference(item) {
  if (!item) return null;
  for (const name of [item.name, item.system?.rawName, item.system?.rulesId, item.system?.slug].filter(Boolean)) {
    const match = index.get(key(item.type, name, item.system));
    if (match) return match;
  }
  return null;
}
export async function ensureReferenceCatalogs() {
  // Node regression tests populate the cache explicitly; only Foundry fetches relative assets.
  if (typeof globalThis.window === "undefined") return;
  loading ??= Promise.all(FILES.map(async name => {
    const response = await fetch(`systems/vtm-revised/data/vtm-revised-${name}.generated.json`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Reference catalog ${name}: HTTP ${response.status}`);
    registerReferenceCatalog(await response.json());
  })).catch(error => { loading = null; throw error; });
  await loading;
}
