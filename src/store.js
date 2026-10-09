// On-device storage: user, lock, profile, trusted people, limits, saved shops and payment history.
// Nothing leaves the phone.

import { START_PROFILE, normaliseProfile } from './profile.js';
import { sameVpa } from './safety.js';

const KEY = 'sahaaya.v3';

const fresh = () => ({
  setupDone: false,
  user: { name: '', phone: '', helper: false },
  lock: { type: 'none', credId: null, codeHash: null, salt: null },
  profile: { ...START_PROFILE },
  trusted: [],                                  // { name, phone, relation }
  limits: { perPayment: 2000, daily: 5000 },
  savedShops: [],                               // { name, vpa, usualAmount }
  history: [],                                  // { name, vpa, amount, status, at }
  largeLimit: 2000,
  reportsSent: {},                              // { '2026-09': timestamp }
});

let memory = null;

function read() {
  try {
    const raw = globalThis.localStorage?.getItem(KEY) ?? memory;
    if (!raw) return fresh();
    const s = JSON.parse(raw);
    const f = fresh();
    return { ...f, ...s, user: { ...f.user, ...s.user }, lock: { ...f.lock, ...s.lock }, limits: { ...f.limits, ...s.limits }, profile: normaliseProfile(s.profile) };
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

export function addTrusted({ name, phone, relation }) {
  if (!name || !phone) return state;
  return update({ trusted: [...state.trusted.filter((p) => p.phone !== phone), { name: name.trim(), phone: phone.trim(), relation: (relation || '').trim() }] });
}

export function removeTrusted(phone) {
  return update({ trusted: state.trusted.filter((p) => p.phone !== phone) });
}

export function addHistory({ name, vpa, amount, status }) {
  const history = [{ name, vpa, amount, status, at: Date.now() }, ...state.history].slice(0, 200);
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
