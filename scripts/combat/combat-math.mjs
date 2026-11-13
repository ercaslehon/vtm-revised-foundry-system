export function netAttackSuccesses(attack = 0, defense = 0) {
  return Math.max(0, Number(attack || 0) - Number(defense || 0));
}

export function multipleActionPenalty(declared = 1, used = 0) {
  const actions = Math.max(1, Math.trunc(Number(declared || 1)));
  if (actions <= 1) return 0;
  return actions + Math.max(0, Math.trunc(Number(used || 0)));
}

export function damageAfterSoak(incoming = 0, soak = 0, { halveBashing = false } = {}) {
  const remainder = Math.max(0, Math.trunc(Number(incoming || 0)) - Math.trunc(Number(soak || 0)));
  if (!halveBashing || remainder <= 0) return remainder;
  return Math.floor(remainder / 2);
}

export function demonHighTormentSlots(permanentTorment = 0) {
  return Math.max(0, Math.min(4, Math.trunc(Number(permanentTorment || 0)) - 6));
}

export function activeDemonHighTormentIndexes(permanentTorment = 0, selected = []) {
  const allowed = demonHighTormentSlots(permanentTorment);
  return [...new Set((Array.isArray(selected) ? selected : []).map(String))]
    .filter(value => /^(?:0|1|2|3)$/.test(value))
    .slice(0, allowed);
}
