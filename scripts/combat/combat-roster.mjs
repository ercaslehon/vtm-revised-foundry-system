export const COMBAT_SCOPE = "vtm-revised";
export const ROSTER_SETTING = "combatTargetNames";
export function primaryCombatGM() {
  return Array.from(game.users ?? []).filter(user => user.active && user.isGM)
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))[0] ?? null;
}
export function isCombatGM() { return Boolean(game.user?.isGM && primaryCombatGM()?.id === game.user.id); }
export function sharedCombatNames() {
  let rows;
  try { rows = game.settings?.get(COMBAT_SCOPE, ROSTER_SETTING); } catch { return []; }
  return (Array.isArray(rows) ? rows : []).filter(row => typeof row?.uuid === "string" && typeof row?.name === "string")
    .map(row => ({ uuid: row.uuid, name: row.name, documentName: "Actor", combatNameOnly: true }));
}
export async function publishCombatNames() {
  if (!isCombatGM()) return;
  const rows = Array.from(game.actors?.contents ?? game.actors ?? []).map(actor => ({ uuid: actor.uuid, name: actor.name }))
    .sort((a, b) => a.uuid.localeCompare(b.uuid));
  if (JSON.stringify(game.settings.get(COMBAT_SCOPE, ROSTER_SETTING)) !== JSON.stringify(rows))
    await game.settings.set(COMBAT_SCOPE, ROSTER_SETTING, rows);
}
let refreshTimer;
function refreshNames() {
  if (!game.ready || !isCombatGM()) return;
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => void publishCombatNames().catch(error => console.error("VtM | Target names", error)), 200);
}
Hooks.once?.("init", () => game.settings.register(COMBAT_SCOPE, ROSTER_SETTING, {
  name: "Имена целей боя", scope: "world", config: false, type: Array, default: []
}));
Hooks.once?.("ready", () => void publishCombatNames().catch(error => console.error("VtM | Target names", error)));
for (const hook of ["createActor", "updateActor", "deleteActor", "updateUser", "userConnected"]) Hooks.on(hook, refreshNames);
