// Demon: The Fallen uses a broader ability list than Vampire: The Masquerade.
// Existing Vampire-compatible keys are retained so actors created before v11.0.29
// keep their ratings; the missing core-book abilities are additive fields.
export const DEMON_ABILITY_CATEGORIES = Object.freeze({
  talents: Object.freeze([
    "alertness", "athletics", "awareness", "brawl", "dodge", "empathy",
    "expression", "intimidation", "intuition", "leadership", "streetwise", "subterfuge"
  ]),
  skills: Object.freeze([
    "animalken", "crafts", "explosives", "drive", "etiquette", "firearms",
    "melee", "performance", "security", "stealth", "survival", "technology"
  ]),
  knowledges: Object.freeze([
    "academics", "computer", "finance", "investigation", "law", "medicine",
    "occult", "politics", "religion", "research", "science", "linguistics"
  ])
});

export const DEMON_ABILITY_LABELS = Object.freeze({
  talents: "Таланты",
  skills: "Навыки",
  knowledges: "Познания",
  alertness: "Бдительность",
  athletics: "Атлетизм",
  awareness: "Осведомлённость",
  brawl: "Рукопашный бой",
  dodge: "Уворот",
  empathy: "Эмпатия",
  expression: "Выразительность",
  intimidation: "Запугивание",
  intuition: "Интуиция",
  leadership: "Лидерство",
  streetwise: "Знание улицы",
  subterfuge: "Хитрость",
  animalken: "Знание животных",
  crafts: "Ремесло",
  explosives: "Взрывное дело",
  drive: "Вождение",
  etiquette: "Этикет",
  firearms: "Огнестрельное оружие",
  melee: "Фехтование",
  performance: "Актёрство",
  security: "Безопасность",
  stealth: "Маскировка",
  survival: "Выживание",
  technology: "Технология",
  academics: "Академические знания",
  computer: "Знание компьютера",
  finance: "Финансы",
  investigation: "Расследование",
  law: "Правоведение",
  medicine: "Медицина",
  occult: "Оккультизм",
  politics: "Политика",
  religion: "Религия",
  research: "Исследование",
  science: "Наука",
  linguistics: "Лингвистика (доп.)"
});
