const WORD_NUMBERS = new Map([
  ["ноль", 0], ["один", 1], ["одна", 1], ["одно", 1], ["одну", 1],
  ["два", 2], ["две", 2], ["три", 3], ["четыре", 4], ["пять", 5],
  ["шесть", 6], ["семь", 7], ["восемь", 8], ["девять", 9], ["десять", 10],
  ["one", 1], ["two", 2], ["three", 3], ["four", 4], ["five", 5],
  ["six", 6], ["seven", 7], ["eight", 8], ["nine", 9], ["ten", 10]
]);

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function stripHtml(value = "") {
  const div = globalThis.document?.createElement?.("div");
  if (div) {
    div.innerHTML = String(value ?? "");
    return div.textContent || div.innerText || "";
  }
  return String(value ?? "").replace(/<[^>]+>/g, " ");
}

function firstNonEmpty(...values) {
  return values.find(value => String(value ?? "").trim().length > 0) ?? "";
}

function normalizeResourceKey(resource = "") {
  const key = String(resource ?? "").trim().toLowerCase();
  if (["blood", "bloodpool", "blood_pool", "vitae", "витэ", "кровь", "крови", "пункт крови", "пункты крови"].includes(key)) return "blood";
  if (["willpower", "will_power", "wp", "воля", "сила воли", "силы воли", "временная сила воли"].includes(key)) return "willpower";
  return "";
}

function parseNumberish(value) {
  if (value == null) return NaN;
  const raw = String(value).trim().toLowerCase();
  if (!raw) return NaN;
  if (WORD_NUMBERS.has(raw)) return WORD_NUMBERS.get(raw);
  const digit = raw.match(/\d+/);
  if (digit) return Number(digit[0]);
  return NaN;
}

function parseAmountNear(text, resourcePatterns) {
  const source = stripHtml(text).toLowerCase().replaceAll("ё", "е");
  if (!source.trim()) return 0;

  const numberToken = "(?:\\d+|ноль|один|одна|одно|одну|два|две|три|четыре|пять|шесть|семь|восемь|девять|десять|one|two|three|four|five|six|seven|eight|nine|ten)";
  for (const pattern of resourcePatterns) {
    const before = new RegExp(`(${numberToken})[^.!?;:,\\n]{0,45}(?:${pattern})`, "iu");
    const after = new RegExp(`(?:${pattern})[^.!?;:,\\n]{0,45}(${numberToken})`, "iu");
    const beforeMatch = source.match(before);
    if (beforeMatch) return Math.max(0, safeNumber(parseNumberish(beforeMatch[1]), 0));
    const afterMatch = source.match(after);
    if (afterMatch) return Math.max(0, safeNumber(parseNumberish(afterMatch[1]), 0));
  }
  return 0;
}

export function normalizeAutomationCost(cost = {}, item = null) {
  const itemCost = item?.system?.automation?.cost ?? {};
  const merged = {
    ...itemCost,
    ...cost,
    text: firstNonEmpty(cost?.text, itemCost?.text, item?.system?.cost, item?.system?.mechanics?.activation)
  };

  let blood = safeNumber(merged.blood, 0);
  let willpower = safeNumber(merged.willpower, 0);
  const resource = normalizeResourceKey(merged.resource);
  const amount = safeNumber(merged.amount, 0);

  if (blood <= 0 && willpower <= 0 && resource && amount > 0) {
    if (resource === "blood") blood = amount;
    if (resource === "willpower") willpower = amount;
  }

  const text = String(merged.text ?? "").trim();
  if (blood <= 0) {
    blood = parseAmountNear(text, [
      "пункт(?:а|ов)?\\s+крови",
      "пункт(?:а|ов)?\\s+витэ",
      "крови",
      "витэ",
      "blood point(?:s)?",
      "blood"
    ]);
  }
  if (willpower <= 0) {
    willpower = parseAmountNear(text, [
      "пункт(?:а|ов)?\\s+(?:силы\\s+воли|воли)",
      "времен(?:ной|ную|ная|ные)?\\s+сил(?:ы|у|а)\\s+воли",
      "сил(?:ы|у|а)\\s+воли",
      "willpower point(?:s)?",
      "willpower"
    ]);
  }

  const parts = [];
  if (blood > 0) parts.push(`${blood} пункт${blood === 1 ? "" : "а"} крови`);
  if (willpower > 0) parts.push(`${willpower} пункт${willpower === 1 ? "" : "а"} Силы Воли`);

  return {
    ...merged,
    resource: resource || merged.resource || "",
    amount,
    blood,
    willpower,
    text: firstNonEmpty(text, parts.join(" + ")),
    hasCost: blood > 0 || willpower > 0
  };
}

export async function applyAutomationCost(actor, cost = {}, item = null, { reason = "" } = {}) {
  const normalized = normalizeAutomationCost(cost, item);
  const spendReason = reason || normalized.text || item?.name || "Автоматизация";
  const applied = [];

  if (normalized.blood > 0) {
    const current = Number(actor?.system?.resources?.blood?.value ?? 0);
    if (current < normalized.blood) {
      ui.notifications?.warn?.(`${actor.name}: крови меньше стоимости «${item?.name ?? spendReason}» (${current}/${normalized.blood}). Система спишет доступное значение до 0.`);
    }
    await actor.changeResource("resources.blood", -normalized.blood, spendReason);
    applied.push({ resource: "blood", amount: normalized.blood });
  }

  if (normalized.willpower > 0) {
    const current = Number(actor?.system?.resources?.willpower?.value ?? 0);
    if (current < normalized.willpower) {
      ui.notifications?.warn?.(`${actor.name}: Воли меньше стоимости «${item?.name ?? spendReason}» (${current}/${normalized.willpower}). Система спишет доступное значение до 0.`);
    }
    await actor.changeResource("resources.willpower", -normalized.willpower, spendReason);
    applied.push({ resource: "willpower", amount: normalized.willpower });
  }

  return { ...normalized, applied };
}
