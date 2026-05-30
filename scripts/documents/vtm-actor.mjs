import { VTM_REVISED } from "../config.mjs";

const renderTemplateCompat = foundry.applications?.handlebars?.renderTemplate ?? globalThis.renderTemplate;

const TRAIT_ITEM_TYPES = new Set(["discipline", "disciplinePath", "background"]);

export class VTMActor extends Actor {
  prepareData() {
    super.prepareData();
  }

  static normalizeGeneration(value = "") {
    const raw = String(value ?? "").trim().toLowerCase();
    if (!raw) return "13";
    if (raw.includes("14") || raw.includes("thin") || raw.includes("слаб")) return "14+";
    const match = raw.match(/\d+/);
    if (!match) return "13";
    const generation = Number(match[0]);
    if (generation >= 14) return "14+";
    if (generation <= 3) return "3";
    return String(generation);
  }

  static generationCaps(generation = "13") {
    const key = this.normalizeGeneration(generation);
    const caps = VTM_REVISED.generationOptions.find(option => option.key === key)
      ?? VTM_REVISED.generationOptions.find(option => option.key === "13");
    return {
      key: caps.key,
      label: caps.label,
      traitMax: Number(caps.traitMax ?? 5),
      bloodMax: caps.bloodMax == null ? null : Number(caps.bloodMax),
      bloodPerTurn: caps.bloodPerTurn == null ? null : Number(caps.bloodPerTurn)
    };
  }

  get generationCaps() {
    return this.constructor.generationCaps(this.system?.profile?.generation);
  }

  async _preCreate(data, options, user) {
    await super._preCreate?.(data, options, user);
    const generation = foundry.utils.getProperty(data, "system.profile.generation") ?? "13";
    const caps = this.constructor.generationCaps(generation);
    this._applyGenerationCapsToUpdateData(data, caps, { includeGeneration: false, clampBlood: true });
  }

  async _preUpdate(changed, options, user) {
    await super._preUpdate?.(changed, options, user);
    const generation = foundry.utils.getProperty(changed, "system.profile.generation") ?? this.system?.profile?.generation ?? "13";
    const caps = this.constructor.generationCaps(generation);
    this._applyGenerationCapsToUpdateData(changed, caps, { includeGeneration: false, clampBlood: true });
    this._clampTraitFieldsInUpdate(changed, caps.traitMax);
  }

  _applyGenerationCapsToUpdateData(target, caps, { includeGeneration = false, clampBlood = true } = {}) {
    if (!target || !caps) return target;
    if (includeGeneration) foundry.utils.setProperty(target, "system.profile.generation", caps.key);
    foundry.utils.setProperty(target, "system.resources.traitMax", caps.traitMax);
    if (caps.bloodMax != null) {
      foundry.utils.setProperty(target, "system.resources.blood.max", caps.bloodMax);
      const currentBlood = Number(foundry.utils.getProperty(target, "system.resources.blood.value") ?? this.system?.resources?.blood?.value ?? 0);
      if (clampBlood && currentBlood > caps.bloodMax) foundry.utils.setProperty(target, "system.resources.blood.value", caps.bloodMax);
    }
    if (caps.bloodPerTurn != null) foundry.utils.setProperty(target, "system.resources.bloodPerTurn", caps.bloodPerTurn);
    return target;
  }

  _clampTraitFieldsInUpdate(changed, traitMax = 5) {
    const clampPath = path => {
      if (!foundry.utils.hasProperty(changed, path)) return;
      const value = Number(foundry.utils.getProperty(changed, path) ?? 0);
      if (value > traitMax) foundry.utils.setProperty(changed, path, traitMax);
    };

    for (const [group, keys] of Object.entries(VTM_REVISED.attributeCategories)) {
      for (const key of keys) clampPath(`system.attributes.${group}.${key}`);
    }
    for (const [group, keys] of Object.entries(VTM_REVISED.abilityCategories)) {
      for (const key of keys) clampPath(`system.abilities.${group}.${key}.value`);
    }
  }

