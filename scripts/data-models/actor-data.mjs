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
  const talentNames = ["alertness", "athletics", "brawl", "dodge", "empathy", "expression", "intimidation", "leadership", "streetwise", "subterfuge", "awareness"];
  const skillNames = ["animalken", "crafts", "drive", "etiquette", "firearms", "melee", "performance", "security", "stealth", "survival", "larceny", "ride"];
  const knowledgeNames = ["academics", "computer", "finance", "investigation", "law", "linguistics", "medicine", "occult", "politics", "science", "technology", "theology", "koldunism"];
  const build = names => Object.fromEntries(names.map(name => [name, namedRatingField()]));

  return new fields.SchemaField({
    talents: new fields.SchemaField(build(talentNames)),
    skills: new fields.SchemaField(build(skillNames)),
    knowledges: new fields.SchemaField(build(knowledgeNames)),
    custom: new fields.ArrayField(new fields.SchemaField({
      name: textField(),
      category: textField("custom"),
      value: ratingField(0, 10),
      specialization: textField()
    }))
  });
}

function healthSchema() {
  return new fields.SchemaField({
    bruised: ratingField(0, 1),
    hurt: ratingField(0, 1),
    injured: ratingField(0, 1),
    wounded: ratingField(0, 1),
    mauled: ratingField(0, 1),
    crippled: ratingField(0, 1),
    incapacitated: ratingField(0, 1),
    summary: textField()
  });
}

export class VTMVampireActorData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      profile: new fields.SchemaField({
        player: textField(),
        chronicle: textField(),
        nature: textField(),
        demeanor: textField(),
        concept: textField(),
        clan: textField(),
        generation: textField(),
        sire: textField(),
        sect: textField(),
        age: textField(),
        sex: textField(),
        avatar: new fields.FilePathField({ required: false, categories: ["IMAGE"], initial: "icons/svg/mystery-man.svg" }),
        appearance: htmlField(),
        history: htmlField(),
        goals: htmlField(),
        notes: htmlField(),
        alliesContacts: htmlField(),
        possessions: htmlField()
      }),
      attributes: attributesSchema(),
      abilities: abilitiesSchema(),
      virtues: new fields.SchemaField({
        conscience: ratingField(1),
        selfControl: ratingField(1),
        courage: ratingField(1)
      }),
      resources: new fields.SchemaField({
        humanity: resourceField(7, 10),
        willpower: resourceField(3, 3),
        blood: resourceField(10, 10),
        bloodPerTurn: ratingField(1, 10),
        traitMax: ratingField(5, 10),
        pathName: textField(),
        weakness: textField(),
        experience: new fields.SchemaField({
          total: ratingField(0, 999),
          spent: ratingField(0, 999),
          available: ratingField(0, 999)
        })
      }),
      health: healthSchema(),
      creation: new fields.SchemaField({
        freebiePool: new fields.NumberField({ required: true, integer: true, min: -999, max: 999, initial: 15 })
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
    if (xp) xp.available = Math.max(0, Number(xp.total || 0) - Number(xp.spent || 0));

    const health = this.health;
    if (health) {
      const injured = ["bruised", "hurt", "injured", "wounded", "mauled", "crippled", "incapacitated"].filter(level => Number(health[level] || 0) > 0);
      health.summary = injured.length ? injured.at(-1) : "healthy";
    }
  }
}

export class VTMNpcActorData extends VTMVampireActorData {}
