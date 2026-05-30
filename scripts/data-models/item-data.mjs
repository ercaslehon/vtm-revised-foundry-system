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

function descriptionSchema(extra = {}) {
  return new fields.SchemaField({
    value: htmlField(),
    system: htmlField(),
    chat: htmlField(),
    ...extra
  });
}

function auditSchema() {
  return new fields.SchemaField({
    status: textField("draft"),
    sourceUrl: textField(),
    sourceBook: textField(),
    sourcePage: textField(),
    checkedAt: textField(),
    checkedBy: textField(),
    notes: htmlField()
  });
}

function mechanicsSchema() {
  return new fields.SchemaField({
    activation: htmlField(),
    duration: htmlField(),
    successScaling: htmlField(),
    resistance: htmlField(),
    failure: htmlField(),
    botch: htmlField(),
    limits: htmlField(),
    automationNotes: htmlField()
  });
}

function automationSchema() {
  return new fields.SchemaField({
    roll: new fields.SchemaField({
      firstTrait: textField(),
      secondTrait: textField(),
      difficulty: new fields.NumberField({ required: false, integer: true, min: 2, max: 10, initial: 6 }),
      label: textField()
    }),
    cost: new fields.SchemaField({
      resource: textField(),
      amount: new fields.NumberField({ required: false, integer: true, min: 0, max: 99, initial: 0 }),
      blood: new fields.NumberField({ required: false, integer: true, min: 0, max: 99, initial: 0 }),
      willpower: new fields.NumberField({ required: false, integer: true, min: 0, max: 99, initial: 0 }),
      text: textField()
    }),
    source: new fields.SchemaField({
      url: textField(),
      page: textField(),
      section: textField()
    })
  });
}



export class VTMClanItemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      slug: textField(),
      nameEn: textField(),
      sect: textField(),
      aliases: textField(),
      disciplines: textField(),
      weakness: htmlField(),
      organization: htmlField(),
      stereotypes: htmlField(),
      opinion: htmlField(),
      roleplayTips: htmlField(),
      sourceUrl: textField(),
      sourceBook: textField(),
      sourcePage: textField(),
      description: descriptionSchema(),
      mechanics: mechanicsSchema(),
      audit: auditSchema(),
      rawName: textField(),
      isHomebrew: new fields.BooleanField({ required: true, initial: false })
    };
  }
}

export class VTMDisciplineItemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      rating: ratingField(0, 10),
      rulesId: textField(),
      source: textField(),
      description: descriptionSchema(),
      mechanics: mechanicsSchema(),
      audit: auditSchema(),
      automation: automationSchema(),
      rawName: textField(),
      isHomebrew: new fields.BooleanField({ required: true, initial: false })
    };
  }
}

export class VTMDisciplinePathItemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      rating: ratingField(0, 10),
      parentDiscipline: textField(),
      rulesId: textField(),
      description: descriptionSchema(),
      mechanics: mechanicsSchema(),
      audit: auditSchema(),
      automation: automationSchema(),
      rawName: textField(),
      isHomebrew: new fields.BooleanField({ required: true, initial: false })
    };
  }
}


export class VTMDisciplinePowerItemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      level: ratingField(0, 10),
      levelLabel: textField(),
      parentDiscipline: textField(),
      rulesId: textField(),
      description: descriptionSchema(),
      mechanics: mechanicsSchema(),
      audit: auditSchema(),
      automation: automationSchema(),
      rawName: textField(),
      isHomebrew: new fields.BooleanField({ required: true, initial: false })
    };
  }
}

export class VTMRuleEntryItemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      category: textField(),
      slug: textField(),
      aliases: textField(),
      description: descriptionSchema(),
      mechanics: mechanicsSchema(),
      audit: auditSchema(),
      automation: automationSchema(),
      rawName: textField(),
      isHomebrew: new fields.BooleanField({ required: true, initial: false })
    };
  }
}

export class VTMRitualItemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      level: ratingField(0, 10),
      discipline: textField("Тауматургия"),
      castingTime: textField(),
      cost: textField(),
      components: textField(),
      rulesId: textField(),
      description: descriptionSchema({ components: htmlField() }),
      mechanics: mechanicsSchema(),
      audit: auditSchema(),
      automation: automationSchema(),
      rawName: textField(),
      isHomebrew: new fields.BooleanField({ required: true, initial: false })
    };
  }
}

export class VTMRatedItemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      rating: ratingField(0, 10),
      points: ratingField(0, 20),
      category: textField(),
      trigger: textField(),
      description: descriptionSchema(),
      mechanics: mechanicsSchema(),
      audit: auditSchema(),
      automation: automationSchema(),
      effect: new fields.SchemaField({
        type: textField(),
        target: textField(),
        mode: textField(),
        amount: new fields.NumberField({ required: false, integer: true, min: -99, max: 99, initial: 0 }),
        difficultyModifier: new fields.NumberField({ required: false, integer: true, min: -10, max: 10, initial: 0 }),
        diceModifier: new fields.NumberField({ required: false, integer: true, min: -20, max: 20, initial: 0 }),
        notes: htmlField()
      }),
      rawText: textField(),
      rawName: textField(),
      isHomebrew: new fields.BooleanField({ required: true, initial: false })
    };
  }
}


export class VTMWeaponItemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      quantity: ratingField(1, 999),
      description: descriptionSchema(),
      mechanics: mechanicsSchema(),
      audit: auditSchema(),
      automation: automationSchema(),
      weapon: new fields.SchemaField({
        category: textField("melee"),
        damageType: textField("lethal"),
        difficulty: new fields.NumberField({ required: false, integer: true, min: 2, max: 10, initial: 6 }),
        damageDifficulty: new fields.NumberField({ required: false, integer: true, min: 2, max: 10, initial: 6 }),
        damageBonus: new fields.NumberField({ required: false, integer: true, min: -10, max: 30, initial: 1 }),
        damageDice: new fields.NumberField({ required: false, integer: true, min: 0, max: 30, initial: 4 }),
        usesStrength: new fields.BooleanField({ required: true, initial: true }),
        addsAttackSuccesses: new fields.BooleanField({ required: true, initial: true }),
        attackFirstTrait: textField("attribute.physical.dexterity"),
        attackSecondTrait: textField("ability.skills.melee"),
        range: textField(),
        rate: textField(),
        clip: textField(),
        conceal: textField(),
        minimumStrength: new fields.NumberField({ required: false, integer: true, min: 0, max: 10, initial: 0 }),
        notes: textField()
      }),
      rawText: textField(),
      rawName: textField(),
      isHomebrew: new fields.BooleanField({ required: true, initial: false })
    };
  }
}

export class VTMEquipmentItemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      quantity: ratingField(1, 999),
      description: new fields.SchemaField({ value: htmlField() }),
      rawText: textField()
    };
  }
}