  async applyGenerationCaps(generation = this.system?.profile?.generation, { clampTraits = true, notify = true } = {}) {
    const caps = this.constructor.generationCaps(generation);
    const update = {};
    this._applyGenerationCapsToUpdateData(update, caps, { includeGeneration: true, clampBlood: true });
    await this.update(update);
    if (clampTraits) await this.enforceGenerationTraitCaps(caps.traitMax);
    if (notify) {
      const bloodLabel = caps.bloodMax == null ? "?" : String(caps.bloodMax);
      const spendLabel = caps.bloodPerTurn == null ? "?" : String(caps.bloodPerTurn);
      ui.notifications?.info?.(game.i18n.format("VTM_REVISED.Generation.Applied", {
        generation: caps.label,
        traitMax: caps.traitMax,
        bloodMax: bloodLabel,
        bloodPerTurn: spendLabel
      }));
    }
    return caps;
  }

  async enforceGenerationTraitCaps(traitMax = this.generationCaps.traitMax) {
    const updates = {};
    let changed = 0;

    const clampActorPath = path => {
      const value = Number(foundry.utils.getProperty(this, path) ?? 0);
      if (value > traitMax) {
        updates[path] = traitMax;
        changed += 1;
      }
    };

    for (const [group, keys] of Object.entries(VTM_REVISED.attributeCategories)) {
      for (const key of keys) clampActorPath(`system.attributes.${group}.${key}`);
    }
    for (const [group, keys] of Object.entries(VTM_REVISED.abilityCategories)) {
      for (const key of keys) clampActorPath(`system.abilities.${group}.${key}.value`);
    }

    if (Object.keys(updates).length) await this.update(updates);

    const itemUpdates = [];
    for (const item of this.items ?? []) {
      if (!TRAIT_ITEM_TYPES.has(item.type)) continue;
      const value = Number(item.system?.rating ?? 0);
      if (value > traitMax) itemUpdates.push({ _id: item.id, "system.rating": traitMax });
    }
    if (itemUpdates.length) {
      changed += itemUpdates.length;
      await this.updateEmbeddedDocuments("Item", itemUpdates);
    }

    return changed;
  }

  async changeResource(resourcePath, delta, reason = "") {
    const path = `system.${resourcePath}.value`;
    const oldValue = Number(foundry.utils.getProperty(this, path) ?? 0);
    const maxPath = `system.${resourcePath}.max`;
    const maxValue = Number(foundry.utils.getProperty(this, maxPath) ?? Number.POSITIVE_INFINITY);
    const newValue = Math.max(0, Math.min(maxValue, oldValue + Number(delta)));

    await this.update({ [path]: newValue });
    await this.createResourceMessage({ resourcePath, oldValue, newValue, delta: newValue - oldValue, reason });
    return newValue;
  }

  async setResource(resourcePath, value, reason = "") {
    const path = `system.${resourcePath}.value`;
    const oldValue = Number(foundry.utils.getProperty(this, path) ?? 0);
    const maxPath = `system.${resourcePath}.max`;
    const maxValue = Number(foundry.utils.getProperty(this, maxPath) ?? Number.POSITIVE_INFINITY);
    const newValue = Math.max(0, Math.min(maxValue, Number(value)));
    await this.update({ [path]: newValue });
    await this.createResourceMessage({ resourcePath, oldValue, newValue, delta: newValue - oldValue, reason });
    return newValue;
  }

  async createResourceMessage({ resourcePath, oldValue, newValue, delta, reason }) {
    const content = await renderTemplateCompat("systems/vtm-revised/templates/chat/resource-change-card.hbs", {
      actor: this,
      resourcePath,
      oldValue,
      newValue,
      delta,
      reason
    });

    return ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content,
      flags: {
        "vtm-revised": {
          type: "resourceChange",
          actorId: this.id,
          resourcePath,
          oldValue,
          newValue,
          delta,
          reason
        }
      }
    });
  }
}
