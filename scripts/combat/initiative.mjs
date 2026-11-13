import { getActiveDemonFormSummary } from "../data/demon/demon-apocalyptic-mechanics.mjs";

const value = input => {
  const number = Number(input?.value ?? input ?? 0);
  return Number.isFinite(number) ? number : 0;
};
export function initiativeFormula(actor) {
  const attributes = actor?.system?.attributes;
  const dexterity = value(attributes?.physical?.dexterity);
  const wits = value(attributes?.mental?.wits);
  const bonus = actor?.type === "demon" ? value(getActiveDemonFormSummary(actor).initiative) : 0;
  return `1d10 + ${dexterity} + ${wits}${bonus ? ` + ${bonus}` : ""}`;
}
export function registerInitiative() {
  const Base = CONFIG.Combatant.documentClass;
  CONFIG.Combatant.documentClass = class VTMCombatant extends Base {
    _getInitiativeFormula() { return initiativeFormula(this.actor); }
  };
}
