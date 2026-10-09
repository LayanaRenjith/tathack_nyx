// On-device storage: profile, saved shops and payment history. Nothing leaves the phone.
// Wrapped in try/catch: private mode or blocked storage must not break the app.

import { DEFAULT_PROFILE, normaliseProfile } from './profile.js';

const KEY = 'sahaaya.v1';

const DEFAULTS = {
  setupDone: false,
  profile: DEFAULT_PROFILE,
  savedShops: [], // { name, vpa, usualAmount }
  history: [],    // { name, vpa, amount, status, at }
  largeLimit: 2000,
};

let memory = null; // fallback when localStorage is unavailable

function read() {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    const s = raw ? JSON.parse(raw) : (memory ? JSON.parse(memory) : {});
    return { ...DEFAULTS, ...s, profile: normaliseProfile(s.profile) };
  } catch {
    return { ...DEFAULTS, profile: normaliseProfile(null) };
  }
}

let state = read();

function write() {
  const json = JSON.stringify(state);
  try { globalThis.localStorage.setItem(KEY, json); } catch { memory = json; }
}

export function get() { return state; }

export function update(patch) {
  state = { ...state, ...patch };
  write();
  return state;
}

export function updateProfile(patch) {
  return update({ profile: normaliseProfile({ ...state.profile, ...patch }) });
}

const sameVpa = (a, b) => (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();

/** Save (or update) the trusted account for a shop. One account per shop name. */
export function saveShop({ name, vpa, usualAmount = null }) {
  const clean = (name || '').trim();
  if (!clean || !vpa) return state;
  const rest = state.savedShops.filter((s) => s.name.toLowerCase() !== clean.toLowerCase() && !sameVpa(s.vpa, vpa));
  const prev = state.savedShops.find((s) => s.name.toLowerCase() === clean.toLowerCase());
  return update({ savedShops: [{ name: clean, vpa, usualAmount: usualAmount ?? prev?.usualAmount ?? null }, ...rest].slice(0, 50) });
}

export function removeShop(vpa) {
  return update({ savedShops: state.savedShops.filter((s) => !sameVpa(s.vpa, vpa)) });
}

export function addHistory({ name, vpa, amount, status }) {
  const history = [{ name, vpa, amount, status, at: Date.now() }, ...state.history].slice(0, 100);
  // Keep a running "usual amount" for saved shops: median of the last 5 payments.
  const recent = history.filter((h) => sameVpa(h.vpa, vpa)).slice(0, 5).map((h) => h.amount).sort((x, y) => x - y);
  const median = recent[Math.floor(recent.length / 2)];
  const savedShops = state.savedShops.map((s) => (sameVpa(s.vpa, vpa) ? { ...s, usualAmount: median } : s));
  return update({ history, savedShops });
}

export function reset() {
  state = { ...DEFAULTS, profile: normaliseProfile(null) };
  write();
  return state;
}
