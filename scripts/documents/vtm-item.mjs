const TRAIT_ITEM_TYPES = new Set(["discipline", "disciplinePath", "background"]);

export class VTMItem extends Item {
  _generationTraitMax() {
    const actor = this.parent instanceof Actor ? this.parent : null;
    return Number(actor?.generationCaps?.traitMax ?? actor?.system?.resources?.traitMax ?? 10);
  }

  async _preCreate(data, options, user) {
    await super._preCreate?.(data, options, user);
    if (!TRAIT_ITEM_TYPES.has(data.type ?? this.type)) return;
    const max = this._generationTraitMax();
    const value = Number(foundry.utils.getProperty(data, "system.rating") ?? 0);
    if (value > max) foundry.utils.setProperty(data, "system.rating", max);
  }

  async _preUpdate(changed, options, user) {
    await super._preUpdate?.(changed, options, user);
    if (!TRAIT_ITEM_TYPES.has(this.type)) return;
    if (!foundry.utils.hasProperty(changed, "system.rating")) return;
    const max = this._generationTraitMax();
    const value = Number(foundry.utils.getProperty(changed, "system.rating") ?? 0);
    if (value > max) foundry.utils.setProperty(changed, "system.rating", max);
  }
}
