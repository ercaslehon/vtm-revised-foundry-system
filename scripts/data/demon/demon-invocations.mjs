import { DEMON_LORE_DETAILS } from "./demon-lore-details.mjs";

const normalize = value => String(value ?? "")
  .trim()
  .toLowerCase()
  .replaceAll("ё", "е")
  .replace(/\s+/g, " ");

const TRAIT_ALIASES = new Map([
  ["сила", "attribute.physical.strength"],
  ["ловкость", "attribute.physical.dexterity"],
  ["выносливость", "attribute.physical.stamina"],
  ["обаяние", "attribute.social.charisma"],
  ["манипулирование", "attribute.social.manipulation"],
  ["внешность", "attribute.social.appearance"],
  ["восприятие", "attribute.mental.perception"],
  ["интеллект", "attribute.mental.intelligence"],
  ["сообразительность", "attribute.mental.wits"],
  ["атлетизм", "ability.talents.athletics"],
  ["бдительность", "ability.talents.alertness"],
  ["драка", "ability.talents.brawl"],
  ["запугивание", "ability.talents.intimidation"],
  ["выразительность", "ability.talents.expression"],
  ["лидерство", "ability.talents.leadership"],
  ["уклонение", "ability.talents.dodge"],
  ["уличное чутье", "ability.talents.streetwise"],
  ["хитрость", "ability.talents.subterfuge"],
  ["эмпатия", "ability.talents.empathy"],
  ["осведомленность", "ability.talents.awareness"],
  ["интуиция", "ability.talents.intuition"],
  ["ремесло", "ability.skills.crafts"],
  ["выживание", "ability.skills.survival"],
  ["знание животных", "ability.skills.animalken"],
  ["актерство", "ability.skills.performance"],
  ["этикет", "ability.skills.etiquette"],
  ["медицина", "ability.knowledges.medicine"],
  ["оккультизм", "ability.knowledges.occult"],
  ["наука", "ability.knowledges.science"],
  ["расследование", "ability.knowledges.investigation"],
  ["исследование", "ability.knowledges.research"],
  ["сила воли", "resource.willpower"],
  ["силы воли", "resource.willpower"]
]);

function parseTraits(system = "") {
  const text = normalize(system).replace(/\([^)]*\)/g, " ");
  const pair = text.match(/([а-яa-z ]{2,40})\s*\+\s*([а-яa-z ]{2,40})/u);
  if (pair) {
    const aliases = Array.from(TRAIT_ALIASES.entries());
    const first = normalize(pair[1]);
    const second = normalize(pair[2]);
    const firstTrait = aliases.find(([label]) => first.endsWith(label))?.[1] ?? "";
    const secondTrait = aliases.find(([label]) => second.startsWith(label))?.[1] ?? "";
    return { firstTrait, secondTrait };
  }
  return { firstTrait: "", secondTrait: "" };
}

function parseDifficulty(system = "") {
  const text = normalize(system);
  const explicit = text.match(/сложност(?:ь|ью|и)\s+(?:равн(?:а|ой)\s+)?(\d+)/u);
  return Math.max(2, Math.min(10, Number(explicit?.[1] || 6)));
}

function parseFaithCost(system = "") {
  const text = normalize(system);
  const match = text.match(/потратить\s+(\d+)\s+(?:пункт(?:а|ов)?\s+)?вер/u);
  return Math.max(0, Number(match?.[1] || 0));
}

function parseResistance(system = "") {
  const text = normalize(system);
  const aliases = Array.from(TRAIT_ALIASES.entries()).sort((a, b) => b[0].length - a[0].length);
  const resistanceText = text.match(/(?:сопротив\S*|встречн\S* брос\S*|против)\s+([^.;]{2,90})/u)?.[1] ?? "";
  const found = aliases.find(([label]) => resistanceText.includes(label));
  const difficulty = resistanceText.match(/сложност(?:ь|ью|и)\s+(?:равн\S*\s+)?(\d+)/u)?.[1]
    ?? text.match(/(?:сопротив\S*|встречн\S* брос\S*|против)[^.;]{0,90}?сложност(?:ь|ью|и)\s+(?:равн\S*\s+)?(\d+)/u)?.[1];
  return {
    resistanceTrait: found?.[1] ?? "",
    resistanceDifficulty: difficulty ? Math.max(2, Math.min(10, Number(difficulty))) : 6
  };
}

function parseDuration(system = "") {
  const text = String(system ?? "").replace(/\s+/g, " ").trim();
  const match = text.match(/(?:действ(?:ует|ие длится)|длится|сохраня(?:ется|ются)|в течение)\s+([^.;]+)/iu);
  return String(match?.[1] ?? "").trim();
}

export function parseDemonInvocationMechanics(system = "") {
  return {
    ...parseTraits(system),
    difficulty: parseDifficulty(system),
    faithCost: parseFaithCost(system),
    ...parseResistance(system),
    duration: parseDuration(system)
  };
}

export function getDemonLore(key = "") {
  return DEMON_LORE_DETAILS[String(key ?? "").trim()] ?? null;
}

export function getDemonInvocation(loreKey = "", level = 1) {
  const lore = getDemonLore(loreKey);
  const power = lore?.powers?.find(entry => Number(entry.level) === Number(level));
  if (!power) return null;
  return {
    ...power,
    loreKey,
    // Reference prose is verbatim source text, not a machine-readable DSL.
    // Existing catalog invocations retain their explicit numerical behavior.
    ...(power.automation ?? parseDemonInvocationMechanics(power.system))
  };
}

export function getAvailableDemonInvocations(loreKey = "", rating = 0) {
  const lore = getDemonLore(loreKey);
  return (lore?.powers ?? [])
    .filter(power => Number(power.level) <= Number(rating || 0))
    .map(power => getDemonInvocation(loreKey, power.level));
}
