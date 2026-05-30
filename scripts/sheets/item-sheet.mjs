const ItemSheetV1 = foundry.appv1?.sheets?.ItemSheet ?? globalThis.ItemSheet;

export class VTMItemSheet extends ItemSheetV1 {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["vtm-revised", "sheet", "item"],
      template: "systems/vtm-revised/templates/items/item-sheet.hbs",
      width: 680,
      height: 720,
      resizable: true
    });
  }

  getData(options = {}) {
    const data = super.getData(options);
    data.system = this.item.system;
    data.config = CONFIG.VTM_REVISED;
    data.rollTraitOptions = this._buildRollTraitOptions();
    data.traitMax = Number(this.item.parent?.generationCaps?.traitMax ?? this.item.parent?.system?.resources?.traitMax ?? 10);
    return data;
  }

  _buildRollTraitOptions() {
    const options = [{ key: "", display: game.i18n.localize("VTM_REVISED.Roll.NoTraitSelected") }];
    const cfg = CONFIG.VTM_REVISED;
    const push = (key, label) => options.push({ key, display: label });

    for (const [group, keys] of Object.entries(cfg.attributeCategories ?? {})) {
      for (const key of keys) push(`attribute.${group}.${key}`, game.i18n.localize(`VTM_REVISED.Attribute.${key}`));
    }
    for (const [group, keys] of Object.entries(cfg.abilityCategories ?? {})) {
      for (const key of keys) push(`ability.${group}.${key}`, game.i18n.localize(`VTM_REVISED.Ability.${key}`));
    }
    push("virtue.conscience", game.i18n.localize("VTM_REVISED.Virtue.Conscience"));
    push("virtue.selfControl", game.i18n.localize("VTM_REVISED.Virtue.SelfControl"));
    push("virtue.courage", game.i18n.localize("VTM_REVISED.Virtue.Courage"));
    push("resource.willpower", game.i18n.localize("VTM_REVISED.Resource.Willpower"));
    push("resource.humanity", game.i18n.localize("VTM_REVISED.Resource.Humanity"));
    return options;
  }
}
