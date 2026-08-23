import { DEMON_ABILITY_CATEGORIES } from "../data/demon/demon-abilities.mjs";

const fields = foundry.data.fields;

function ratingField(initial = 0, max = 10) {
  return new fields.NumberField({ required: true, integer: true, min: 0, max, initial });
}

function textField(initial = "") {
  return new fields.StringField({ required: false, blank: true, initial });
}

function htmlField() {
  return new fields.HTMLField({ required: false, blank: true, initial: "" });
}

function resourceField(value = 0, max = 10) {
  return new fields.SchemaField({
    value: new fields.NumberField({ required: true, integer: true, min: 0, initial: value }),
    max: new fields.NumberField({ required: true, integer: true, min: 0, initial: max })
  });
}

function namedRatingField() {
  return new fields.SchemaField({
    label: textField(),
    value: ratingField(0, 10),
    specialization: textField()
  });
}

function experienceJournalEntryField() {
  return new fields.SchemaField({
    id: textField(),
    type: textField("award"),
    amount: new fields.NumberField({ required: true, integer: true, min: -999, max: 999, initial: 0 }),
    delta: new fields.NumberField({ required: true, integer: true, min: -999, max: 999, initial: 0 }),
    reason: textField(),
    target: textField(),
    beforeJson: textField(),
    afterJson: textField(),
    purchase: new fields.BooleanField({ required: true, initial: false }),
    reversedAt: textField(),
    createdAt: textField(),
    userId: textField(),
    userName: textField()
  });
}

function pactEntryField() {
  return new fields.SchemaField({
    id: textField(),
    name: textField(),
    terms: textField(),
    gift: textField(),
    faithRating: ratingField(1, 5),
    offeredFaith: ratingField(1, 3),
    active: new fields.BooleanField({ required: true, initial: true }),
    lastCollected: textField()
  });
}

function attributesSchema() {
  return new fields.SchemaField({
    physical: new fields.SchemaField({
      strength: ratingField(1),
      dexterity: ratingField(1),
      stamina: ratingField(1)
    }),
    social: new fields.SchemaField({
      charisma: ratingField(1),
      manipulation: ratingField(1),
      appearance: ratingField(1)
    }),
    mental: new fields.SchemaField({
      perception: ratingField(1),
      intelligence: ratingField(1),
      wits: ratingField(1)
    })
  });
}

function abilitiesSchema() {
  const build = names => Object.fromEntries(names.map(name => [name, namedRatingField()]));

  return new fields.SchemaField({
    talents: new fields.SchemaField(build(DEMON_ABILITY_CATEGORIES.talents)),
    skills: new fields.SchemaField(build(DEMON_ABILITY_CATEGORIES.skills)),
    knowledges: new fields.SchemaField(build(DEMON_ABILITY_CATEGORIES.knowledges)),
    custom: new fields.ArrayField(new fields.SchemaField({
      name: textField(),
      category: textField("custom"),
      value: ratingField(0, 10),
      specialization: textField()
    }))
  });
}


function backgroundsSchema() {
  const backgroundNames = [
    "allies",
    "contacts",
    "eminence",
    "fame",
    "followers",
    "influence",
    "legacy",
    "mentor",
    "pacts",
    "paragon",
    "resources"
  ];

  return new fields.SchemaField(
    Object.fromEntries(backgroundNames.map(name => [name, namedRatingField()]))
  );
}

function virtuesSchema() {
  return new fields.SchemaField({
    conscience: ratingField(1, 5),
    conviction: ratingField(1, 5),
    courage: ratingField(1, 5)
  });
}

function healthSchema() {
  return new fields.SchemaField({
    bruised: ratingField(0, 3),
    hurt: ratingField(0, 3),
    injured: ratingField(0, 3),
    wounded: ratingField(0, 3),
    mauled: ratingField(0, 3),
    crippled: ratingField(0, 3),
    incapacitated: ratingField(0, 1),
    formBonusDamage: new fields.ArrayField(ratingField(0, 3)),
    summary: textField()
  });
}

function loreField(label = "") {
  return new fields.SchemaField({
    label: textField(label),
    value: ratingField(0, 5),
    note: textField()
  });
}

