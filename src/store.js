// On-device storage: profile, saved shops and payment history. Nothing leaves the phone.

import { START_PROFILE, normaliseProfile } from './profile.js';
import { sameVpa } from './safety.js';

const KEY = 'sahaaya.v2';

const fresh = () => ({
  setupDone: false,
  profile: { ...START_PROFILE },
  savedShops: [], // { name, vpa, usualAmount }
  history: [],    // { name, vpa, amount, status, at }
  largeLimit: 2000,
});

let memory = null;

function read() {
  try {
    const raw = globalThis.localStorage?.getItem(KEY) ?? memory;
    if (!raw) return fresh();
    const s = JSON.parse(raw);
    return { ...fresh(), ...s, profile: normaliseProfile(s.profile) };
  } catch {
    return fresh();
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

/** Save a regular shop's account. Re-saving the same account renames it. */
export function saveShop({ name, vpa, usualAmount = null }) {
  const clean = (name || '').trim();
  if (!clean || !vpa) return state;
  const prev = state.savedShops.find((s) => sameVpa(s.vpa, vpa));
  const rest = state.savedShops.filter((s) => !sameVpa(s.vpa, vpa));
  return update({ savedShops: [...rest, { name: clean, vpa, usualAmount: usualAmount ?? prev?.usualAmount ?? null }] });
}

export function removeShop(vpa) {
  return update({ savedShops: state.savedShops.filter((s) => !sameVpa(s.vpa, vpa)) });
}

export function addHistory({ name, vpa, amount, status }) {
  const history = [{ name, vpa, amount, status, at: Date.now() }, ...state.history].slice(0, 100);
  const recent = history.filter((h) => sameVpa(h.vpa, vpa)).slice(0, 5).map((h) => h.amount).sort((x, y) => x - y);
  const median = recent[Math.floor(recent.length / 2)];
  const savedShops = state.savedShops.map((s) => (sameVpa(s.vpa, vpa) ? { ...s, usualAmount: median } : s));
  return update({ history, savedShops });
}

export function reset() {
  state = fresh();
  write();
  return state;
}
