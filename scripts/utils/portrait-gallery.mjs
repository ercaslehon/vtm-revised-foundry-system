export const PORTRAIT_GALLERY_FLAG = "portraitGallery";
export const PRIMARY_PORTRAIT_ID = "primary";
const SCOPE = "vtm-revised";
const DEFAULT_IMAGE = "icons/svg/mystery-man.svg";

function pathKey(path) {
  try { return decodeURIComponent(path); } catch { return path; }
}

export function isPortraitImage(path) {
  return typeof path === "string" && !/^(?:javascript|data|file):/i.test(path.trim())
    && /\.(?:png|jpe?g|webp|gif|avif|svg)(?:[?#].*)?$/i.test(path.trim());
}

export function portraitLabel(path) {
  return pathKey(String(path).split(/[?#]/)[0].split("/").at(-1) || "").replace(/\.[^.]+$/, "");
}

/** Flags keep existing actors compatible without a schema migration. */
export function normalizePortraits(entries = []) {
  const result = [];
  const paths = new Set();
  const ids = new Set([PRIMARY_PORTRAIT_ID]);
  for (const entry of Array.isArray(entries) ? entries : []) {
    const src = String(typeof entry === "string" ? entry : entry?.src ?? "").trim();
    if (!isPortraitImage(src) || paths.has(pathKey(src))) continue;
    let id = String(entry?.id ?? "");
    if (!id || ids.has(id)) id = `portrait-${result.length}-${pathKey(src)}`;
    paths.add(pathKey(src)); ids.add(id);
    result.push({ id, src, label: String(entry?.label || portraitLabel(src)).trim() });
  }
  return result;
}

export function actorPortraits(actor, { includeAdditional = true, primaryLabel = "" } = {}) {
  const src = actor.img || actor.system?.profile?.avatar || DEFAULT_IMAGE;
  const primary = { id: PRIMARY_PORTRAIT_ID, src, label: primaryLabel, primary: true };
  if (!includeAdditional) return [primary];
  const extra = normalizePortraits(actor.getFlag(SCOPE, PORTRAIT_GALLERY_FLAG));
  return [primary, ...extra.filter(entry => pathKey(entry.src) !== pathKey(src))];
}

/** Selection is sheet-local: never update Actor.img, tokens or flags while browsing. */
export function portraitState(entries, selectedId = PRIMARY_PORTRAIT_ID) {
  const index = Math.max(0, entries.findIndex(entry => entry.id === selectedId));
  return { ...entries[index], index, number: index + 1, total: entries.length, multiple: entries.length > 1 };
}

export function cyclePortrait(entries, selectedId, delta) {
  const { index } = portraitState(entries, selectedId);
  const step = Number.isFinite(Number(delta)) ? Math.trunc(Number(delta)) : 0;
  return entries[((index + step) % entries.length + entries.length) % entries.length].id;
}

export async function addActorPortraits(actor, images) {
  if (!actor.isOwner) throw new Error("Only an actor owner can edit the portrait gallery.");
  const existing = normalizePortraits(actor.getFlag(SCOPE, PORTRAIT_GALLERY_FLAG));
  const known = new Set(actorPortraits(actor).map(entry => pathKey(entry.src)));
  const added = normalizePortraits(images).filter(entry => !known.has(pathKey(entry.src)));
  if (added.length) {
    const merged = normalizePortraits([...existing, ...added]);
    await actor.setFlag(SCOPE, PORTRAIT_GALLERY_FLAG, merged);
    return merged.filter(entry => added.some(newEntry => pathKey(newEntry.src) === pathKey(entry.src)));
  }
  return [];
}

export async function replaceActorPortrait(actor, id, src) {
  if (!actor.isOwner) throw new Error("Only an actor owner can edit the portrait gallery.");
  if (!isPortraitImage(src)) throw new Error("Invalid portrait image path.");
  if (id === PRIMARY_PORTRAIT_ID) {
    await actor.update({ img: src, "system.profile.avatar": src });
    return;
  }
  const entries = normalizePortraits(actor.getFlag(SCOPE, PORTRAIT_GALLERY_FLAG));
  const target = entries.find(entry => entry.id === id);
  if (!target) throw new Error("Portrait no longer exists.");
  if (actorPortraits(actor).some(entry => entry.id !== id && pathKey(entry.src) === pathKey(src))) {
    throw new Error("This image is already in the gallery.");
  }
  target.src = src;
  target.label = portraitLabel(src);
  await actor.setFlag(SCOPE, PORTRAIT_GALLERY_FLAG, entries);
}

export async function removeActorPortrait(actor, id) {
  if (!actor.isOwner) throw new Error("Only an actor owner can edit the portrait gallery.");
  if (id === PRIMARY_PORTRAIT_ID) return false;
  const entries = normalizePortraits(actor.getFlag(SCOPE, PORTRAIT_GALLERY_FLAG));
  if (!entries.some(entry => entry.id === id)) return false;
  await actor.setFlag(SCOPE, PORTRAIT_GALLERY_FLAG, entries.filter(entry => entry.id !== id));
  return true; // Remove a reference only; never delete the image file.
}

export function createPortraitPopout(src, { title = "", uuid = null } = {}) {
  const ImagePopoutClass = foundry.applications?.apps?.ImagePopout?.implementation
    ?? foundry.applications?.apps?.ImagePopout ?? globalThis.ImagePopout;
  if (!ImagePopoutClass) throw new Error("Foundry ImagePopout is unavailable.");
  // Do not expose an unrevealed NPC name or the GM's private scene labels to players.
  return new ImagePopoutClass({ src, uuid, showTitle: false, window: { title } });
}

export function sharePortraitWithUsers(src, userIds, { uuid = null, title = "" } = {}) {
  if (!game.user?.isGM) throw new Error("Only the GM can show portraits to other players.");
  const requested = new Set(Array.isArray(userIds) ? userIds : []);
  const users = game.users.filter(user => user.active && !user.isGM && requested.has(user.id)).map(user => user.id);
  if (!users.length) return false; // Never let an empty selection turn into a broadcast.
  createPortraitPopout(src, { title, uuid }).shareImage({ users, showTitle: false, title });
  return true;
}
