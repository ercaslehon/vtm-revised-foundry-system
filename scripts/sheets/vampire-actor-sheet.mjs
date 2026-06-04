import { rollDicePool } from "../dice/dice-pool.mjs";
import { VTM_REVISED } from "../config.mjs";
import { applyAutomationCost, normalizeAutomationCost } from "../utils/automation-costs.mjs";
import { VTMDisciplineCard } from "../apps/discipline-card.mjs";
import { VTMRitualCard } from "../apps/ritual-card.mjs";
import { VTMClanCard, findClanItemForName } from "../apps/clan-card.mjs";
import { VTMMeritFlawCard } from "../apps/merit-flaw-card.mjs";
import { VTMArchetypeCard, findArchetypeForName } from "../apps/archetype-card.mjs";
import { VTMMoralityPathCard, findMoralityPathItemForName } from "../apps/morality-path-card.mjs";
import { VTMCharacterCreationWizard } from "../apps/character-creation-wizard.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const ActorSheetV2 = foundry.applications.sheets.ActorSheetV2;
const DialogV1 = foundry.appv1?.api?.Dialog ?? globalThis.Dialog;

const TEMPLATE_PARTIALS = [
  "systems/vtm-revised/templates/actors/parts/profile.hbs",
  "systems/vtm-revised/templates/actors/parts/attributes.hbs",
  "systems/vtm-revised/templates/actors/parts/abilities.hbs",
  "systems/vtm-revised/templates/actors/parts/advantages.hbs",
  "systems/vtm-revised/templates/actors/parts/blood-magic.hbs",
  "systems/vtm-revised/templates/actors/parts/weapons.hbs",
  "systems/vtm-revised/templates/actors/parts/creation-checklist.hbs",
  "systems/vtm-revised/templates/actors/parts/item-list.hbs",
  "systems/vtm-revised/templates/actors/parts/notes-v2.hbs",
  "systems/vtm-revised/templates/actors/parts/experience-journal.hbs"
];

/**
 * AppV2 actor sheet for Vampire actors.
 * The previous dev builds used the compatibility AppV1 ActorSheet. Foundry V14 renders it,
 * but in some installs the window never gets attached visibly. This sheet uses the V14
 * ApplicationV2 / ActorSheetV2 stack directly.
 */
