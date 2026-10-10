// "Find what feels comfortable": a short, optional try-out. It suggests settings from what the person
// chooses and how the sample buttons went. It never diagnoses anything, never says pass or fail, and
// keeps nothing but the settings the person confirms at the end.

/** Settings this activity can suggest, mapped onto the existing profile. */
export const COMFORT_KEYS = ['textScale', 'contrast', 'bigTargets', 'tremorSafe', 'simple', 'voice', 'silent', 'sounds', 'haptics', 'visualAlerts'];

/**
 * @param {object} a answers; any can be missing (skipped):
 *   button: 'normal'|'large'|'xlarge', text: 1|1.3|1.6, contrast: bool, guidance: 'visual'|'spoken'|'both',
 *   alerts: string[] of 'sound'|'vibration'|'visual', misses: number (sample keypad), simple: bool
 * @param {object} base the current profile (kept for anything skipped)
 * @returns {object} suggested values for COMFORT_KEYS only
 */
export function suggestFromComfort(a = {}, base = {}) {
  const out = {};
  for (const k of COMFORT_KEYS) out[k] = base[k];
  if (a.button) out.bigTargets = a.button !== 'normal';
  if (a.text) out.textScale = a.text;
  if (typeof a.contrast === 'boolean') out.contrast = a.contrast;
  if (a.guidance === 'visual') Object.assign(out, { voice: false, silent: true });
  if (a.guidance === 'spoken' || a.guidance === 'both') Object.assign(out, { voice: true, silent: false });
  if (Array.isArray(a.alerts)) {
    out.sounds = a.alerts.includes('sound');
    out.haptics = a.alerts.includes('vibration');
    out.visualAlerts = a.alerts.includes('visual');
  }
  // Several missed taps on the sample keypad: offer (not impose) the steadier controls.
  if (typeof a.misses === 'number' && a.misses >= 2) Object.assign(out, { bigTargets: true, tremorSafe: true });
  if (typeof a.simple === 'boolean') out.simple = a.simple;
  return out;
}

/** Only the settings that would actually change, for the summary screen. */
export function changesFrom(suggested, base) {
  return COMFORT_KEYS.filter((k) => suggested[k] !== undefined && suggested[k] !== base[k]);
}
