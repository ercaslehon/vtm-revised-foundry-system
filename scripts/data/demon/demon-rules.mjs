export const DEMON_RULES = {
  characterCreation: {
    attributePriorityDots: {
      primary: 7,
      secondary: 5,
      tertiary: 3
    },
    abilityPriorityDots: {
      primary: 13,
      secondary: 9,
      tertiary: 5
    },
    backgroundsDots: 5,
    loreDots: 3,
    virtueBonusDots: 3,
    virtueBaseDots: 1,
    faithInitial: 3,
    freebiePoints: 15,
    willpowerRule: "Сумма двух самых высоких Добродетелей",
    abilityCreationCap: 3,
    attributeCreationCap: 5,
    freebieCosts: {
      attribute: 5,
      ability: 2,
      lore: 7,
      background: 1,
      faith: 6,
      virtue: 2,
      willpower: 1
    }
  },

  houses: [
    {
      key: "devils",
      label: "Намару / Дьяволы",
      shortLabel: "Дьяволы",
      initialTorment: 4,
      hint: "Харизма, власть, Сияние, Пламя и Небожители.",
      houseLores: ["celestials", "flame", "radiance"]
    },
    {
      key: "scourges",
      label: "Ашару / Кнуты",
      shortLabel: "Кнуты",
      initialTorment: 3,
      hint: "Исцеление, оживление, ветер, движение и Пробуждение.",
      houseLores: ["awakening", "firmament", "winds"]
    },
    {
      key: "malefactors",
      label: "Ануннаки / Преступники",
      shortLabel: "Преступники",
      initialTorment: 3,
      hint: "Материя, земля, кузня, пути и создание чудес.",
      houseLores: ["earth", "forge", "paths"]
    },
    {
      key: "defilers",
      label: "Ламмасу / Осквернители",
      shortLabel: "Осквернители",
      initialTorment: 3,
      hint: "Желание, море, штормы, метаморфозы и соблазн.",
      houseLores: ["longing", "storms", "transfiguration"]
    },
    {
      key: "devourers",
      label: "Рабису / Пожиратели",
      shortLabel: "Пожиратели",
      initialTorment: 4,
      hint: "Дикая природа, звери, плоть, охота и жизнь.",
      houseLores: ["beast", "flesh", "wild"]
    },
    {
      key: "slayers",
      label: "Халаку / Убийцы",
      shortLabel: "Убийцы",
      initialTorment: 4,
      hint: "Смерть, духи, души и границы миров.",
      houseLores: ["death", "realms", "spirit"]
    },
    {
      key: "fiends",
      label: "Неберу / Изверги",
      shortLabel: "Изверги",
      initialTorment: 3,
      hint: "Узоры, свет, порталы, пророчества и судьба.",
      houseLores: ["patterns", "portals", "light"]
    }
  ],

  factions: [
    { key: "faustians", label: "Фаустианцы", hint: "Человечество должно служить падшим и давать им Веру." },
    { key: "luciferans", label: "Люцифериане", hint: "Поиск Люцифера и продолжение изначального восстания." },
    { key: "reconcilers", label: "Миротворцы", hint: "Искупление, примирение и восстановление утраченного рая." },
    { key: "cryptics", label: "Скрытные / Криптики", hint: "Поиск истины о Падении, Бездне и молчании Творца." },
    { key: "ravagers", label: "Жаждущие / Опустошители", hint: "Мир сломан, человечество недостойно, разрушение неизбежно." }
  ],

  virtues: [
    {
      key: "conscience",
      label: "Совесть",
      hint: "Моральный компас, способность различать правильное и неправильное."
    },
    {
      key: "conviction",
      label: "Убеждённость",
      hint: "Вера в смысл, порядок и необходимость происходящего."
    },
    {
      key: "courage",
      label: "Мужество",
      hint: "Способность действовать несмотря на страх, боль и препятствия."
    }
  ],

  backgrounds: [
    { key: "allies", label: "Союзники", hint: "Смертные или иные помощники, готовые поддержать персонажа." },
    { key: "contacts", label: "Контакты", hint: "Источники информации в человеческом обществе." },
    { key: "eminence", label: "Высокое положение", hint: "Статус и влияние среди падших." },
    { key: "fame", label: "Слава", hint: "Известность смертного носителя или самого персонажа." },
    { key: "followers", label: "Последователи", hint: "Люди, которые служат персонажу и выполняют задания." },
    { key: "influence", label: "Влияние", hint: "Доступ к рычагам власти в обществе смертных." },
    { key: "legacy", label: "Наследие", hint: "Память о существовании до Падения и во время Войны Гнева." },
    { key: "mentor", label: "Наставник", hint: "Учитель, старший демон или посвящённый смертный." },
    { key: "pacts", label: "Договоры", hint: "Заключённые сделки, дающие ежедневную Веру." },
    { key: "paragon", label: "Совершенство", hint: "Особый талант в применении основного Знания Дома." },
    { key: "resources", label: "Ресурсы", hint: "Деньги, имущество и уровень жизни." }
  ],

  lores: [
    { key: "storms", label: "Знание Бурь" },
    { key: "winds", label: "Знание Ветра" },
    { key: "wild", label: "Знание Дикой Природы" },
    { key: "spirit", label: "Знание Душ" },
    { key: "longing", label: "Знание Желания" },
    { key: "beast", label: "Знание Зверей" },
    { key: "earth", label: "Знание Земли" },
    { key: "forge", label: "Знание Кузнечного Дела" },
    { key: "transfiguration", label: "Знание Метаморфоз" },
    { key: "firmament", label: "Знание Небесного Свода" },
    { key: "celestials", label: "Знание Небожителей" },
    { key: "fundament", label: "Знание Основания" },
    { key: "flame", label: "Знание Пламени" },
    { key: "flesh", label: "Знание Плоти" },
    { key: "portals", label: "Знание Порталов" },
    { key: "awakening", label: "Знание Пробуждения" },
    { key: "paths", label: "Знание Путей" },
    { key: "light", label: "Знание Света" },
    { key: "radiance", label: "Знание Сияния" },
    { key: "death", label: "Знание Смерти" },
    { key: "realms", label: "Знание Сфер" },
    { key: "patterns", label: "Знание Узоров" },
    { key: "humanity", label: "Знание Человечества" },
    { key: "chaos", label: "Знание Хаоса (доп.)", supplemental: true },
    { key: "contamination", label: "Знание Нечистоты (доп.)", supplemental: true },
    { key: "violation", label: "Знание Насилия (доп.)", supplemental: true }
  ]
};

export function getDemonRuleEntry(collection, key) {
  const entries = DEMON_RULES?.[collection] ?? [];
  return entries.find(entry => entry.key === key) ?? null;
}

export function calculateDemonWillpowerFromVirtues(virtues = {}) {
  const values = ["conscience", "conviction", "courage"]
    .map(key => Number(virtues?.[key] ?? 0))
    .filter(value => Number.isFinite(value))
    .sort((a, b) => b - a);

  return Math.max(1, Math.min(10, Number(values[0] || 0) + Number(values[1] || 0)));
}
