const normalize = value => String(value ?? "").trim().toLowerCase();
const nonnegative = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;

export function isFortitudeDiscipline(item) {
  if (item?.type !== "discipline") return false;
  const aliases = Array.isArray(item.system?.aliases) ? item.system.aliases : String(item.system?.aliases ?? "").split(/[,;]+/);
  return [item.name, item.system?.rulesId, item.system?.rawName, item.system?.slug, ...aliases]
    .some(name => ["стойкость", "fortitude"].includes(normalize(name)));
}

export function fortitudeRating(actor, discipline = null) {
  const owned = discipline?.parent === actor && isFortitudeDiscipline(discipline)
    ? discipline : Array.from(actor?.items ?? []).find(isFortitudeDiscipline);
  return nonnegative(owned?.system?.rating);
}

export function fortitudeSoakPool(actor, damageType, { discipline = null, ignoreArmor = false, damageSource = "unknown" } = {}) {
  if (!["bashing", "lethal", "aggravated"].includes(damageType)) throw new Error(`Unknown damage type: ${damageType}`);
  const fortitude = fortitudeRating(actor, discipline);
  const stamina = damageType === "aggravated" ? 0 : nonnegative(actor?.system?.attributes?.physical?.stamina) + nonnegative(actor?.system?.automation?.physicalBoost?.stamina);
  const equipped = actor?.system?.automation?.armor;
  const armor = (damageType !== "aggravated" || damageSource === "physical") && !ignoreArmor && equipped?.active ? nonnegative(equipped.rating) : 0;
  return { pool: stamina + fortitude + armor, stamina, fortitude, armor };
}