export class DemonActorData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      profile: new fields.SchemaField({
        player: textField(),
        chronicle: textField(),
        concept: textField(),
        nature: textField(),
        demeanor: textField(),
        hostName: textField(),
        celestialName: textField(),
        trueName: textField(),
        house: textField(),
        faction: textField(),
        age: textField(),
        sex: textField(),
        avatar: new fields.FilePathField({ required: false, categories: ["IMAGE"], initial: "icons/svg/mystery-man.svg" }),
        partialAvatar: new fields.FilePathField({ required: false, categories: ["IMAGE"], initial: "icons/svg/mystery-man.svg" }),
        apocalypticAvatar: new fields.FilePathField({ required: false, categories: ["IMAGE"], initial: "icons/svg/mystery-man.svg" }),
        avatarMode: textField("human"),
        appearance: htmlField(),
        history: htmlField(),
        hostHistory: htmlField(),
        celestialHistory: htmlField(),
        goals: htmlField(),
        notes: htmlField(),
        alliesContacts: htmlField(),
        possessions: htmlField()
      }),

      attributes: attributesSchema(),
      abilities: abilitiesSchema(),
      virtues: virtuesSchema(),
      backgrounds: backgroundsSchema(),

      resources: new fields.SchemaField({
        faith: resourceField(3, 10),
        /* value = temporary Torment, max = permanent Torment. */
        torment: resourceField(0, 3),
        willpower: resourceField(3, 3),
        traitMax: ratingField(5, 10),
        experience: new fields.SchemaField({
          total: ratingField(0, 999),
          spent: ratingField(0, 999),
          available: ratingField(0, 999),
          journal: new fields.ArrayField(experienceJournalEntryField())
        })
      }),

      lores: new fields.SchemaField({
        /* Legacy slots are retained so existing actors keep their data. */
        housePrimary: loreField(),
        houseSecondary: loreField(),
        beasts: loreField("Знание зверей"),
        pathsOfTheWild: loreField("Знание дикой природы"),
        foundation: loreField("Знание Основания"),

        humanity: loreField("Знание человечества"),
        celestials: loreField("Знание небожителей"),
        flame: loreField("Знание пламени"),
        radiance: loreField("Знание сияния"),
        awakening: loreField("Знание пробуждения"),
        firmament: loreField("Знание Небесного Свода"),
        winds: loreField("Знание Ветра"),
        paths: loreField("Знание путей"),
        forge: loreField("Знание кузни"),
        earth: loreField("Знание земли"),
        longing: loreField("Знание Желания"),
        storms: loreField("Знание Бурь"),
        transfiguration: loreField("Знание Метаморфоз"),
        beast: loreField("Знание Зверей"),
        flesh: loreField("Знание плоти"),
        wild: loreField("Знание Дикой природы"),
        death: loreField("Знание смерти"),
        spirit: loreField("Знание Душ"),
        realms: loreField("Знание Сфер"),
        patterns: loreField("Знание Узоров"),
        portals: loreField("Знание Порталов"),
        light: loreField("Знание Света"),
        fundament: loreField("Знание Основания"),
        chaos: loreField("Знание Хаоса"),
        contamination: loreField("Знание Нечистоты"),
        violation: loreField("Знание Насилия")
      }),

      apocalypticForm: new fields.SchemaField({
        active: new fields.BooleanField({ required: true, initial: false }),
        highTormentSelected: new fields.ArrayField(textField()),
        name: textField(),
        description: htmlField(),
        lowTorment: htmlField(),
        highTorment: htmlField(),
        mechanics: htmlField()
      }),

      pacts: new fields.SchemaField({
        notes: htmlField(),
        thralls: htmlField(),
        entries: new fields.ArrayField(pactEntryField())
      }),

      health: healthSchema(),

      automation: new fields.SchemaField({
        formExtraActionsTurn: ratingField(0, 10)
      }),

      creation: new fields.SchemaField({
        attributePrimary: textField(),
        attributeSecondary: textField(),
        attributeTertiary: textField(),
        abilityPrimary: textField(),
        abilitySecondary: textField(),
        abilityTertiary: textField(),
        primaryLore: textField(),
        freebiePool: new fields.NumberField({ required: true, integer: true, min: -999, max: 999, initial: 15 }),
        notes: textField()
      }),

      import: new fields.SchemaField({
        sourceFormat: textField(),
        sourceVersion: textField(),
        rawJson: new fields.StringField({ required: false, blank: true, initial: "" })
      })
    };
  }

  prepareDerivedData() {
    const xp = this.resources?.experience;
    if (xp) {
      xp.total = Math.max(0, Number(xp.total || 0));
      xp.spent = Math.max(0, Number(xp.spent || 0));
      xp.available = Math.max(0, Number(xp.available || 0));
    }

    const health = this.health;
    if (health) {
      const injured = ["bruised", "hurt", "injured", "wounded", "mauled", "crippled", "incapacitated"].filter(level => Number(health[level] || 0) > 0);
      health.summary = injured.length ? injured.at(-1) : "healthy";
    }
  }
}
