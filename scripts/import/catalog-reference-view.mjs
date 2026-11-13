import { matchesImportedBaseline } from "./catalog-reconciliation.mjs";
import { cachedReference, ensureReferenceCatalogs } from "./catalog-reference-cache.mjs";
import { referenceTextUpdate } from "./catalog-reference-text.mjs";

export function hasUneditedImportedText(item) {
  const original = item?.flags?.["vtm-revised"]?.original;
  if (!original || item.name !== original.name) return false;
  return matchesImportedBaseline(item.system?.description, {
    value: original.description ?? original.summary ?? "",
    system: original.system ?? original.systemText ?? "",
    chat: original.chat ?? original.short ?? original.shortDescription ?? ""
  });
}

function hasUneditedReferenceFields(item, buildSystemData) {
  if (!hasUneditedImportedText(item)) return false;
  if (!buildSystemData) return true;
  const baseline = buildSystemData(item.type, item.flags["vtm-revised"].original);
  delete baseline.rating; // A character's dot rating is not an edit to the reference rules.
  return matchesImportedBaseline(item.system, baseline);
}

export function isUneditedInventedRarePower(item, buildSystemData) {
  const original = item?.flags?.["vtm-revised"]?.original;
  return item?.type === "disciplinePower"
    && /^OpenAI rare (?:advanced )?disciplines pass$/.test(original?.audit?.checkedBy ?? "")
    && !original?.sourceUrl && !original?.audit?.sourceUrl
    && hasUneditedReferenceFields(item, buildSystemData)
    && matchesImportedBaseline(item.system?.mechanics, original.mechanics ?? {});
}

export function referenceDisplayItem(item, worldItems, buildSystemData) {
  const reference = cachedReference(item);
  if (reference && buildSystemData) {
    const plan = referenceTextUpdate(item, reference.entry, buildSystemData);
    if (plan.changed.length) return {
      id: item.id, uuid: item.uuid, name: item.name, type: item.type,
      parent: item.parent, isOwner: item.isOwner, img: item.img, sheet: item.sheet,
      flags: item.flags, system: plan.system, sourceDocument: item
    };
  }
  if (!hasUneditedReferenceFields(item, buildSystemData)) return item;
  return worldItems.find(candidate => candidate.type === item.type
    && (candidate.name === item.name || candidate.flags?.["vtm-revised"]?.original?.aliases?.includes(item.name))
    && candidate.flags?.["vtm-revised"]?.catalogRevision
    && (item.type !== "disciplinePower" || (candidate.system?.level === item.system?.level
      && candidate.system?.parentDiscipline === item.system?.parentDiscipline))) ?? item;
}

export async function resolveReferenceItem(item, worldItems, buildSystemData) {
  await ensureReferenceCatalogs();
  return referenceDisplayItem(item, worldItems, buildSystemData);
}