export class VTMVampireActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    id: "vtm-revised-actor-sheet-{id}",
    classes: ["vtm-revised", "sheet", "actor", "vampire"],
    position: {
      width: 1460,
      height: 980
    },
    window: {
      resizable: true
    },
    form: {
      submitOnChange: true,
      closeOnSubmit: false,
      handler: VTMVampireActorSheet.#onSubmitForm
    }
  };

  static PARTS = {
    sheet: {
      template: "systems/vtm-revised/templates/actors/vampire-sheet-v2.hbs",
      templates: TEMPLATE_PARTIALS,
      scrollable: [".vtm-sheet-body"]
    }
  };

  get actor() {
    return this.document;
  }

  get title() {
    return this.actor?.name ?? game.i18n.localize("TYPES.Actor.vampire");
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.actor;

    const items = Array.from(actor.items ?? []);
    const generationCaps = actor.generationCaps ?? actor.constructor?.generationCaps?.(actor.system?.profile?.generation) ?? { key: "13", label: "13", traitMax: 5, bloodMax: 10, bloodPerTurn: 1 };
    const traitPips = Array.from({ length: Math.max(1, Number(generationCaps.traitMax ?? 5)) }, (_, index) => index + 1);
    const selectedNature = this._resolveArchetype(actor.system?.profile?.nature);
    const selectedDemeanor = this._resolveArchetype(actor.system?.profile?.demeanor);
    const selectedClan = this._resolveClan(actor.system?.profile?.clan);
    const moralityOptions = this._buildMoralityPathOptions();
    const selectedMoralityPath = this._resolveMoralityPath(actor.system?.resources?.pathName || "Р§РµР»РѕРІРµС‡РЅРѕСЃС‚СЊ");

    // Do not use foundry.utils.mergeObject here. ActorSheetV2 returns a context that already
    // contains document-like properties. Deep-merging an Actor instance makes Foundry try to
    // write into read-only document collections such as actor.items, which explodes with:
    // "Cannot assign to read only property 'items' of object '#<VTMActor>'".
    // A plain object spread keeps the context shallow and safe. Yes, this is the kind of
    // trap that makes JavaScript feel like a cursed Tremere ritual.
    const norm = value => String(value ?? "").trim().toLowerCase().replaceAll("С‘", "Рµ");
    const pathMatches = (item, names) => names.map(norm).includes(norm(item.system?.parentDiscipline || item.system?.discipline || ""));
    const allPaths = items.filter(item => item.type === "disciplinePath");
    const bloodMagicGroups = [
      { key: "thaumaturgy", parentName: "РўР°СѓРјР°С‚СѓСЂРіРёСЏ", aliases: ["РўР°СѓРјР°С‚СѓСЂРіРёСЏ", "Thaumaturgy"], title: game.i18n.localize("VTM_REVISED.BloodMagic.ThaumaturgyPaths") },
      { key: "koldunic", parentName: "РљРѕР»РґРѕРІСЃС‚РІРѕ", aliases: ["РљРѕР»РґРѕРІСЃС‚РІРѕ", "Koldunic Sorcery"], title: game.i18n.localize("VTM_REVISED.BloodMagic.KoldunicPaths") },
      { key: "necromancy", parentName: "РќРµРєСЂРѕРјР°РЅС‚РёСЏ", aliases: ["РќРµРєСЂРѕРјР°РЅС‚РёСЏ", "Necromancy"], title: game.i18n.localize("VTM_REVISED.BloodMagic.NecromancyPaths") },
      { key: "darkThaumaturgy", parentName: "РўРµРјРЅР°СЏ РўР°СѓРјР°С‚СѓСЂРіРёСЏ", aliases: ["РўРµРјРЅР°СЏ РўР°СѓРјР°С‚СѓСЂРіРёСЏ", "РўС‘РјРЅР°СЏ РўР°СѓРјР°С‚СѓСЂРіРёСЏ", "Dark Thaumaturgy"], title: game.i18n.localize("VTM_REVISED.BloodMagic.DarkThaumaturgyPaths") },
      { key: "assamiteSorcery", parentName: "Р§Р°СЂРѕРґРµР№СЃС‚РІРѕ РђСЃСЃР°РјРёС‚РѕРІ", aliases: ["Р§Р°СЂРѕРґРµР№СЃС‚РІРѕ РђСЃСЃР°РјРёС‚РѕРІ", "Assamite Sorcery"], title: game.i18n.localize("VTM_REVISED.BloodMagic.AssamiteSorceryPaths") },
      { key: "setiteSorcery", parentName: "Р§Р°СЂРѕРґРµР№СЃС‚РІРѕ РЎРµС‚С‚РёС‚РѕРІ", aliases: ["Р§Р°СЂРѕРґРµР№СЃС‚РІРѕ РЎРµС‚С‚РёС‚РѕРІ", "Setite Sorcery"], title: game.i18n.localize("VTM_REVISED.BloodMagic.SetiteSorceryPaths") }
    ].map(group => ({
      ...group,
      items: allPaths.filter(item => pathMatches(item, group.aliases))
    }));
    const groupedPathIds = new Set(bloodMagicGroups.flatMap(group => group.items.map(item => item.id)));
    const otherMagicPaths = allPaths.filter(item => !groupedPathIds.has(item.id));

    const healthRows = VTM_REVISED.healthLevels.map(key => {
      const penalty = VTM_REVISED.healthPenalties[key] ?? "";
      const penaltyLabel = penalty === "out"
        ? game.i18n.localize("VTM_REVISED.HealthPenalty.out")
        : game.i18n.format("VTM_REVISED.HealthPenalty.dice", { penalty });

      return {
        key,
        label: game.i18n.localize(`VTM_REVISED.Health.${key}`),
        penalty,
        penaltyLabel,
        checked: Number(actor.system?.health?.[key] || 0) > 0
      };
    });

    return {
      ...context,
      actor,
      document: actor,
      system: actor.system,
      editable: this.isEditable,
      cssClass: "vtm-revised sheet actor vampire",
      config: VTM_REVISED,
      disciplines: items.filter(item => item.type === "discipline"),
      powers: items.filter(item => item.type === "disciplinePower"),
      paths: allPaths,
      bloodMagicGroups,
      otherMagicPaths,
      rituals: items.filter(item => item.type === "ritual"),
      backgrounds: items.filter(item => item.type === "background"),
      merits: items.filter(item => item.type === "merit"),
      flaws: items.filter(item => item.type === "flaw"),
      equipment: items.filter(item => item.type === "equipment"),
      weapons: items.filter(item => item.type === "weapon"),
      attributeGroups: VTM_REVISED.attributeCategories,
      abilityGroups: VTM_REVISED.abilityCategories,
      healthLevels: VTM_REVISED.healthLevels,
      healthRows,
      activeHealthPenalty: this._resolveHealthPenalty(),
      generationCaps,
      traitPips,
      ritualPips: Array.from({ length: 10 }, (_, index) => index + 1),
      pathPips: Array.from({ length: Math.max(1, Number(generationCaps.traitMax ?? 5)) }, (_, index) => index + 1),
      generationOptions: VTM_REVISED.generationOptions,
      archetypeOptions: VTM_REVISED.archetypeOptions,
      selectedNature,
      selectedDemeanor,
      selectedClan,
      moralityOptions,
      selectedMoralityPath,
      activeSheetTab: this._activeSheetTab || "main",
      rollTraitOptions: this._buildRollTraitOptions(),
      rollTraitOptionGroups: this._buildRollTraitOptionGroups(),
      creation: this._buildCreationChecklist(),
      experienceJournal: this._buildExperienceJournalContext()
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const element = this.element;
    if (!element) return;

    // v10.0.1 sheet size guard.
    // Foundry can remember an accidentally tiny window position.
    // If that happens, the vampire sheet looks collapsed into a sad little nameplate.
    try {
      const current = this.position ?? {};
      const width = Number(current.width || element.closest(".application")?.offsetWidth || 0);
      const height = Number(current.height || element.closest(".application")?.offsetHeight || 0);

      if (width < 1180 || height < 760) {
        this.setPosition({
          width: Math.max(width || 0, 1460),
          height: Math.max(height || 0, 980)
        });
      }
    } catch (err) {
      console.debug("VtM Revised | Sheet size guard skipped", err);
    }

    const applyActiveTab = (tab, { scroll = false } = {}) => {
      const safeTab = ["main", "powers", "profile"].includes(tab) ? tab : "main";
      this._activeSheetTab = safeTab;

      element.querySelectorAll(".vtm-tab-item[data-vtm-tab]").forEach(button => {
        button.classList.toggle("is-active", button.dataset.vtmTab === safeTab);
      });

      element.querySelectorAll(".vtm-tab-panel[data-vtm-tab-panel]").forEach(panel => {
        panel.classList.toggle("is-active", panel.dataset.vtmTabPanel === safeTab);
      });

      if (scroll) {
        const scrollBody = element.querySelector(".vtm-sheet-body");
        if (scrollBody) scrollBody.scrollTop = 0;
      }
    };

    applyActiveTab(this._activeSheetTab || context?.activeSheetTab || "main");

    element.querySelectorAll(".vtm-tab-item[data-vtm-tab]").forEach(tabButton => {
      tabButton.addEventListener("click", event => {
        event.preventDefault();
        const tab = tabButton.dataset.vtmTab;
        if (!tab) return;
        applyActiveTab(tab, { scroll: true });
      });
    });

    element.querySelectorAll(".actor-portrait-view").forEach(image => {
      const openPortrait = async event => {
        event.preventDefault();
        await this._openActorPortraitViewer();
      };
      image.addEventListener("click", openPortrait);
      image.addEventListener("keydown", async event => {
        if (event.key !== "Enter" && event.key !== " ") return;
        await openPortrait(event);
      });
    });

    if (!this.isEditable) return;

    element.querySelectorAll(".trait-value-input").forEach(input => {
      const updatePips = () => {
        const row = input.closest(".trait-row");
        if (!row) return;

        const value = Number(input.value || 0);
        row.querySelectorAll(".trait-pips i").forEach((pip, index) => {
          pip.classList.toggle("is-filled", index < value);
        });
      };

      input.addEventListener("input", updatePips);
      input.addEventListener("change", updatePips);
      updatePips();
    });

    element.querySelectorAll(".actor-portrait-edit").forEach(button => {
      button.addEventListener("click", async event => {
        event.preventDefault();
        await this._openActorPortraitPicker();
      });
    });

    element.querySelectorAll(".actor-portrait-reset").forEach(button => {
      button.addEventListener("click", async event => {
        event.preventDefault();
        await this._setActorPortrait("icons/svg/mystery-man.svg", { notify: true });
      });
    });

    element.querySelectorAll(".actor-portrait-sync-token").forEach(button => {
      button.addEventListener("click", async event => {
        event.preventDefault();
        await this._syncPrototypeTokenImage();
      });
    });

    element.querySelectorAll(".resource-change").forEach(button => {
      button.addEventListener("click", async event => {
        event.preventDefault();
        const resource = button.dataset.resource;
        const delta = Number(button.dataset.delta || 0);
        await this.actor.changeResource(resource, delta, button.dataset.reason || "");
      });
    });

    element.querySelectorAll(".vtm-roll").forEach(button => {
      button.addEventListener("click", async event => {
        event.preventDefault();
        await this._openRollDialog({
          firstTrait: button.dataset.trait || "",
          label: button.dataset.label || game.i18n.localize("VTM_REVISED.Roll.Label")
        });
      });
    });

    const rollBuilder = element.querySelector(".vtm-roll-builder");
    rollBuilder?.querySelector(".vtm-roll-builder-submit")?.addEventListener("click", async event => {
      event.preventDefault();
      await this._rollFromForm(rollBuilder);
    });

    element.querySelectorAll(".generation-sync").forEach(button => {
      button.addEventListener("click", async event => {
        event.preventDefault();
        await this.actor.applyGenerationCaps(this.actor.system?.profile?.generation, { clampTraits: true, notify: true });
      });
    });

    element.querySelectorAll("[name='system.profile.generation']").forEach(input => {
      input.addEventListener("change", async event => {
        event.preventDefault();
        await this.actor.applyGenerationCaps(event.currentTarget.value, { clampTraits: true, notify: true });
      });
    });

    element.querySelectorAll(".nature-willpower-restore").forEach(button => {
      button.addEventListener("click", async event => {
        event.preventDefault();
        const nature = this._resolveArchetype(this.actor.system?.profile?.nature);
        const label = nature?.name || this.actor.system?.profile?.nature || game.i18n.localize("VTM_REVISED.Profile.Nature");
        await this.actor.changeResource("resources.willpower", 1, `${game.i18n.localize("VTM_REVISED.Archetype.Nature")}: ${label}`);
      });
    });

    element.querySelectorAll(".archetype-select").forEach(select => {
      select.addEventListener("change", event => {
        event.currentTarget.closest("form")?.requestSubmit?.();
      });
    });

    element.querySelectorAll(".archetype-card-open").forEach(button => {
      button.addEventListener("click", async event => {
        event.preventDefault();
        await this._openArchetypeCard(button.dataset.kind || "nature");
      });
    });

    element.querySelectorAll(".clan-card-open").forEach(button => {
      button.addEventListener("click", async event => {
        event.preventDefault();
        await this._openClanCard();
      });
    });

    element.querySelectorAll(".morality-path-card-open").forEach(button => {
      button.addEventListener("click", async event => {
        event.preventDefault();
        await this._openMoralityPathCard();
      });
    });

    element.querySelectorAll(".morality-path-select").forEach(select => {
      select.addEventListener("change", async event => {
        const value = event.currentTarget.value || "Р§РµР»РѕРІРµС‡РЅРѕСЃС‚СЊ";
        await this.actor.update({ "system.resources.pathName": value });
      });
    });

    element.querySelectorAll(".clan-select").forEach(select => {
      select.addEventListener("change", event => {
        event.currentTarget.closest("form")?.requestSubmit?.();
      });
    });

    element.querySelectorAll(".health-checkbox").forEach(checkbox => {
      checkbox.addEventListener("change", async event => {
        event.preventDefault();
        const key = checkbox.dataset.health;
        if (!key) return;
        await this.actor.update({ [`system.health.${key}`]: checkbox.checked ? 1 : 0 });
      });
    });


    element.querySelectorAll(".character-creation-wizard-open").forEach(button => {
      button.addEventListener("click", async event => {
        event.preventDefault();
        await new VTMCharacterCreationWizard({ actor: this.actor }).render({ force: true });
      });
    });

    element.querySelectorAll(".creation-fix-humanity").forEach(button => {
      button.addEventListener("click", async event => {
        event.preventDefault();
        await this._fixCreationHumanity();
      });
    });

    element.querySelectorAll(".creation-fix-willpower").forEach(button => {
      button.addEventListener("click", async event => {
        event.preventDefault();
        await this._fixCreationWillpower();
      });
    });

    element.querySelectorAll(".creation-roll-blood").forEach(button => {
      button.addEventListener("click", async event => {
        event.preventDefault();
        await this._rollCreationBloodPool();
      });
    });

    const experienceForm = element.querySelector(".experience-journal-form");
    experienceForm?.querySelector(".experience-journal-add")?.addEventListener("click", async event => {
      event.preventDefault();
      await this._addExperienceJournalEntry(experienceForm);
    });

    element.querySelectorAll(".experience-entry-delete").forEach(button => {
      button.addEventListener("click", async event => {
        event.preventDefault();
        await this._deleteExperienceJournalEntry(button.dataset.entryId || "");
      });
    });

    element.querySelectorAll(".experience-journal-recalc").forEach(button => {
      button.addEventListener("click", async event => {
        event.preventDefault();
        await this._recalculateExperienceFromJournal();
      });
    });

    element.querySelectorAll(".item-create").forEach(button => {
      button.addEventListener("click", async event => {
        event.preventDefault();
        const type = button.dataset.type;
        if (type === "discipline") {
          await this._openAddDisciplineDialog();
          return;
        }
        const name = game.i18n.localize(`TYPES.Item.${type}`) || type;
        await this.actor.createEmbeddedDocuments("Item", [{ name, type }]);
      });
    });

    element.querySelectorAll(".blood-magic-add-path").forEach(button => {
      button.addEventListener("click", async event => {
        event.preventDefault();
        await this._openAddBloodMagicPathDialog(button.dataset.parentDiscipline || "");
      });
    });

    element.querySelectorAll(".ritual-add-from-catalog").forEach(button => {
      button.addEventListener("click", async event => {
        event.preventDefault();
        await this._openAddRitualDialog();
      });
    });

    element.querySelectorAll(".ritual-sync-from-catalog").forEach(button => {
      button.addEventListener("click", async event => {
        event.preventDefault();
        await this._syncRitualsFromCatalog();
      });
    });

    element.querySelectorAll(".weapon-add-from-catalog").forEach(button => {
      button.addEventListener("click", async event => {
        event.preventDefault();
        await this._openAddWeaponDialog();
      });
    });

    element.querySelectorAll(".weapon-attack").forEach(button => {
      button.addEventListener("click", async event => {
        event.preventDefault();
        const row = button.closest("[data-item-id]");
        const item = row ? this.actor.items.get(row.dataset.itemId) : null;
        if (item?.type === "weapon") await this._useWeapon(item);
      });
    });


    element.querySelectorAll(".discipline-card-open").forEach(button => {
      button.addEventListener("click", async event => {
        event.preventDefault();
        const row = button.closest("[data-item-id]");
        const item = row ? this.actor.items.get(row.dataset.itemId) : null;
        if (item && ["discipline", "disciplinePath"].includes(item.type)) {
          await new VTMDisciplineCard({ actor: this.actor, discipline: item }).render({ force: true });
        }
      });
    });


    element.querySelectorAll(".ritual-card-open").forEach(button => {
      button.addEventListener("click", async event => {
        event.preventDefault();
        const row = button.closest("[data-item-id]");
        const item = row ? this.actor.items.get(row.dataset.itemId) : null;
        if (item?.type === "ritual") {
          await new VTMRitualCard({ actor: this.actor, ritual: item }).render({ force: true });
        }
      });
    });

    element.querySelectorAll(".item-use").forEach(button => {
      button.addEventListener("click", async event => {
        event.preventDefault();
        const row = button.closest("[data-item-id]");
        const item = row ? this.actor.items.get(row.dataset.itemId) : null;
        if (item?.type === "ritual") {
          await new VTMRitualCard({ actor: this.actor, ritual: item }).render({ force: true });
        } else if (item?.type === "weapon") {
          await this._useWeapon(item);
        } else if (["merit", "flaw", "background"].includes(item?.type)) {
          await new VTMMeritFlawCard({ actor: this.actor, item }).render({ force: true });
        } else if (item) await this._useItemAutomation(item);
      });
    });

    element.querySelectorAll(".merit-flaw-card-open").forEach(button => {
      button.addEventListener("click", async event => {
        event.preventDefault();
        const row = button.closest("[data-item-id]");
        const item = row ? this.actor.items.get(row.dataset.itemId) : null;
        if (["merit", "flaw", "background"].includes(item?.type)) {
          await new VTMMeritFlawCard({ actor: this.actor, item }).render({ force: true });
        }
      });
    });

    element.querySelectorAll(".merit-add-from-catalog, .flaw-add-from-catalog, .background-add-from-catalog").forEach(button => {
      button.addEventListener("click", async event => {
        event.preventDefault();
        await this._openAddCatalogTraitDialog(button.dataset.type || "merit");
      });
    });

    element.querySelectorAll(".item-edit").forEach(button => {
      button.addEventListener("click", event => {
        event.preventDefault();
        const row = button.closest("[data-item-id]");
        const item = row ? this.actor.items.get(row.dataset.itemId) : null;
        item?.sheet?.render(true);
      });
    });

    element.querySelectorAll(".item-delete").forEach(button => {
      button.addEventListener("click", async event => {
        event.preventDefault();
        const row = button.closest("[data-item-id]");
        if (!row) return;
        await this.actor.deleteEmbeddedDocuments("Item", [row.dataset.itemId]);
      });
    });
  }


  _experienceJournalEntries() {
    return Array.isArray(this.actor.system?.resources?.experience?.journal)
      ? Array.from(this.actor.system.resources.experience.journal)
      : [];
  }

  _formatExperienceDate(value = "") {
    if (!value) return "";
    try {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return String(value);
      return new Intl.DateTimeFormat(game.i18n?.lang || undefined, {
        dateStyle: "short",
        timeStyle: "short"
      }).format(date);
    } catch (_err) {
      return String(value);
    }
  }

  _experienceTypeLabel(type = "award") {
    const key = type === "spend" ? "TypeSpend" : type === "adjust" ? "TypeAdjust" : "TypeAward";
    return game.i18n.localize(`VTM_REVISED.Experience.${key}`);
  }

  _buildExperienceJournalContext() {
    const xp = this.actor.system?.resources?.experience ?? {};
    const entries = this._experienceJournalEntries()
      .map((entry, index) => {
        const delta = Number(entry.delta ?? 0);
        const reason = String(entry.reason || "").trim() || game.i18n.localize("VTM_REVISED.Experience.NoReason");
        return {
          ...entry,
          id: entry.id || String(index),
          type: entry.type || (delta < 0 ? "spend" : "award"),
          typeLabel: this._experienceTypeLabel(entry.type || (delta < 0 ? "spend" : "award")),
          dateLabel: this._formatExperienceDate(entry.createdAt),
          signedDelta: delta > 0 ? `+${delta}` : String(delta),
          positive: delta >= 0,
          reason,
          target: String(entry.target || "").trim(),
          userName: String(entry.userName || "").trim()
        };
      })
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

    return {
      available: Number(xp.available || 0),
      total: Number(xp.total || 0),
      spent: Number(xp.spent || 0),
      entries
    };
  }

  _newExperienceEntryId() {
    if (foundry.utils?.randomID) return foundry.utils.randomID(16);
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  _readExperienceJournalForm(form) {
    const type = form.querySelector("[data-xp-field='type']")?.value || "award";
    const rawAmount = Number(form.querySelector("[data-xp-field='amount']")?.value ?? 0);
    const reason = String(form.querySelector("[data-xp-field='reason']")?.value ?? "").trim();
    const target = String(form.querySelector("[data-xp-field='target']")?.value ?? "").trim();

    if (!Number.isFinite(rawAmount) || Number(rawAmount) === 0) {
      ui.notifications?.warn?.(game.i18n.localize("VTM_REVISED.Experience.AmountRequired"));
      return null;
    }

    const amount = Math.trunc(Math.abs(rawAmount));
    let delta = amount;
    if (type === "spend") delta = -amount;
    if (type === "adjust") delta = Math.trunc(rawAmount);

    return { type, amount, delta, reason, target };
  }

  async _addExperienceJournalEntry(form) {
    const data = this._readExperienceJournalForm(form);
    if (!data) return null;

    const xp = this.actor.system?.resources?.experience ?? {};
    const available = Number(xp.available || 0);
    if (data.type === "spend" && available + data.delta < 0) {
      ui.notifications?.warn?.(game.i18n.localize("VTM_REVISED.Experience.NotEnoughExperience"));
      return null;
    }

    const entry = {
      id: this._newExperienceEntryId(),
      type: data.type,
      amount: data.amount,
      delta: data.delta,
      reason: data.reason,
      target: data.target,
      createdAt: new Date().toISOString(),
      userId: game.user?.id || "",
      userName: game.user?.name || ""
    };

    const journal = [...this._experienceJournalEntries(), entry];
    const update = {
      "system.resources.experience.journal": journal,
      "system.resources.experience.available": Math.max(0, available + data.delta)
    };

    if (data.type === "award") update["system.resources.experience.total"] = Math.max(0, Number(xp.total || 0) + data.amount);
    if (data.type === "spend") update["system.resources.experience.spent"] = Math.max(0, Number(xp.spent || 0) + data.amount);

    await this.actor.update(update);

    form.querySelector("[data-xp-field='amount']").value = "1";
    form.querySelector("[data-xp-field='reason']").value = "";
    form.querySelector("[data-xp-field='target']").value = "";

    ui.notifications?.info?.(game.i18n.format("VTM_REVISED.Experience.EntryAdded", { delta: data.delta > 0 ? `+${data.delta}` : String(data.delta) }));
    return entry;
  }

  async _deleteExperienceJournalEntry(entryId = "") {
    if (!entryId) return null;

    const xp = this.actor.system?.resources?.experience ?? {};
    const journal = this._experienceJournalEntries();
    const entry = journal.find(item => String(item.id) === String(entryId));
    if (!entry) return null;

    const type = entry.type || (Number(entry.delta || 0) < 0 ? "spend" : "award");
    const amount = Math.abs(Number(entry.amount ?? entry.delta ?? 0));
    const delta = Number(entry.delta || 0);
    const nextJournal = journal.filter(item => String(item.id) !== String(entryId));

    const update = {
      "system.resources.experience.journal": nextJournal,
      "system.resources.experience.available": Math.max(0, Number(xp.available || 0) - delta)
    };

    if (type === "award") update["system.resources.experience.total"] = Math.max(0, Number(xp.total || 0) - amount);
    if (type === "spend") update["system.resources.experience.spent"] = Math.max(0, Number(xp.spent || 0) - amount);

    await this.actor.update(update);
    ui.notifications?.info?.(game.i18n.localize("VTM_REVISED.Experience.EntryDeleted"));
    return entry;
  }

  async _recalculateExperienceFromJournal() {
    const entries = this._experienceJournalEntries();
    const total = entries
      .filter(entry => entry.type === "award")
      .reduce((sum, entry) => sum + Math.abs(Number(entry.amount ?? entry.delta ?? 0)), 0);
    const spent = entries
      .filter(entry => entry.type === "spend")
      .reduce((sum, entry) => sum + Math.abs(Number(entry.amount ?? entry.delta ?? 0)), 0);
    const adjustments = entries
      .filter(entry => entry.type === "adjust")
      .reduce((sum, entry) => sum + Number(entry.delta || 0), 0);

    const available = Math.max(0, total - spent + adjustments);

    await this.actor.update({
      "system.resources.experience.total": Math.max(0, total),
      "system.resources.experience.spent": Math.max(0, spent),
      "system.resources.experience.available": available
    });

    ui.notifications?.info?.(game.i18n.localize("VTM_REVISED.Experience.Recalculated"));
    return { total, spent, available };
  }


  async _openActorPortraitViewer() {
    const image = this.actor.img || this.actor.system?.profile?.avatar || "icons/svg/mystery-man.svg";
    const title = this.actor.name || game.i18n.localize("TYPES.Actor.vampire");

    const ImagePopoutClass = foundry.applications?.apps?.ImagePopout?.implementation
      ?? foundry.applications?.apps?.ImagePopout
      ?? globalThis.ImagePopout;

    if (ImagePopoutClass) {
      try {
        return new ImagePopoutClass(image, {
          title,
          uuid: this.actor.uuid,
          shareable: false
        }).render(true);
      } catch (error) {
        console.warn("VTM Revised | ImagePopout failed, falling back to dialog.", error);
      }
    }

    const escapedSrc = foundry.utils.escapeHTML(image);
    const escapedTitle = foundry.utils.escapeHTML(title);
    const content = `
      <div class="vtm-portrait-viewer">
        <img src="${escapedSrc}" alt="${escapedTitle}" />
      </div>`;

    return new DialogV1({
      title,
      content,
      buttons: {
        close: {
          icon: '<i class="fas fa-xmark"></i>',
          label: game.i18n.localize("Close")
        }
      },
      default: "close"
    }, {
      width: 720,
      height: "auto",
      classes: ["vtm-revised", "vtm-portrait-viewer-dialog"]
    }).render(true);
  }


  async _openActorPortraitPicker() {
    const FilePickerClass = foundry.applications?.apps?.FilePicker?.implementation
      ?? foundry.applications?.apps?.FilePicker
      ?? globalThis.FilePicker;

    if (!FilePickerClass) {
      ui.notifications?.warn?.(game.i18n.localize("VTM_REVISED.Portrait.NoFilePicker"));
      return;
    }

    const current = this.actor.img || this.actor.system?.profile?.avatar || "icons/svg/mystery-man.svg";
    const picker = new FilePickerClass({
      type: "image",
      current,
      document: this.actor,
      callback: async path => this._setActorPortrait(path, { notify: true }),
      position: {
        top: (this.position?.top ?? 100) + 40,
        left: (this.position?.left ?? 100) + 10
      }
    });

    if (typeof picker.browse === "function") await picker.browse(current);
    else if (typeof picker.render === "function") picker.render(true);
  }

  async _setActorPortrait(path, { notify = false } = {}) {
    const image = String(path || "icons/svg/mystery-man.svg").trim() || "icons/svg/mystery-man.svg";
    await this.actor.update({
      img: image,
      "system.profile.avatar": image
    });
    if (notify) ui.notifications?.info?.(game.i18n.format("VTM_REVISED.Portrait.Updated", { path: image }));
    return image;
  }

  async _syncPrototypeTokenImage() {
    const image = this.actor.img || this.actor.system?.profile?.avatar || "icons/svg/mystery-man.svg";
    await this.actor.update({ "prototypeToken.texture.src": image });
    ui.notifications?.info?.(game.i18n.localize("VTM_REVISED.Portrait.TokenSynced"));
    return image;
  }


  async _openArchetypeCard(kind = "nature") {
    const key = kind === "demeanor" ? "demeanor" : "nature";
    const value = key === "demeanor" ? this.actor.system?.profile?.demeanor : this.actor.system?.profile?.nature;
    if (!value) {
      ui.notifications?.warn?.(key === "demeanor" ? game.i18n.localize("VTM_REVISED.Archetype.SelectDemeanorPrompt") : game.i18n.localize("VTM_REVISED.Archetype.SelectNaturePrompt"));
      return null;
    }
    const archetype = findArchetypeForName(value);
    return new VTMArchetypeCard({ actor: this.actor, archetype, kind: key }).render({ force: true });
  }

  _resolveClan(value = "") {
    const raw = String(value ?? "").trim();
    if (!raw) return null;
    const item = findClanItemForName(raw);
    if (item) return { name: item.name, item, imported: true };
    const normalized = this._normalizeName(raw);
    const option = (VTM_REVISED.clanOptions ?? []).find(clan => {
      const names = [clan.name, clan.slug, clan.nameEn].filter(Boolean);
      return names.some(name => this._normalizeName(name) === normalized);
    });
    return option ? { ...option, imported: false } : { name: raw, slug: "custom", imported: false };
  }

  async _openClanCard() {
    const clanName = this.actor.system?.profile?.clan;
    if (!clanName) {
      ui.notifications?.warn?.(game.i18n.localize("VTM_REVISED.Clan.SelectFirst"));
      return null;
    }
    const clan = findClanItemForName(clanName);
    if (!clan) {
      ui.notifications?.warn?.(game.i18n.localize("VTM_REVISED.Clan.CatalogMissing"));
      return new VTMClanCard({ actor: this.actor, clan: null }).render({ force: true });
    }
    return new VTMClanCard({ actor: this.actor, clan }).render({ force: true });
  }


  _buildMoralityPathOptions() {
    const catalog = Array.from(game.items ?? [])
      .filter(item => item.type === "moralityPath")
      .sort((a, b) => {
        const ca = String(a.system?.category || "");
        const cb = String(b.system?.category || "");
        const c = ca.localeCompare(cb);
        return c || a.name.localeCompare(b.name);
      });

    if (catalog.length) return catalog.map(item => ({
      id: item.id,
      name: item.name,
      category: item.system?.category || "path",
      label: `${item.system?.category === "road" ? "Р”РѕСЂРѕРіР°" : item.system?.category === "humanity" ? "Р§РµР»РѕРІРµС‡РЅРѕСЃС‚СЊ" : "РџСѓС‚СЊ"} В· ${item.name}`
    }));

    return [
      { id: "humanity", name: "Р§РµР»РѕРІРµС‡РЅРѕСЃС‚СЊ", category: "humanity", label: "Р§РµР»РѕРІРµС‡РЅРѕСЃС‚СЊ В· Р§РµР»РѕРІРµС‡РЅРѕСЃС‚СЊ" }
    ];
  }

  _resolveMoralityPath(value = "") {
    const raw = String(value || "Р§РµР»РѕРІРµС‡РЅРѕСЃС‚СЊ").trim();
    const item = findMoralityPathItemForName(raw);
    if (item) return { name: item.name, item, category: item.system?.category || "path", imported: true };
    return { name: raw, item: null, category: raw === "Р§РµР»РѕРІРµС‡РЅРѕСЃС‚СЊ" ? "humanity" : "custom", imported: false };
  }

  async _openMoralityPathCard() {
    const pathName = this.actor.system?.resources?.pathName || "Р§РµР»РѕРІРµС‡РЅРѕСЃС‚СЊ";
    const item = findMoralityPathItemForName(pathName);
    if (!item) ui.notifications?.warn?.("РљР°С‚Р°Р»РѕРі РџСѓС‚РµР№ Рё Р”РѕСЂРѕРі РЅРµ РёРјРїРѕСЂС‚РёСЂРѕРІР°РЅ РёР»Рё РІС‹Р±СЂР°РЅРЅРѕРµ РЅР°Р·РІР°РЅРёРµ РЅРµ РЅР°Р№РґРµРЅРѕ.");
    return new VTMMoralityPathCard({ actor: this.actor, moralityPath: item }).render({ force: true });
  }

  _resolveArchetype(value = "") {
    const raw = String(value ?? "").trim();
    if (!raw) return null;
    const normalized = this._normalizeName(raw);
    const found = (VTM_REVISED.archetypeOptions ?? []).find(archetype => {
      const names = [archetype.name, archetype.slug, ...(archetype.aliases ?? [])].filter(Boolean);
      return names.some(name => this._normalizeName(name) === normalized);
    });
    if (found) return { ...found, isCustom: false };
    return {
      slug: "custom",
      name: raw,
      motto: game.i18n.localize("VTM_REVISED.Archetype.CustomMotto"),
      summary: game.i18n.localize("VTM_REVISED.Archetype.CustomSummary"),
      regain: game.i18n.localize("VTM_REVISED.Archetype.CustomRegain"),
      isCustom: true
    };
  }

  _normalizeName(value = "") {
    return String(value ?? "")
      .trim()
      .toLowerCase()
      .replaceAll("С‘", "Рµ")
      .replace(/[\s_\-]+/g, " ");
  }

  _bloodMagicPathCandidates(parentDiscipline = "") {
    const parent = this._normalizeName(parentDiscipline);
    const actorPathNames = new Set(Array.from(this.actor.items ?? [])
      .filter(item => item.type === "disciplinePath")
      .map(item => this._normalizeName(item.name)));

    return Array.from(game.items ?? [])
      .filter(item => item.type === "disciplinePath")
      .filter(item => this._normalizeName(item.system?.parentDiscipline) === parent)
      .map(item => ({ item, known: actorPathNames.has(this._normalizeName(item.name)) }))
      .sort((a, b) => a.item.name.localeCompare(b.item.name));
  }

  async _openAddBloodMagicPathDialog(parentDiscipline = "") {
    const candidates = this._bloodMagicPathCandidates(parentDiscipline);
    const availableCandidates = candidates.filter(candidate => !candidate.known);
    if (!candidates.length) {
      ui.notifications?.warn?.(game.i18n.localize("VTM_REVISED.BloodMagic.NoCatalogPaths"));
      return;
    }
    if (!availableCandidates.length) {
      ui.notifications?.warn?.(game.i18n.localize("VTM_REVISED.BloodMagic.PathAlreadyKnown"));
      return;
    }

    const options = candidates.map(({ item, known }) => {
      const disabled = known ? " disabled" : "";
      const suffix = known ? ` (${game.i18n.localize("VTM_REVISED.BloodMagic.PathAlreadyKnown")})` : "";
      return `<option value="${foundry.utils.escapeHTML(item.id)}"${disabled}>${foundry.utils.escapeHTML(item.name + suffix)}</option>`;
    }).join("");

    const content = `
      <form class="vtm-add-blood-path-dialog">
        <p>${game.i18n.localize("VTM_REVISED.BloodMagic.SelectPathHelp")}</p>
        <div class="form-group">
          <label>${game.i18n.localize("VTM_REVISED.Item.ParentDiscipline")}</label>
          <input type="text" value="${foundry.utils.escapeHTML(parentDiscipline)}" disabled />
        </div>
        <div class="form-group">
          <label>${game.i18n.localize("VTM_REVISED.BloodMagic.SelectPath")}</label>
          <select name="pathId">${options}</select>
        </div>
        <div class="form-group">
          <label>${game.i18n.localize("VTM_REVISED.BloodMagic.InitialRating")}</label>
          <input type="number" name="rating" min="0" max="10" value="1" />
        </div>
      </form>`;

    return new Promise(resolve => {
      new DialogV1({
        title: game.i18n.localize("VTM_REVISED.BloodMagic.SelectPathTitle"),
        content,
        buttons: {
          add: {
            icon: '<i class="fas fa-plus"></i>',
            label: game.i18n.localize("VTM_REVISED.BloodMagic.AddPath"),
            callback: async html => {
              const form = this._getFormElement(html);
              const pathId = form?.querySelector("[name='pathId']")?.value;
              const rating = Number(form?.querySelector("[name='rating']")?.value ?? 1);
              const source = pathId ? game.items.get(pathId) : null;
              if (source) await this._addBloodMagicPathFromCatalog(source, rating);
              resolve(true);
            }
          },
          cancel: {
            label: game.i18n.localize("Cancel"),
            callback: () => resolve(false)
          }
        },
        default: "add",
        close: () => resolve(false)
      }, { width: 520 }).render(true);
    });
  }

  async _addBloodMagicPathFromCatalog(sourceItem, rating = 1) {
    const existing = Array.from(this.actor.items ?? [])
      .find(item => item.type === "disciplinePath" && this._normalizeName(item.name) === this._normalizeName(sourceItem.name));

    if (existing) {
      ui.notifications?.warn?.(game.i18n.localize("VTM_REVISED.BloodMagic.PathAlreadyKnown"));
      return existing;
    }

    const system = foundry.utils.deepClone(sourceItem.system ?? {});
    system.rating = Math.max(0, Math.min(10, Number(rating || 0)));
    system.parentDiscipline = system.parentDiscipline || sourceItem.system?.parentDiscipline || "";
    system.rulesId = system.rulesId || sourceItem.system?.rulesId || sourceItem.id;
    system.rawName = system.rawName || sourceItem.name;
    system.isHomebrew = false;

    const created = await this.actor.createEmbeddedDocuments("Item", [{
      name: sourceItem.name,
      type: "disciplinePath",
      img: sourceItem.img,
      system,
      flags: {
        "vtm-revised": {
          catalogSourceUuid: sourceItem.uuid,
          addedFromCatalogAt: new Date().toISOString()
        }
      }
    }]);

    const item = created?.[0];
    if (item) {
      ui.notifications?.info?.(game.i18n.format("VTM_REVISED.BloodMagic.PathAdded", { name: item.name }));
      await new VTMDisciplineCard({ actor: this.actor, discipline: item }).render({ force: true });
    }
    return item;
  }


  _catalogDisciplineItems() {
    const seen = new Set();
    const result = [];

    const addCandidate = item => {
      const key = this._normalizeName(item?.name);
      if (!key || seen.has(key)) return;
      seen.add(key);
      result.push(item);
    };

    for (const item of Array.from(game.items ?? []).filter(item => item.type === "discipline")) {
      addCandidate(item);
    }

    for (const option of VTM_REVISED.disciplineOptions ?? []) {
      addCandidate({
        id: `config:${option.slug || option.name}`,
        name: option.name,
        type: "discipline",
        img: "icons/magic/unholy/orb-swirling-teal.webp",
        system: {
          rating: 0,
          rawName: option.name,
          rulesId: option.slug || option.name,
          isHomebrew: false
        },
        flags: {
          "vtm-revised": {
            source: "config"
          }
        }
      });
    }

    return result.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  }

  _resolveDisciplineSource(sourceId = "") {
    const id = String(sourceId || "");
    if (!id.startsWith("config:")) return game.items.get(id) ?? null;

    const key = id.slice("config:".length);
    const option = (VTM_REVISED.disciplineOptions ?? [])
      .find(option => String(option.slug || option.name) === key);

    if (!option) return null;

    return {
      id,
      name: option.name,
      type: "discipline",
      img: "icons/magic/unholy/orb-swirling-teal.webp",
      system: {
        rating: 0,
        rawName: option.name,
        rulesId: option.slug || option.name,
        isHomebrew: false
      },
      flags: {
        "vtm-revised": {
          source: "config"
        }
      }
    };
  }

  _disciplineCandidates() {
    const actorDisciplineNames = new Set(Array.from(this.actor.items ?? [])
      .filter(item => item.type === "discipline")
      .map(item => this._normalizeName(item.name)));

    return this._catalogDisciplineItems()
      .map(item => ({ item, known: actorDisciplineNames.has(this._normalizeName(item.name)) }))
      .sort((a, b) => a.item.name.localeCompare(b.item.name));
  }

  async _openAddDisciplineDialog() {
    const candidates = this._disciplineCandidates();
    const availableCandidates = candidates.filter(candidate => !candidate.known);
    const traitMax = Math.max(1, Number(this.actor.generationCaps?.traitMax ?? this.actor.system?.resources?.traitMax ?? 5));

    if (!candidates.length) {
      ui.notifications?.warn?.(game.i18n.localize("VTM_REVISED.Discipline.NoCatalog"));
      return;
    }

    if (!availableCandidates.length) {
      ui.notifications?.warn?.(game.i18n.localize("VTM_REVISED.Discipline.AllKnown"));
      return;
    }

    const options = candidates.map(({ item, known }) => {
      const disabled = known ? " disabled" : "";
      const suffix = known ? ` (${game.i18n.localize("VTM_REVISED.Discipline.KnownSuffix")})` : "";
      return `<option value="${foundry.utils.escapeHTML(item.id)}"${disabled}>${foundry.utils.escapeHTML(item.name + suffix)}</option>`;
    }).join("");

    const content = `
      <form class="vtm-add-discipline-dialog">
        <p>${game.i18n.localize("VTM_REVISED.Discipline.SelectHelp")}</p>
        <div class="form-group">
          <label>${game.i18n.localize("VTM_REVISED.Discipline.Select")}</label>
          <select name="disciplineId">${options}</select>
        </div>
        <div class="form-group">
          <label>${game.i18n.localize("VTM_REVISED.Discipline.InitialRating")}</label>
          <input type="number" name="rating" min="0" max="${traitMax}" value="1" />
        </div>
      </form>`;

    return new Promise(resolve => {
      new DialogV1({
        title: game.i18n.localize("VTM_REVISED.Discipline.SelectTitle"),
        content,
        buttons: {
          add: {
            icon: '<i class="fas fa-plus"></i>',
            label: game.i18n.localize("VTM_REVISED.Discipline.Add"),
            callback: async html => {
              const form = this._getFormElement(html);
              const disciplineId = form?.querySelector("[name='disciplineId']")?.value;
              const rating = Number(form?.querySelector("[name='rating']")?.value ?? 1);
              const source = disciplineId ? this._resolveDisciplineSource(disciplineId) : null;
              if (source) await this._addDisciplineFromCatalog(source, rating);
              resolve(true);
            }
          },
          cancel: {
            label: game.i18n.localize("Cancel"),
            callback: () => resolve(false)
          }
        },
        default: "add",
        close: () => resolve(false)
      }, { width: 520 }).render(true);
    });
  }

  async _addDisciplineFromCatalog(sourceItem, rating = 1) {
    const existing = Array.from(this.actor.items ?? [])
      .find(item => item.type === "discipline" && this._normalizeName(item.name) === this._normalizeName(sourceItem.name));

    if (existing) {
      ui.notifications?.warn?.(game.i18n.localize("VTM_REVISED.Discipline.AlreadyKnown"));
      return existing;
    }

    const traitMax = Math.max(1, Number(this.actor.generationCaps?.traitMax ?? this.actor.system?.resources?.traitMax ?? 5));
    const system = foundry.utils.deepClone(sourceItem.system ?? {});
    system.rating = Math.max(0, Math.min(traitMax, Number(rating || 0)));
    system.rulesId = system.rulesId || sourceItem.system?.rulesId || sourceItem.id;
    system.rawName = system.rawName || sourceItem.name;
    system.isHomebrew = false;

    const created = await this.actor.createEmbeddedDocuments("Item", [{
      name: sourceItem.name,
      type: "discipline",
      img: sourceItem.img,
      system,
      flags: {
        "vtm-revised": {
          catalogSourceUuid: sourceItem.uuid || "",
          catalogSourceId: sourceItem.id || "",
          addedFromCatalogAt: new Date().toISOString()
        }
      }
    }]);

    const item = created?.[0];
    if (item) {
      ui.notifications?.info?.(game.i18n.format("VTM_REVISED.Discipline.Added", { name: item.name }));
      await new VTMDisciplineCard({ actor: this.actor, discipline: item }).render({ force: true });
    }
    return item;
  }


  _catalogWeaponItems() {
    return Array.from(game.items ?? []).filter(item => item.type === "weapon");
  }

  _weaponCandidates() {
    const actorWeaponNames = new Set(Array.from(this.actor.items ?? [])
      .filter(item => item.type === "weapon")
      .map(item => this._normalizeName(item.name)));

    return this._catalogWeaponItems()
      .map(item => ({ item, known: actorWeaponNames.has(this._normalizeName(item.name)) }))
      .sort((a, b) => {
        const categoryCompare = String(a.item.system?.weapon?.category || "").localeCompare(String(b.item.system?.weapon?.category || ""));
        if (categoryCompare) return categoryCompare;
        return a.item.name.localeCompare(b.item.name);
      });
  }

  async _openAddWeaponDialog() {
    const candidates = this._weaponCandidates();
    const availableCandidates = candidates.filter(candidate => !candidate.known);
    if (!candidates.length) {
      ui.notifications?.warn?.(game.i18n.localize("VTM_REVISED.Weapon.NoCatalogWeapons"));
      return;
    }
    if (!availableCandidates.length) {
      ui.notifications?.warn?.(game.i18n.localize("VTM_REVISED.Weapon.AllWeaponsKnown"));
      return;
    }

    const options = availableCandidates.map(({ item }) => {
      const weapon = item.system?.weapon ?? {};
      const category = this._weaponCategoryLabel(weapon.category);
      const damage = this._weaponDamageLabel(item);
      const label = `${category} В· ${item.name} В· ${damage}`;
      return `<option value="${foundry.utils.escapeHTML(item.id)}">${foundry.utils.escapeHTML(label)}</option>`;
    }).join("");

    const content = `
      <form class="vtm-add-weapon-dialog">
        <p>${game.i18n.localize("VTM_REVISED.Weapon.SelectHelp")}</p>
        <div class="form-group">
          <label>${game.i18n.localize("VTM_REVISED.Weapon.SelectWeapon")}</label>
          <select name="weaponId">${options}</select>
        </div>
      </form>`;

    return new Promise(resolve => {
      new DialogV1({
        title: game.i18n.localize("VTM_REVISED.Weapon.SelectTitle"),
        content,
        buttons: {
          add: {
            icon: '<i class="fas fa-plus"></i>',
            label: game.i18n.localize("VTM_REVISED.Weapon.Add"),
            callback: async html => {
              const form = this._getFormElement(html);
              const weaponId = form?.querySelector("[name='weaponId']")?.value;
              const source = weaponId ? game.items.get(weaponId) : null;
              if (source) await this._addWeaponFromCatalog(source);
              resolve(true);
            }
          },
          cancel: {
            label: game.i18n.localize("Cancel"),
            callback: () => resolve(false)
          }
        },
        default: "add",
        close: () => resolve(false)
      }, { width: 620 }).render(true);
    });
  }

  async _addWeaponFromCatalog(sourceItem) {
    const existing = Array.from(this.actor.items ?? [])
      .find(item => item.type === "weapon" && this._normalizeName(item.name) === this._normalizeName(sourceItem.name));

    if (existing) {
      ui.notifications?.warn?.(game.i18n.localize("VTM_REVISED.Weapon.AlreadyKnown"));
      return existing;
    }

    const system = foundry.utils.deepClone(sourceItem.system ?? {});
    system.rawName = system.rawName || sourceItem.name;
    system.isHomebrew = false;

    const created = await this.actor.createEmbeddedDocuments("Item", [{
      name: sourceItem.name,
      type: "weapon",
      img: sourceItem.img,
      system,
      flags: {
        "vtm-revised": {
          catalogSourceUuid: sourceItem.uuid,
          addedFromCatalogAt: new Date().toISOString()
        }
      }
    }]);

    const item = created?.[0];
    if (item) ui.notifications?.info?.(game.i18n.format("VTM_REVISED.Weapon.Added", { name: item.name }));
    return item;
  }

  _weaponCategoryLabel(category = "") {
    const found = (VTM_REVISED.weaponCategories ?? []).find(entry => entry.key === category);
    return found?.name ?? category ?? "";
  }

  _damageTypeLabel(type = "") {
    const found = (VTM_REVISED.damageTypes ?? []).find(entry => entry.key === type);
    return found?.name ?? type ?? "";
  }

  _weaponDamageLabel(item) {
    const weapon = item.system?.weapon ?? {};
    const type = this._damageTypeLabel(weapon.damageType);
    if (weapon.usesStrength) return `${game.i18n.localize("VTM_REVISED.Attribute.strength")} + ${Number(weapon.damageBonus || 0)} ${type}`;
    return `${Number(weapon.damageDice || 0)} ${type}`;
  }

  async _useWeapon(item) {
    const weapon = item.system?.weapon ?? {};
    const attackFirst = weapon.attackFirstTrait || "attribute.physical.dexterity";
    const attackSecond = weapon.attackSecondTrait || (weapon.category === "firearm" ? "ability.skills.firearms" : "ability.skills.melee");
    const defaultDifficulty = Number(weapon.difficulty || 6);
    const damageDifficulty = Number(weapon.damageDifficulty || 6);

    const content = `
      <form class="vtm-weapon-attack-dialog">
        <p><strong>${foundry.utils.escapeHTML(item.name)}</strong></p>
        <div class="form-group">
          <label>${game.i18n.localize("VTM_REVISED.Roll.FirstTrait")}</label>
          ${this._buildRollSelectHtml("firstTrait", attackFirst, false)}
        </div>
        <div class="form-group">
          <label>${game.i18n.localize("VTM_REVISED.Roll.SecondTrait")}</label>
          ${this._buildRollSelectHtml("secondTrait", attackSecond, true)}
        </div>
        <div class="grid grid-2">
          <label>${game.i18n.localize("VTM_REVISED.Roll.Difficulty")}
            <input type="number" name="difficulty" min="2" max="10" value="${defaultDifficulty}"/>
          </label>
          <label>${game.i18n.localize("VTM_REVISED.Weapon.DamageDifficulty")}
            <input type="number" name="damageDifficulty" min="2" max="10" value="${damageDifficulty}"/>
          </label>
        </div>
        <p class="muted">${game.i18n.format("VTM_REVISED.Weapon.DamagePreview", { damage: this._weaponDamageLabel(item) })}</p>
      </form>`;

    return new Promise(resolve => {
      new DialogV1({
        title: game.i18n.format("VTM_REVISED.Weapon.AttackWith", { name: item.name }),
        content,
        buttons: {
          attack: {
            icon: '<i class="fas fa-dice-d10"></i>',
            label: game.i18n.localize("VTM_REVISED.Weapon.AttackAndDamage"),
            callback: async html => {
              const form = this._getFormElement(html);
              await this._rollWeaponAttackAndDamage(item, {
                firstTrait: form?.querySelector("[name='firstTrait']")?.value || attackFirst,
                secondTrait: form?.querySelector("[name='secondTrait']")?.value || attackSecond,
                difficulty: Number(form?.querySelector("[name='difficulty']")?.value || defaultDifficulty),
                damageDifficulty: Number(form?.querySelector("[name='damageDifficulty']")?.value || damageDifficulty)
              });
              resolve(true);
            }
          },
          cancel: {
            label: game.i18n.localize("Cancel"),
            callback: () => resolve(false)
          }
        },
        default: "attack",
        close: () => resolve(false)
      }, { width: 520 }).render(true);
    });
  }

  async _rollWeaponAttackAndDamage(item, options = {}) {
    const first = this._resolveTraitOption(options.firstTrait);
    const second = this._resolveTraitOption(options.secondTrait);
    if (!first) {
      ui.notifications?.warn?.(game.i18n.localize("VTM_REVISED.Roll.NoTraitSelected"));
      return;
    }

    const healthPenalty = this._resolveHealthPenalty();
    if (healthPenalty.incapacitated) {
      ui.notifications?.warn?.(game.i18n.localize("VTM_REVISED.Roll.HealthBlocked"));
      return;
    }

    const components = [first, second].filter(Boolean);
    const basePool = Math.max(1, components.reduce((total, component) => total + Number(component.value || 0), 0));
    const attackPool = Math.max(1, basePool + healthPenalty.value);
    const attackResult = await rollDicePool({
      actor: this.actor,
      pool: attackPool,
      basePool,
      healthPenalty: healthPenalty.value,
      healthPenaltyLabel: healthPenalty.label,
      difficulty: Number(options.difficulty || 6),
      label: game.i18n.format("VTM_REVISED.Weapon.AttackLabel", { name: item.name }),
      components
    });

    if (attackResult.botch || attackResult.successes <= 0) {
      ui.notifications?.warn?.(game.i18n.format("VTM_REVISED.Weapon.AttackMissed", { name: item.name }));
      return attackResult;
    }

    const weapon = item.system?.weapon ?? {};
    const extraSuccesses = weapon.addsAttackSuccesses === false ? 0 : Math.max(0, Number(attackResult.successes || 0) - 1);
    const strength = Number(foundry.utils.getProperty(this.actor, "system.attributes.physical.strength") || 0);
    const baseDamage = weapon.usesStrength ? (strength + Number(weapon.damageBonus || 0)) : Number(weapon.damageDice || 0);
    const damagePool = Math.max(1, baseDamage + extraSuccesses);
    const damageTypeLabel = this._damageTypeLabel(weapon.damageType);
    const damageComponents = [
      { label: weapon.usesStrength ? game.i18n.localize("VTM_REVISED.Weapon.BaseDamageStrength") : game.i18n.localize("VTM_REVISED.Weapon.BaseDamage"), value: baseDamage },
      { label: game.i18n.localize("VTM_REVISED.Weapon.ExtraAttackSuccesses"), value: extraSuccesses }
    ];

    const damageResult = await rollDicePool({
      actor: this.actor,
      pool: damagePool,
      basePool: damagePool,
      healthPenalty: 0,
      difficulty: Number(options.damageDifficulty || weapon.damageDifficulty || 6),
      label: game.i18n.format("VTM_REVISED.Weapon.DamageLabel", { name: item.name }),
      flavor: game.i18n.format("VTM_REVISED.Weapon.DamageFlavor", { type: damageTypeLabel }),
      components: damageComponents
    });

    await this._createWeaponDamageSummary({ item, weapon, attackResult, damageResult, extraSuccesses, damagePool, damageTypeLabel });
    return { attackResult, damageResult };
  }

  async _createWeaponDamageSummary({ item, weapon, attackResult, damageResult, extraSuccesses, damagePool, damageTypeLabel }) {
    const renderTemplate = foundry.applications?.handlebars?.renderTemplate ?? globalThis.renderTemplate;
    const content = await renderTemplate("systems/vtm-revised/templates/chat/weapon-damage-card.hbs", {
      actor: this.actor,
      item,
      weapon,
      attackSuccesses: attackResult.successes,
      extraSuccesses,
      damagePool,
      damageSuccesses: damageResult.successes,
      damageTypeLabel,
      soakHint: this._soakHint(weapon.damageType)
    });
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content,
      flags: { "vtm-revised": { type: "weaponDamage", actorId: this.actor.id, itemId: item.id } }
    });
  }

  _soakHint(damageType = "") {
    if (damageType === "bashing") return game.i18n.localize("VTM_REVISED.Weapon.SoakBashing");
    if (damageType === "lethal") return game.i18n.localize("VTM_REVISED.Weapon.SoakLethal");
    if (damageType === "aggravated") return game.i18n.localize("VTM_REVISED.Weapon.SoakAggravated");
    return "";
  }


  _catalogRitualItems() {
    return Array.from(game.items ?? []).filter(item => item.type === "ritual");
  }

  _catalogNamesForItem(item) {
    const original = item?.flags?.["vtm-revised"]?.original ?? {};
    const aliases = Array.isArray(original.aliases) ? original.aliases : [];
    return [item?.name, item?.system?.rawName, ...(aliases ?? [])]
      .filter(Boolean)
      .map(value => this._normalizeName(value));
  }

  _findCatalogRitualFor(actorRitual) {
    const wanted = new Set([actorRitual?.name, actorRitual?.system?.rawName]
      .filter(Boolean)
      .map(value => this._normalizeName(value)));

    const catalogUuid = actorRitual?.flags?.["vtm-revised"]?.catalogSourceUuid;
    if (catalogUuid) {
      const byUuid = this._catalogRitualItems().find(item => item.uuid === catalogUuid);
      if (byUuid) return byUuid;
    }

    return this._catalogRitualItems().find(item => this._catalogNamesForItem(item).some(name => wanted.has(name)));
  }

  async _syncRitualsFromCatalog() {
    const rituals = Array.from(this.actor.items ?? []).filter(item => item.type === "ritual");
    if (!rituals.length) {
      ui.notifications?.warn?.(game.i18n.localize("VTM_REVISED.Ritual.NoActorRituals"));
      return [];
    }

    const updates = [];
    for (const ritual of rituals) {
      const source = this._findCatalogRitualFor(ritual);
      if (!source) continue;
      const system = foundry.utils.deepClone(source.system ?? {});
      system.rulesId = system.rulesId || source.system?.rulesId || source.id;
      system.rawName = system.rawName || source.name;
      system.isHomebrew = false;
      updates.push({
        _id: ritual.id,
        name: source.name,
        img: source.img,
        system,
        flags: {
          "vtm-revised": {
            ...(ritual.flags?.["vtm-revised"] ?? {}),
            catalogSourceUuid: source.uuid,
            syncedFromCatalogAt: new Date().toISOString()
          }
        }
      });
    }

    if (!updates.length) {
      ui.notifications?.warn?.(game.i18n.localize("VTM_REVISED.Ritual.SyncNothing"));
      return [];
    }

    const updated = await this.actor.updateEmbeddedDocuments("Item", updates);
    ui.notifications?.info?.(game.i18n.format("VTM_REVISED.Ritual.SyncDone", { count: updated.length }));
    return updated;
  }

  _ritualCandidates() {
    const actorRitualNames = new Set(Array.from(this.actor.items ?? [])
      .filter(item => item.type === "ritual")
      .map(item => this._normalizeName(item.name)));

    return Array.from(game.items ?? [])
      .filter(item => item.type === "ritual")
      .map(item => ({ item, known: actorRitualNames.has(this._normalizeName(item.name)) }))
      .sort((a, b) => {
        const levelA = Number(a.item.system?.level || 0);
        const levelB = Number(b.item.system?.level || 0);
        if (levelA !== levelB) return levelA - levelB;
        const disciplineCompare = String(a.item.system?.discipline || "").localeCompare(String(b.item.system?.discipline || ""));
        if (disciplineCompare) return disciplineCompare;
        return a.item.name.localeCompare(b.item.name);
      });
  }

  async _openAddRitualDialog() {
    const candidates = this._ritualCandidates();
    const availableCandidates = candidates.filter(candidate => !candidate.known);
    if (!candidates.length) {
      ui.notifications?.warn?.(game.i18n.localize("VTM_REVISED.Ritual.NoCatalogRituals"));
      return;
    }
    if (!availableCandidates.length) {
      ui.notifications?.warn?.(game.i18n.localize("VTM_REVISED.Ritual.AllRitualsKnown"));
      return;
    }

    const options = availableCandidates.map(({ item }) => {
      const level = Number(item.system?.level || 0);
      const discipline = item.system?.discipline ? `${item.system.discipline} В· ` : "";
      const label = `${discipline}${level ? `${game.i18n.localize("VTM_REVISED.Item.Level")} ${level} В· ` : ""}${item.name}`;
      return `<option value="${foundry.utils.escapeHTML(item.id)}">${foundry.utils.escapeHTML(label)}</option>`;
    }).join("");

    const content = `
      <form class="vtm-add-ritual-dialog">
        <p>${game.i18n.localize("VTM_REVISED.Ritual.SelectHelp")}</p>
        <div class="form-group">
          <label>${game.i18n.localize("VTM_REVISED.Ritual.SelectRitual")}</label>
          <select name="ritualId">${options}</select>
        </div>
      </form>`;

    return new Promise(resolve => {
      new DialogV1({
        title: game.i18n.localize("VTM_REVISED.Ritual.SelectTitle"),
        content,
        buttons: {
          add: {
            icon: '<i class="fas fa-plus"></i>',
            label: game.i18n.localize("VTM_REVISED.Ritual.Add"),
            callback: async html => {
              const form = this._getFormElement(html);
              const ritualId = form?.querySelector("[name='ritualId']")?.value;
              const source = ritualId ? game.items.get(ritualId) : null;
              if (source) await this._addRitualFromCatalog(source);
              resolve(true);
            }
          },
          cancel: {
            label: game.i18n.localize("Cancel"),
            callback: () => resolve(false)
          }
        },
        default: "add",
        close: () => resolve(false)
      }, { width: 620 }).render(true);
    });
  }

  async _addRitualFromCatalog(sourceItem) {
    const existing = Array.from(this.actor.items ?? [])
      .find(item => item.type === "ritual" && this._normalizeName(item.name) === this._normalizeName(sourceItem.name));

    if (existing) {
      ui.notifications?.warn?.(game.i18n.localize("VTM_REVISED.Ritual.AlreadyKnown"));
      return existing;
    }

    const system = foundry.utils.deepClone(sourceItem.system ?? {});
    system.rulesId = system.rulesId || sourceItem.system?.rulesId || sourceItem.id;
    system.rawName = system.rawName || sourceItem.name;
    system.isHomebrew = false;

    const created = await this.actor.createEmbeddedDocuments("Item", [{
      name: sourceItem.name,
      type: "ritual",
      img: sourceItem.img,
      system,
      flags: {
        "vtm-revised": {
          catalogSourceUuid: sourceItem.uuid,
          addedFromCatalogAt: new Date().toISOString()
        }
      }
    }]);

    const item = created?.[0];
    if (item) {
      ui.notifications?.info?.(game.i18n.format("VTM_REVISED.Ritual.Added", { name: item.name }));
      await new VTMRitualCard({ actor: this.actor, ritual: item }).render({ force: true });
    }
    return item;
  }


  _catalogMeritFlawItems(type = "merit") {
    return Array.from(game.items ?? []).filter(item => item.type === type);
  }

  _meritFlawCandidates(type = "merit") {
    const actorNames = new Set(Array.from(this.actor.items ?? [])
      .filter(item => item.type === type)
      .map(item => this._normalizeName(item.name)));

    return this._catalogMeritFlawItems(type)
      .map(item => ({ item, known: actorNames.has(this._normalizeName(item.name)) }))
      .sort((a, b) => {
        const categoryCompare = String(a.item.system?.category || "").localeCompare(String(b.item.system?.category || ""));
        if (categoryCompare) return categoryCompare;
        const pointsA = Number(a.item.system?.points || 0);
        const pointsB = Number(b.item.system?.points || 0);
        if (pointsA !== pointsB) return pointsA - pointsB;
        return a.item.name.localeCompare(b.item.name);
      });
  }

  async _openAddCatalogTraitDialog(type = "merit") {
    const candidates = this._meritFlawCandidates(type);
    const availableCandidates = candidates.filter(candidate => !candidate.known);
    const typeLabel = game.i18n.localize(type === "flaw" ? "TYPES.Item.flaw" : (type === "background" ? "TYPES.Item.background" : "TYPES.Item.merit"));

    if (!candidates.length) {
      ui.notifications?.warn?.(game.i18n.localize(type === "background" ? "VTM_REVISED.Background.NoCatalog" : "VTM_REVISED.MeritFlaw.NoCatalog"));
      return;
    }
    if (!availableCandidates.length) {
      ui.notifications?.warn?.(game.i18n.localize(type === "background" ? "VTM_REVISED.Background.AllKnown" : "VTM_REVISED.MeritFlaw.AllKnown"));
      return;
    }

    const options = availableCandidates.map(({ item }) => {
      const points = Number(item.system?.points || 0);
      const category = item.system?.category ? `${item.system.category} В· ` : "";
      const label = `${category}${points ? `${points} В· ` : ""}${item.name}`;
      return `<option value="${foundry.utils.escapeHTML(item.id)}">${foundry.utils.escapeHTML(label)}</option>`;
    }).join("");

    const content = `
      <form class="vtm-add-merit-flaw-dialog">
        <p>${game.i18n.format("VTM_REVISED.MeritFlaw.SelectHelp", { type: typeLabel })}</p>
        <div class="form-group">
          <label>${game.i18n.format("VTM_REVISED.MeritFlaw.Select", { type: typeLabel })}</label>
          <select name="itemId">${options}</select>
        </div>
      </form>`;

    return new Promise(resolve => {
      new DialogV1({
        title: game.i18n.format("VTM_REVISED.MeritFlaw.SelectTitle", { type: typeLabel }),
        content,
        buttons: {
          add: {
            icon: '<i class="fas fa-plus"></i>',
            label: game.i18n.localize("VTM_REVISED.MeritFlaw.Add"),
            callback: async html => {
              const form = this._getFormElement(html);
              const itemId = form?.querySelector("[name='itemId']")?.value;
              const source = itemId ? game.items.get(itemId) : null;
              if (source) await this._addCatalogTraitFromCatalog(source);
              resolve(true);
            }
          },
          cancel: {
            label: game.i18n.localize("Cancel"),
            callback: () => resolve(false)
          }
        },
        default: "add",
        close: () => resolve(false)
      }, { width: 620 }).render(true);
    });
  }

  async _addCatalogTraitFromCatalog(sourceItem) {
    const existing = Array.from(this.actor.items ?? [])
      .find(item => item.type === sourceItem.type && this._normalizeName(item.name) === this._normalizeName(sourceItem.name));

    if (existing) {
      ui.notifications?.warn?.(game.i18n.localize(sourceItem.type === "background" ? "VTM_REVISED.Background.AlreadyKnown" : "VTM_REVISED.MeritFlaw.AlreadyKnown"));
      return existing;
    }

    const system = foundry.utils.deepClone(sourceItem.system ?? {});
    system.rawName = system.rawName || sourceItem.name;
    system.isHomebrew = false;

    const created = await this.actor.createEmbeddedDocuments("Item", [{
      name: sourceItem.name,
      type: sourceItem.type,
      img: sourceItem.img,
      system,
      flags: {
        "vtm-revised": {
          catalogSourceUuid: sourceItem.uuid,
          addedFromCatalogAt: new Date().toISOString()
        }
      }
    }]);

    const item = created?.[0];
    if (item) {
      ui.notifications?.info?.(game.i18n.format(item.type === "background" ? "VTM_REVISED.Background.Added" : "VTM_REVISED.MeritFlaw.Added", { name: item.name }));
      await new VTMMeritFlawCard({ actor: this.actor, item }).render({ force: true });
    }
    return item;
  }


  _buildCreationChecklist() {
    const actor = this.actor;
    const system = actor.system ?? {};
    const t = key => game.i18n.localize(`VTM_REVISED.Creation.${key}`);

    const sum = values => values.reduce((total, value) => total + Number(value || 0), 0);
    const statusForExact = (isOk, hasOver = false) => isOk ? "ok" : (hasOver ? "warn" : "info");
    const iconFor = status => status === "ok" ? "вњ“" : (status === "warn" ? "!" : "вЂў");
    const statusLabel = status => status === "ok" ? t("StatusOk") : (status === "warn" ? t("StatusWarn") : t("StatusInfo"));
    const makeRow = ({ label, detail, ok = false, warn = false, warning = "" }) => {
      const status = statusForExact(ok, warn);
      return { label, detail, status, icon: iconFor(status), statusLabel: statusLabel(status), warning };
    };

    const attributeTotalsByGroup = Object.entries(VTM_REVISED.attributeCategories).map(([group, keys]) => {
      const points = sum(keys.map(key => Math.max(0, Number(foundry.utils.getProperty(actor, `system.attributes.${group}.${key}`) || 0) - 1)));
      return { group, label: game.i18n.localize(`VTM_REVISED.AttributeGroup.${group}`), points };
    });
    const attributeSorted = attributeTotalsByGroup.map(row => row.points).sort((a, b) => b - a);
    const attributeTargets = [7, 5, 3];
    const attributeOver = attributeSorted.some((value, index) => value > attributeTargets[index]);
    const attributeOk = attributeSorted.every((value, index) => value === attributeTargets[index]);
    const attributeExcess = sum(attributeSorted.map((value, index) => Math.max(0, value - attributeTargets[index])));

    const abilityTotalsByGroup = Object.entries(VTM_REVISED.abilityCategories).map(([group, keys]) => {
      const points = sum(keys.map(key => Number(foundry.utils.getProperty(actor, `system.abilities.${group}.${key}.value`) || 0)));
      return { group, label: game.i18n.localize(`VTM_REVISED.AbilityGroup.${group}`), points };
    });
    const abilitySorted = abilityTotalsByGroup.map(row => row.points).sort((a, b) => b - a);
    const abilityTargets = [13, 9, 5];
    const abilityOver = abilitySorted.some((value, index) => value > abilityTargets[index]);
    const abilityOk = abilitySorted.every((value, index) => value === abilityTargets[index]);
    const abilityExcess = sum(abilitySorted.map((value, index) => Math.max(0, value - abilityTargets[index])));

    const abilityOverThree = [];
    for (const [group, keys] of Object.entries(VTM_REVISED.abilityCategories)) {
      for (const key of keys) {
        const value = Number(foundry.utils.getProperty(actor, `system.abilities.${group}.${key}.value`) || 0);
        if (value > 3) abilityOverThree.push(`${game.i18n.localize(`VTM_REVISED.Ability.${key}`)} ${value}`);
      }
    }

    const items = Array.from(actor.items ?? []);
    const disciplineTotal = sum(items.filter(item => item.type === "discipline").map(item => Number(item.system?.rating || 0)));
    const backgroundTotal = sum(items.filter(item => item.type === "background").map(item => Number(item.system?.rating || 0)));
    const virtueRaw = {
      conscience: Number(system.virtues?.conscience || 0),
      selfControl: Number(system.virtues?.selfControl || 0),
      courage: Number(system.virtues?.courage || 0)
    };
    const virtueCreationTotal = Math.max(0, virtueRaw.conscience - 1) + Math.max(0, virtueRaw.selfControl - 1) + Math.max(0, virtueRaw.courage - 1);
    const humanityExpected = virtueRaw.conscience + virtueRaw.selfControl;
    const humanityActual = Number(system.resources?.humanity?.value || 0);
    const willpowerExpected = virtueRaw.courage;
    const willpowerActual = Number(system.resources?.willpower?.max || system.resources?.willpower?.value || 0);
    const bloodActual = Number(system.resources?.blood?.value || 0);

    const meritPoints = sum(items.filter(item => item.type === "merit").map(item => Number(item.system?.points || 0)));
    const flawPoints = sum(items.filter(item => item.type === "flaw").map(item => Number(item.system?.points || 0)));

    const disciplineExcess = Math.max(0, disciplineTotal - 3);
    const backgroundExcess = Math.max(0, backgroundTotal - 5);
    const virtueExcess = Math.max(0, virtueCreationTotal - 7);
    const humanityExcess = Math.max(0, humanityActual - humanityExpected);
    const willpowerExcess = Math.max(0, willpowerActual - willpowerExpected);

    const freebiePool = Number(system.creation?.freebiePool ?? 15);
    const costs = {
      merits: meritPoints,
      flaws: flawPoints,
      attributes: attributeExcess * 5,
      abilities: abilityExcess * 2,
      disciplines: disciplineExcess * 7,
      backgrounds: backgroundExcess * 1,
      virtues: virtueExcess * 2,
      humanity: humanityExcess * 2,
      willpower: willpowerExcess * 1
    };
    const spent = costs.merits + costs.attributes + costs.abilities + costs.disciplines + costs.backgrounds + costs.virtues + costs.humanity + costs.willpower;
    const remaining = freebiePool + costs.flaws - spent;

    const formatSorted = values => values.join("/");
    const groupDetails = rows => rows.map(row => `${row.label}: ${row.points}`).join("; ");

    const baseRows = [
      makeRow({
        label: t("AttributesBase"),
        detail: game.i18n.format("VTM_REVISED.Creation.TargetFact", { target: "7/5/3", fact: formatSorted(attributeSorted) }) + ` (${groupDetails(attributeTotalsByGroup)})`,
        ok: attributeOk,
        warn: attributeOver,
        warning: attributeOver ? t("AttributesBaseWarn") : ""
      }),
      makeRow({
        label: t("AbilitiesBase"),
        detail: game.i18n.format("VTM_REVISED.Creation.TargetFact", { target: "13/9/5", fact: formatSorted(abilitySorted) }) + ` (${groupDetails(abilityTotalsByGroup)})`,
        ok: abilityOk,
        warn: abilityOver,
        warning: abilityOver ? t("AbilitiesBaseWarn") : ""
      }),
      makeRow({
        label: t("AbilityMaxThree"),
        detail: abilityOverThree.length ? abilityOverThree.join(", ") : t("NoViolations"),
        ok: !abilityOverThree.length,
        warn: Boolean(abilityOverThree.length),
        warning: abilityOverThree.length ? t("AbilityMaxThreeWarn") : ""
      }),
      makeRow({
        label: t("DisciplinesBase"),
        detail: game.i18n.format("VTM_REVISED.Creation.TargetFact", { target: 3, fact: disciplineTotal }),
        ok: disciplineTotal === 3,
        warn: disciplineTotal > 3,
        warning: disciplineTotal > 3 ? t("DisciplinesBaseWarn") : ""
      }),
      makeRow({
        label: t("BackgroundsBase"),
        detail: game.i18n.format("VTM_REVISED.Creation.TargetFact", { target: 5, fact: backgroundTotal }),
        ok: backgroundTotal === 5,
        warn: backgroundTotal > 5,
        warning: backgroundTotal > 5 ? t("BackgroundsBaseWarn") : ""
      }),
      makeRow({
        label: t("VirtuesBase"),
        detail: game.i18n.format("VTM_REVISED.Creation.TargetFact", { target: 7, fact: virtueCreationTotal }),
        ok: virtueCreationTotal === 7,
        warn: virtueCreationTotal > 7,
        warning: virtueCreationTotal > 7 ? t("VirtuesBaseWarn") : ""
      }),
      makeRow({
        label: t("HumanityFormula"),
        detail: game.i18n.format("VTM_REVISED.Creation.FormulaFact", { formula: `${virtueRaw.conscience} + ${virtueRaw.selfControl}`, fact: humanityActual, expected: humanityExpected }),
        ok: humanityActual === humanityExpected,
        warn: humanityActual !== humanityExpected,
        warning: humanityActual !== humanityExpected ? t("HumanityFormulaWarn") : ""
      }),
      makeRow({
        label: t("WillpowerFormula"),
        detail: game.i18n.format("VTM_REVISED.Creation.FormulaFact", { formula: `${virtueRaw.courage}`, fact: willpowerActual, expected: willpowerExpected }),
        ok: willpowerActual === willpowerExpected,
        warn: willpowerActual !== willpowerExpected,
        warning: willpowerActual !== willpowerExpected ? t("WillpowerFormulaWarn") : ""
      }),
      makeRow({
        label: t("BloodRoll"),
        detail: game.i18n.format("VTM_REVISED.Creation.BloodFact", { fact: bloodActual }),
        ok: bloodActual >= 1 && bloodActual <= 10,
        warn: bloodActual < 1 || bloodActual > 10,
        warning: t("BloodRollHint")
      })
    ];

    const freebieRow = (label, display, costDisplay, warning = "") => ({ label, display, costDisplay, warning });
    const freebieRows = [
      freebieRow(t("Merits"), `${meritPoints}`, `-${costs.merits}`, meritPoints ? "" : ""),
      freebieRow(t("Flaws"), `${flawPoints}`, `+${costs.flaws}`, flawPoints > 7 ? t("FlawLimitWarn") : ""),
      freebieRow(t("AttributesCost"), `${attributeExcess} Г— 5`, `-${costs.attributes}`),
      freebieRow(t("AbilitiesCost"), `${abilityExcess} Г— 2`, `-${costs.abilities}`),
      freebieRow(t("DisciplinesCost"), `${disciplineExcess} Г— 7`, `-${costs.disciplines}`),
      freebieRow(t("BackgroundsCost"), `${backgroundExcess} Г— 1`, `-${costs.backgrounds}`),
      freebieRow(t("VirtuesCost"), `${virtueExcess} Г— 2`, `-${costs.virtues}`),
      freebieRow(t("HumanityCost"), `${humanityExcess} Г— 2`, `-${costs.humanity}`),
      freebieRow(t("WillpowerCost"), `${willpowerExcess} Г— 1`, `-${costs.willpower}`)
    ];

    return {
      freebiePool,
      baseRows,
      freebie: {
        rows: freebieRows,
        spent,
        remaining,
        negative: remaining < 0,
        flawPoints,
        meritPoints
      }
    };
  }

  async _fixCreationHumanity() {
    const conscience = Number(this.actor.system?.virtues?.conscience || 0);
    const selfControl = Number(this.actor.system?.virtues?.selfControl || 0);
    const value = Math.max(0, Math.min(10, conscience + selfControl));
    await this.actor.update({
      "system.resources.humanity.value": value,
      "system.resources.humanity.max": 10
    });
    ui.notifications?.info?.(game.i18n.format("VTM_REVISED.Creation.HumanityFixed", { value }));
  }

  async _fixCreationWillpower() {
    const value = Math.max(0, Math.min(10, Number(this.actor.system?.virtues?.courage || 0)));
    await this.actor.update({
      "system.resources.willpower.value": value,
      "system.resources.willpower.max": value
    });
    ui.notifications?.info?.(game.i18n.format("VTM_REVISED.Creation.WillpowerFixed", { value }));
  }

  async _rollCreationBloodPool() {
    const roll = await (new Roll("1d10")).evaluate();
    const value = Number(roll.total || 1);
    const max = Number(this.actor.system?.resources?.blood?.max || this.actor.generationCaps?.bloodMax || 10);
    await this.actor.update({ "system.resources.blood.value": Math.min(value, max) });
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: game.i18n.format("VTM_REVISED.Creation.BloodRolled", { value })
    });
    ui.notifications?.info?.(game.i18n.format("VTM_REVISED.Creation.BloodFixed", { value: Math.min(value, max) }));
  }

  static async #onSubmitForm(event, form, formData) {
    if (!this.isEditable) return;
    await this.actor.update(formData.object);
  }

  _resolveHealthPenalty() {
    const health = this.actor?.system?.health ?? {};
    const activeKey = [...VTM_REVISED.healthLevels]
      .reverse()
      .find(key => Number(health[key] || 0) > 0);

    if (!activeKey) {
      return {
        key: "healthy",
        value: 0,
        label: game.i18n.localize("VTM_REVISED.HealthPenalty.none"),
        incapacitated: false
      };
    }

    const rawPenalty = VTM_REVISED.healthPenalties[activeKey] ?? 0;
    const label = game.i18n.localize(`VTM_REVISED.Health.${activeKey}`);

    if (rawPenalty === "out") {
      return {
        key: activeKey,
        value: 0,
        label,
        incapacitated: true
      };
    }

    return {
      key: activeKey,
      value: Number(rawPenalty || 0),
      label,
      incapacitated: false
    };
  }

  _buildRollTraitOptions() {
    const options = [];
    const push = (key, label, value, group) => options.push({
      key,
      label,
      value: Number(value || 0),
      group,
      display: `${label} (${Number(value || 0)})`
    });

    for (const [group, keys] of Object.entries(VTM_REVISED.attributeCategories)) {
      for (const key of keys) {
        const label = game.i18n.localize(`VTM_REVISED.Attribute.${key}`);
        const value = foundry.utils.getProperty(this.actor, `system.attributes.${group}.${key}`);
        push(`attribute.${group}.${key}`, label, value, game.i18n.localize(`VTM_REVISED.AttributeGroup.${group}`));
      }
    }

    for (const [group, keys] of Object.entries(VTM_REVISED.abilityCategories)) {
      for (const key of keys) {
        const label = game.i18n.localize(`VTM_REVISED.Ability.${key}`);
        const value = foundry.utils.getProperty(this.actor, `system.abilities.${group}.${key}.value`);
        push(`ability.${group}.${key}`, label, value, game.i18n.localize(`VTM_REVISED.AbilityGroup.${group}`));
      }
    }

    push("virtue.conscience", game.i18n.localize("VTM_REVISED.Virtue.Conscience"), this.actor.system?.virtues?.conscience, game.i18n.localize("VTM_REVISED.Section.Virtues"));
    push("virtue.selfControl", game.i18n.localize("VTM_REVISED.Virtue.SelfControl"), this.actor.system?.virtues?.selfControl, game.i18n.localize("VTM_REVISED.Section.Virtues"));
    push("virtue.courage", game.i18n.localize("VTM_REVISED.Virtue.Courage"), this.actor.system?.virtues?.courage, game.i18n.localize("VTM_REVISED.Section.Virtues"));
    push("resource.willpower", game.i18n.localize("VTM_REVISED.Resource.Willpower"), this.actor.system?.resources?.willpower?.value, game.i18n.localize("VTM_REVISED.Section.Resources"));
    push("resource.humanity", game.i18n.localize("VTM_REVISED.Resource.Humanity"), this.actor.system?.resources?.humanity?.value, game.i18n.localize("VTM_REVISED.Section.Resources"));

    return options;
  }

  _buildRollTraitOptionGroups() {
    const options = this._buildRollTraitOptions();
    const grouped = new Map();
    for (const option of options) {
      if (!grouped.has(option.group)) grouped.set(option.group, []);
      grouped.get(option.group).push(option);
    }

    return Array.from(grouped.entries()).map(([label, options]) => ({ label, options }));
  }

  _resolveTraitOption(key) {
    if (!key) return null;
    const [type, group, trait] = String(key).split(".");

    if (type === "attribute") {
      const value = Number(foundry.utils.getProperty(this.actor, `system.attributes.${group}.${trait}`) || 0);
      return {
        key,
        label: game.i18n.localize(`VTM_REVISED.Attribute.${trait}`),
        value
      };
    }

    if (type === "ability") {
      const value = Number(foundry.utils.getProperty(this.actor, `system.abilities.${group}.${trait}.value`) || 0);
      return {
        key,
        label: game.i18n.localize(`VTM_REVISED.Ability.${trait}`),
        value
      };
    }

    if (type === "virtue") {
      const field = group;
      const labelKey = field === "selfControl" ? "SelfControl" : field.charAt(0).toUpperCase() + field.slice(1);
      const value = Number(foundry.utils.getProperty(this.actor, `system.virtues.${field}`) || 0);
      return {
        key,
        label: game.i18n.localize(`VTM_REVISED.Virtue.${labelKey}`),
        value
      };
    }

    if (type === "resource") {
      const resource = group;
      const labelKey = resource === "willpower" ? "Willpower" : "Humanity";
      const value = Number(foundry.utils.getProperty(this.actor, `system.resources.${resource}.value`) || 0);
      return {
        key,
        label: game.i18n.localize(`VTM_REVISED.Resource.${labelKey}`),
        value
      };
    }

    return null;
  }

  _buildRollSelectHtml(name, selected = "", includeEmpty = false) {
    const options = this._buildRollTraitOptions();
    const grouped = new Map();
    for (const option of options) {
      if (!grouped.has(option.group)) grouped.set(option.group, []);
      grouped.get(option.group).push(option);
    }

    const empty = includeEmpty ? `<option value="">${game.i18n.localize("VTM_REVISED.Roll.NoSecondTrait")}</option>` : "";
    const body = Array.from(grouped.entries()).map(([group, entries]) => {
      const inner = entries.map(option => {
        const isSelected = option.key === selected ? " selected" : "";
        return `<option value="${foundry.utils.escapeHTML(option.key)}"${isSelected}>${foundry.utils.escapeHTML(option.display)}</option>`;
      }).join("");
      return `<optgroup label="${foundry.utils.escapeHTML(group)}">${inner}</optgroup>`;
    }).join("");

    return `<select name="${name}">${empty}${body}</select>`;
  }

  async _openRollDialog({ firstTrait = "", secondTrait = "", difficulty = 6, label = "" } = {}) {
    const content = `
      <form class="vtm-roll-dialog">
        <div class="form-group">
          <label>${game.i18n.localize("VTM_REVISED.Roll.FirstTrait")}</label>
          ${this._buildRollSelectHtml("firstTrait", firstTrait, false)}
        </div>
        <div class="form-group">
          <label>${game.i18n.localize("VTM_REVISED.Roll.SecondTrait")}</label>
          ${this._buildRollSelectHtml("secondTrait", secondTrait, true)}
        </div>
        <div class="form-group">
          <label>${game.i18n.localize("VTM_REVISED.Roll.Difficulty")}</label>
          <input type="number" name="difficulty" min="2" max="10" value="${Number(difficulty || 6)}"/>
        </div>
        <div class="form-group">
          <label>${game.i18n.localize("VTM_REVISED.Roll.Label")}</label>
          <input type="text" name="label" value="${foundry.utils.escapeHTML(label || game.i18n.localize("VTM_REVISED.Roll.Label"))}"/>
        </div>
      </form>`;

    return new Promise(resolve => {
      new DialogV1({
        title: game.i18n.localize("VTM_REVISED.Roll.DialogTitle"),
        content,
        buttons: {
          roll: {
            icon: '<i class="fas fa-dice-d10"></i>',
            label: game.i18n.localize("VTM_REVISED.Roll.RollButton"),
            callback: async html => {
              await this._rollFromForm(html);
              resolve(true);
            }
          },
          cancel: {
            label: game.i18n.localize("Cancel"),
            callback: () => resolve(false)
          }
        },
        default: "roll",
        close: () => resolve(false)
      }, { width: 460 }).render(true);
    });
  }

  _getFormElement(htmlOrElement) {
    if (htmlOrElement instanceof HTMLFormElement) return htmlOrElement;
    if (htmlOrElement instanceof HTMLElement) return htmlOrElement.querySelector("form") ?? htmlOrElement;
    if (htmlOrElement?.[0] instanceof HTMLElement) return htmlOrElement[0].querySelector("form") ?? htmlOrElement[0];
    if (htmlOrElement?.find) return htmlOrElement.find("form")?.[0] ?? htmlOrElement[0];
    return null;
  }

  async _rollFromForm(htmlOrElement) {
    const form = this._getFormElement(htmlOrElement);
    if (!form) return;

    const firstTraitKey = form.querySelector("[name='firstTrait'], [data-roll-field='firstTrait']")?.value ?? "";
    const secondTraitKey = form.querySelector("[name='secondTrait'], [data-roll-field='secondTrait']")?.value ?? "";
    const difficulty = Number(form.querySelector("[name='difficulty'], [data-roll-field='difficulty']")?.value || 6);
    const customLabel = form.querySelector("[name='label'], [data-roll-field='label']")?.value?.trim() ?? "";

    const first = this._resolveTraitOption(firstTraitKey);
    const second = this._resolveTraitOption(secondTraitKey);
    if (!first) {
      ui.notifications?.warn?.(game.i18n.localize("VTM_REVISED.Roll.NoTraitSelected"));
      return;
    }

    const components = [first, second].filter(Boolean);
    const basePool = Math.max(1, components.reduce((total, component) => total + Number(component.value || 0), 0));
    const healthPenalty = this._resolveHealthPenalty();

    if (healthPenalty.incapacitated) {
      ui.notifications?.warn?.(game.i18n.localize("VTM_REVISED.Roll.HealthBlocked"));
      return;
    }

    const label = customLabel || components.map(component => component.label).join(" + ");
    const pool = Math.max(1, basePool + healthPenalty.value);

    await rollDicePool({
      actor: this.actor,
      pool,
      basePool,
      healthPenalty: healthPenalty.value,
      healthPenaltyLabel: healthPenalty.label,
      difficulty,
      label,
      components
    });
  }


  async _useItemAutomation(item) {
    const auto = item.system?.automation ?? {};
    const roll = auto.roll ?? {};
    const cost = normalizeAutomationCost(auto.cost ?? {}, item);
    const hasRoll = Boolean(roll.firstTrait || roll.secondTrait);

    if (hasRoll) {
      const rolled = await this._openRollDialog({
        firstTrait: roll.firstTrait || "",
        secondTrait: roll.secondTrait || "",
        difficulty: Number(roll.difficulty || 6),
        label: roll.label || item.name
      });
      if (!rolled) return;
    }

    const appliedCost = await applyAutomationCost(this.actor, cost, item, { reason: cost.text || item.name });

    if (!hasRoll) {
      const renderTemplate = foundry.applications?.handlebars?.renderTemplate ?? globalThis.renderTemplate;
      const content = await renderTemplate("systems/vtm-revised/templates/chat/item-use-card.hbs", {
        actor: this.actor,
        item,
        cost: appliedCost,
        description: item.system?.description?.chat || item.system?.description?.system || item.system?.description?.value || ""
      });
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content,
        flags: { "vtm-revised": { type: "itemUse", actorId: this.actor.id, itemId: item.id } }
      });
    }
  }

  _resolveAutomationResource(resource) {
    if (!resource) return "";
    const key = String(resource).trim().toLowerCase();
    if (["blood", "bloodpool", "РєСЂРѕРІСЊ"].includes(key)) return "resources.blood";
    if (["willpower", "wp", "РІРѕР»СЏ", "СЃРёР»Р° РІРѕР»Рё"].includes(key)) return "resources.willpower";
    return "";
  }

  _resolveRollPool(dataset) {
    const direct = Number(dataset.pool || 0);
    if (direct > 0) return direct;

    const attrPath = dataset.attribute ? `system.attributes.${dataset.attribute}` : null;
    const abilityPath = dataset.ability ? `system.abilities.${dataset.ability}` : null;
    const attr = attrPath ? Number(foundry.utils.getProperty(this.actor, attrPath) || 0) : 0;
    const ability = abilityPath ? Number(foundry.utils.getProperty(this.actor, `${abilityPath}.value`) || 0) : 0;
    return Math.max(1, attr + ability);
  }
}

