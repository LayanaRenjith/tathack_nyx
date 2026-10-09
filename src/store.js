// Local storage for settings, saved shops and payment history.
// Everything stays on the phone. Wrapped in try/catch: private mode can block storage.

const KEY = 'safescan.v1';

const DEFAULTS = {
  onboarded: false,
  mode: 'standard',   // standard | blind | elderly | tremor | deaf
  lang: 'ml',         // ml | en
  largeLimit: 2000,
  savedPayees: [],    // { vpa, name, usualAmount }
  history: [],        // { vpa, name, amount, at }
};

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

let state = read();

function write() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage unavailable */ }
}

export function get() { return state; }

export function update(patch) {
  state = { ...state, ...patch };
  write();
  return state;
}

export function savePayee({ vpa, name, amount }) {
  const rest = state.savedPayees.filter((p) => p.vpa.toLowerCase() !== vpa.toLowerCase());
  const prev = state.savedPayees.find((p) => p.vpa.toLowerCase() === vpa.toLowerCase());
  const usualAmount = amount || prev?.usualAmount || null;
  return update({ savedPayees: [{ vpa, name, usualAmount }, ...rest].slice(0, 30) });
}

export function addHistory({ vpa, name, amount }) {
  const history = [{ vpa, name, amount, at: Date.now() }, ...state.history].slice(0, 100);
  // Keep a running "usual amount" for saved payees (median of the last 5 payments).
  const recent = history.filter((h) => h.vpa === vpa).slice(0, 5).map((h) => h.amount).sort((a, b) => a - b);
  const median = recent[Math.floor(recent.length / 2)];
  const savedPayees = state.savedPayees.map((p) => (p.vpa === vpa ? { ...p, usualAmount: median } : p));
  return update({ history, savedPayees });
}

export function reset() {
  state = { ...DEFAULTS };
  write();
}
