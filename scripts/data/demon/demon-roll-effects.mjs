import { DEMON_CATALOGS } from "./demon-catalogs.mjs";

const SOCIAL = ["attribute.social.*"];
const WILLPOWER = ["resource.willpower"];
const PERCEPTION = ["attribute.mental.perception"];
const ALL = ["*"];

export const DEMON_ROLL_EFFECTS = {
  merits: {
    "angelic-aura": { difficulty: -1, traits: ["attribute.social.charisma", "attribute.social.appearance"] },
    "angelic-gaze": { difficulty: -1, traits: ["ability.talents.leadership", "ability.talents.intimidation", "ability.talents.empathy"] },
    "atavistic-form": { difficulty: -1, traits: SOCIAL, requiresApocalypticForm: true, note: "Только в полной апокалиптической форме и при взаимодействии со смертными." },
    "dreams-of-the-past": { difficulty: -1, traits: ["background.legacy"] },
    "acute-sense": { difficulty: -2, traits: PERCEPTION, note: "Только если бросок непосредственно использует выбранное обострённое чувство." },
    "good-right-hook": { dice: 2, traits: [], damageOnly: true, note: "Только к броску урона атаки, основанной на Драке; к броску попадания не применяется." },
    "perfect-balance": { difficulty: -2, traits: ["attribute.physical.dexterity", "ability.talents.athletics"] },
    "robust-health": { difficulty: -2, traits: ["attribute.physical.stamina"] },
    "good-night-vision": { difficulty: -2, traits: PERCEPTION },
    "sexy": { difficulty: -2, traits: SOCIAL, note: "При намеренном обольщении снижение может составлять 3 вместо 2; поправь сложность вручную." },
    "daredevil": { dice: 3, traits: ALL, note: "Только для действия сложностью 8+ с угрозой минимум 3 летальных или 6 поверхностных повреждений; по решению Рассказчика." },
    "approachable": { difficulty: -1, traits: ["ability.talents.empathy"] },
    "early-adopter": { dice: 2, traits: ["ability.skills.crafts", "ability.knowledges.computer"], note: "Только при освоении нового гаджета или технологии." },
    "funny": { difficulty: -2, traits: SOCIAL },
    "good-listener": { difficulty: -2, traits: SOCIAL },
    "good-taste": { difficulty: -2, traits: SOCIAL },
    "gossip": { difficulty: -2, traits: ["ability.knowledges.investigation"] },
    "media-junkie": { difficulty: -2, traits: [...SOCIAL, "ability.knowledges.investigation"] },
    "natural-leader": { dice: 2, traits: ["ability.talents.leadership"] },
    "natural-politician": { dice: 2, traits: ["attribute.social.manipulation", "ability.knowledges.politics"] },
    "smooth": { difficulty: -2, traits: ["attribute.social.manipulation"] },
    "wordplay": { dice: 2, traits: ["ability.talents.expression"] },
    "enchanting-voice": { difficulty: -2, traits: SOCIAL },
    "fashion-sense": { difficulty: -1, traits: SOCIAL },
    "flirt": { dice: 2, traits: SOCIAL },
    "good-judge-of-character": { difficulty: -2, traits: PERCEPTION },
    "great-liar": { dice: 2, traits: SOCIAL },
    "people-person": { difficulty: -2, traits: SOCIAL },
    "socially-aware": { dice: 2, traits: PERCEPTION },
    "corporate-savvy": { dice: 2, traits: ["attribute.social.manipulation", "ability.knowledges.finance", "ability.knowledges.politics"] },
    "media-savvy": { dice: 2, traits: SOCIAL },
    "lucky": { difficulty: -2, traits: ALL, note: "Только для критически важного броска, один раз за игровую сессию, по решению Рассказчика." },
    "healthy-cynicism": { difficulty: -2, traits: ["ability.talents.empathy", "attribute.mental.perception"] },
    "code-of-honor": { dice: 2, traits: WILLPOWER },
    "unyielding": { dice: 2, traits: WILLPOWER },
    "polyglot": { dice: 3, traits: ["ability.knowledges.linguistics"] },
    "natural-aptitude": { dice: 1, traits: ["ability.*"], optionTrait: true, note: "Только для выбранной при покупке Способности." },
    "unflappable": { dice: 2, traits: WILLPOWER },
    "bargain-hound": { difficulty: -2, traits: ["background.resources"] }
  },
  flaws: {
    nightmares: { difficulty: 2, traits: ALL, note: "Только к первому броску следующего дня после неудачного сна и при общении с демонами." },
    allergy: { difficulty: 1, traits: ALL, note: "Только при непосредственном контакте с выбранным аллергеном." },
    "motion-sickness": { difficulty: 2, traits: ALL },
    disfigured: { difficulty: 2, traits: SOCIAL },
    "low-pain-threshold": { dice: -1, traits: ALL, note: "Только когда персонаж ранен." },
    "missing-limb": { difficulty: 2, traits: ["attribute.physical.*", "ability.talents.athletics", "ability.talents.brawl", "ability.skills.melee", "ability.skills.firearms"] },
    elderly: { traits: [], note: "Не является постоянным −1: увеличивает каждый штраф от ран на 1; сложность поглощения равна 7." },
    "shaky-hands": { difficulty: 2, traits: ["attribute.physical.dexterity", "ability.skills.firearms", "ability.skills.melee", "ability.skills.crafts"] },
    deaf: { difficulty: 3, traits: ["ability.talents.alertness", "attribute.mental.perception"] },
    crude: { difficulty: 2, traits: SOCIAL },
    "cultural-snob": { difficulty: 2, traits: SOCIAL },
    "eccentric-appearance": { difficulty: 2, traits: SOCIAL },
    "ghastly-humor": { difficulty: 2, traits: SOCIAL },
    "impractical-dresser": { difficulty: 2, traits: ["ability.talents.athletics", "ability.talents.dodge"] },
    misinformed: { difficulty: 2, traits: ["ability.knowledges.*"] },
    "bad-teeth": { difficulty: 2, traits: SOCIAL },
    "bad-taste": { difficulty: 2, traits: SOCIAL },
    "socially-oblivious": { difficulty: 2, traits: ["ability.skills.etiquette"] },
    "speech-impediment": { difficulty: 2, traits: SOCIAL },
    stubborn: { difficulty: 2, traits: SOCIAL },
    superstitious: { difficulty: 2, traits: SOCIAL },
    "compulsive-shopper": { difficulty: 2, traits: ["background.resources"] },
    foreigner: { difficulty: 2, traits: ["ability.talents.streetwise", "ability.skills.etiquette"] },
    "overly-honest": { difficulty: 2, traits: SOCIAL },
    scandal: { difficulty: 2, traits: SOCIAL },
    "poor-judge-of-character": { difficulty: 2, traits: ["ability.talents.alertness", "ability.talents.empathy"] },
    technophobe: { difficulty: 2, traits: ["ability.knowledges.computer", "ability.skills.crafts"] },
    unlucky: { difficulty: 2, traits: ALL, note: "Только для критически важного броска, один раз за игровую сессию, по решению Рассказчика." },
    gullible: { difficulty: 2, traits: ["ability.talents.empathy", "attribute.mental.perception"] },
    "no-direction-sense": { difficulty: 2, traits: ["attribute.mental.perception", "ability.talents.streetwise", "ability.talents.survival"] },
    "short-fuse": { difficulty: 1, traits: ALL },
    "eating-disorder": { difficulty: 2, traits: ["attribute.physical.stamina"] },
    overconfident: { difficulty: 2, traits: ALL },
    "soft-hearted": { difficulty: 1, traits: ALL, note: "Только на 5–10 минут после провала Силы Воли сложностью 6 при виде жестокости." },
    "weak-willed": { difficulty: 2, traits: WILLPOWER },
    "inept-driver": { difficulty: 2, traits: ["ability.skills.drive"] },
    audit: { difficulty: 2, traits: ["background.resources"] },
    "primary-breadwinner": { difficulty: 2, traits: WILLPOWER }
  }
};

