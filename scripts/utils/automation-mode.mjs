export const AUTOMATION_MODES = Object.freeze({
  PROMPT: "prompt",
  GUIDED: "guided",
  AUTOMATIC: "automatic"
});

export function getAutomationMode() {
  try {
    return game.settings.get("vtm-revised", "automationMode") || AUTOMATION_MODES.GUIDED;
  } catch (_error) {
    return AUTOMATION_MODES.GUIDED;
  }
}

export function shouldPreselectAutomationEffect(effect = {}) {
  const mode = getAutomationMode();
  if (mode === AUTOMATION_MODES.AUTOMATIC) return true;
  if (mode === AUTOMATION_MODES.GUIDED) return Boolean(effect.automatic);
  return false;
}
