export async function rollDicePool({
  actor = null,
  pool = 1,
  basePool = null,
  healthPenalty = 0,
  healthPenaltyLabel = "",
  difficulty = 6,
  label = "Roll",
  flavor = "",
  components = []
} = {}) {
  const safePool = Math.max(1, Number(pool || 1));
  const safeBasePool = Math.max(1, Number(basePool ?? safePool));
  const safeHealthPenalty = Number(healthPenalty || 0);
  const safeDifficulty = Math.max(2, Math.min(10, Number(difficulty || 6)));
  const roll = await new Roll(`${safePool}d10`).evaluate({ async: true });
  const dice = roll.dice?.[0]?.results?.map(result => result.result) ?? [];

  const tens = dice.filter(value => value === 10).length;
  const normalSuccesses = dice.filter(value => value >= safeDifficulty && value < 10).length;
  const ones = dice.filter(value => value === 1).length;

  // VtM Revised house rule for this system:
  // - 10 counts as 2 successes.
  // - Every 1 subtracts 1 success.
  // - Final successes cannot go below 0.
  const rawSuccesses = normalSuccesses + (tens * 2);
  const successes = Math.max(0, rawSuccesses - ones);
  const botch = rawSuccesses === 0 && ones > 0;

  const content = await renderTemplate("systems/vtm-revised/templates/chat/roll-card.hbs", {
    actor,
    label,
    flavor,
    pool: safePool,
    basePool: safeBasePool,
    healthPenalty: safeHealthPenalty,
    healthPenaltyLabel,
    difficulty: safeDifficulty,
    dice,
    tens,
    normalSuccesses,
    rawSuccesses,
    ones,
    successes,
    botch,
    components
  });

  await roll.toMessage({
    speaker: actor ? ChatMessage.getSpeaker({ actor }) : ChatMessage.getSpeaker(),
    flavor: label,
    content,
    flags: {
      "vtm-revised": {
        type: "dicePool",
        pool: safePool,
        basePool: safeBasePool,
        healthPenalty: safeHealthPenalty,
        healthPenaltyLabel,
        difficulty: safeDifficulty,
        dice,
        tens,
        normalSuccesses,
        rawSuccesses,
        ones,
        successes,
        botch,
        components
      }
    }
  });

  return {
    roll,
    dice,
    tens,
    normalSuccesses,
    rawSuccesses,
    ones,
    successes,
    botch,
    pool: safePool,
    basePool: safeBasePool,
    healthPenalty: safeHealthPenalty,
    components
  };
}