const selectorMatches = (selector, trait) => selector === "*" || (selector.endsWith(".*") ? trait.startsWith(selector.slice(0, -1)) : selector === trait);

export function getDemonRollEffects(actor, traitKeys = []) {
  const selections = actor?.getFlag?.("vtm-revised", "demonSelections") ?? {};
  const traits = traitKeys.filter(Boolean);
  const optionValues = actor?.getFlag?.("vtm-revised", "demonSelectionOptions") ?? {};
  const apocalypticFormActive = Boolean(actor?.system?.apocalypticForm?.active);
  const result = [];

  for (const type of ["merits", "flaws"]) {
    for (const key of selections[type] ?? []) {
      const effect = DEMON_ROLL_EFFECTS[type]?.[key];
      if (!effect || effect.damageOnly || (effect.requiresApocalypticForm && !apocalypticFormActive)) continue;
      const selectors = effect.optionTrait ? (optionValues[key] ? [optionValues[key]] : []) : effect.traits;
      if (!selectors.some(selector => traits.some(trait => selectorMatches(selector, trait)))) continue;
      const entry = DEMON_CATALOGS[type]?.find(item => item.key === key);
      if (!entry) continue;
      if (apocalypticFormActive && ["Физические", "Ментальные"].includes(entry.category)) continue;
      result.push({ type, key, label: entry.label, mechanics: entry.mechanics, ...effect });
    }
  }

  return result;
}
