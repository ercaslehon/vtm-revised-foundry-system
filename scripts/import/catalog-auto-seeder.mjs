const SYSTEM_ID = "vtm-revised";
const AUTO_SEED_SETTING = "autoSeedCatalogs";
const SEED_VERSION_SETTING = "catalogSeedVersion";
const SEED_REPORT_SETTING = "catalogSeedLastReport";

let importerClass = null;
let registered = false;

function localize(key, fallback) {
  return game.i18n?.localize?.(key) || fallback;
}

function activePrimaryGm() {
  const activeGms = Array.from(game.users ?? [])
    .filter(user => user?.active && user?.isGM)
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  return activeGms[0] ?? null;
}

function currentSeedVersion() {
  return game.system?.version || CONFIG?.VTM_REVISED?.version || "unknown";
}

async function runImportStep(step, { notify = false } = {}) {
  const created = await step.run({ notify });
  return {
    key: step.key,
    label: step.label,
    count: Array.isArray(created) ? created.length : 0
  };
}

function catalogSteps() {
  if (!importerClass) return [];
  return [
    {
      key: "coreDisciplines",
      label: "Дисциплины",
      run: options => importerClass.importBuiltInCoreDisciplines(options)
    },
    {
      key: "bloodMagic",
      label: "Магия крови",
      run: options => importerClass.importBuiltInBloodMagicCatalog(options)
    },
    {
      key: "rituals",
      label: "Ритуалы",
      run: options => importerClass.importBuiltInRitualCatalog(options)
    },
    {
      key: "weapons",
      label: "Оружие",
      run: options => importerClass.importBuiltInWeaponCatalog(options)
    },
    {
      key: "clans",
      label: "Кланы и линии крови",
      run: options => importerClass.importBuiltInClanCatalog(options)
    },
    {
      key: "backgrounds",
      label: "Дополнения",
      run: options => importerClass.importBuiltInBackgroundCatalog(options)
    },
    {
      key: "meritsFlaws",
      label: "Достоинства и недостатки",
      run: options => importerClass.importBuiltInMeritsFlawsCatalog(options)
    },
    {
      key: "morality",
      label: "Пути и Дороги",
      run: options => importerClass.importBuiltInMoralityCatalog(options)
    }
  ];
}

export function registerCatalogAutoSeeder({ RulesJsonImporter } = {}) {
  if (registered) return;
  registered = true;
  importerClass = RulesJsonImporter;

  game.settings.register(SYSTEM_ID, AUTO_SEED_SETTING, {
    name: "VtM Revised: автоматически импортировать справочники",
    hint: "При первом запуске мира GM-ом автоматически создаёт встроенные справочники кланов, дисциплин, ритуалов, достоинств, дополнений, оружия и Путей/Дорог. Повторный запуск не создаёт дубли.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(SYSTEM_ID, SEED_VERSION_SETTING, {
    name: "VtM Revised: версия автоимпорта справочников",
    scope: "world",
    config: false,
    type: String,
    default: ""
  });

  game.settings.register(SYSTEM_ID, SEED_REPORT_SETTING, {
    name: "VtM Revised: последний отчёт автоимпорта справочников",
    scope: "world",
    config: false,
    type: Object,
    default: {}
  });

  Hooks.once("ready", () => {
    runCatalogAutoSeedIfNeeded().catch(err => {
      console.error("VtM Revised | Automatic catalog seed failed", err);
      ui.notifications?.error?.("VtM Revised | Не удалось автоматически импортировать справочники. Подробности в консоли.");
    });
  });
}

export async function runCatalogAutoSeedIfNeeded({ force = false, notify = true } = {}) {
  if (!importerClass) {
    console.warn("VtM Revised | Catalog auto seeder has no importer class.");
    return null;
  }

  if (!game.user?.isGM) return null;

  const primaryGm = activePrimaryGm();
  if (!force && primaryGm && primaryGm.id !== game.user.id) return null;

  const enabled = game.settings.get(SYSTEM_ID, AUTO_SEED_SETTING);
  if (!force && !enabled) return null;

  const seedVersion = currentSeedVersion();
  const alreadySeeded = game.settings.get(SYSTEM_ID, SEED_VERSION_SETTING);
  if (!force && alreadySeeded === seedVersion) return null;

  const steps = catalogSteps();
  if (!steps.length) return null;

  const startedAt = new Date().toISOString();
  console.log(`VtM Revised | Automatic catalog seed started for ${seedVersion}`);

  const results = [];
  for (const step of steps) {
    try {
      results.push(await runImportStep(step, { notify: false }));
    } catch (err) {
      console.error(`VtM Revised | Catalog seed step failed: ${step.key}`, err);
      results.push({ key: step.key, label: step.label, count: 0, error: String(err?.message ?? err) });
    }
  }

  const createdTotal = results.reduce((sum, result) => sum + Number(result.count || 0), 0);
  const failed = results.filter(result => result.error);
  const report = {
    version: seedVersion,
    startedAt,
    finishedAt: new Date().toISOString(),
    createdTotal,
    results
  };

  await game.settings.set(SYSTEM_ID, SEED_REPORT_SETTING, report);

  if (failed.length) {
    console.warn("VtM Revised | Automatic catalog seed finished with errors", report);
    if (notify) ui.notifications?.warn?.(`VtM Revised | Справочники импортированы частично: создано ${createdTotal}, ошибок ${failed.length}. Подробности в консоли.`);
    return report;
  }

  await game.settings.set(SYSTEM_ID, SEED_VERSION_SETTING, seedVersion);

  console.log("VtM Revised | Automatic catalog seed finished", report);
  if (notify && createdTotal > 0) {
    ui.notifications?.info?.(`VtM Revised | Встроенные справочники импортированы: создано ${createdTotal} записей.`);
  } else if (notify && force) {
    ui.notifications?.info?.("VtM Revised | Справочники уже были импортированы, новых записей не создано.");
  }

  return report;
}
