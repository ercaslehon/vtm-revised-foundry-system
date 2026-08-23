export function advancementCost(kind, current = 0, { inClan = false, ownLore = false } = {}) {
  const value = Math.max(0, Number(current || 0));
  switch (kind) {
    case "attribute": return Math.max(1, value) * 4;
    case "ability": return value === 0 ? 3 : value * 2;
    case "background": return Math.max(1, value) * 3;
    case "virtue": return Math.max(1, value) * 2;
    case "willpower": return Math.max(1, value);
    case "morality": return Math.max(1, value) * 2;
    case "vampireDiscipline": return value === 0 ? 10 : value * (inClan ? 5 : 7);
    case "demonLore": return value === 0 ? (ownLore ? 7 : 10) : value * 5;
    case "faith": return Math.max(1, value) * 7;
    case "tormentReduction": return 10;
    default: return 0;
  }
}
