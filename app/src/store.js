// État de l'utilisateur : progression, réglages, pièges, historique.
// Sauvegarde locale (localStorage) + synchronisation optionnelle (voir sync.js).
import { review, newCard, DAY } from "./fsrs.js";

export const KEY = "praxis.v2";
const KEY_V1 = "praxis.v1";
const JOURNAL_MAX = 3000;

export const DEFAULT_SETTINGS = {
  retention: 0.9,
  sessionMin: 20,
  newPerSession: 8,
  tracks: { python: true, cpp: true, inge: true },
  interleave: true,
  theme: "auto",
  reveal: "progressif",
  cppRunner: "off",
  showKeys: true,
  prenom: "",
};

export function today(t = Date.now()) {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function defaultState() {
  return {
    v: 2,
    created: Date.now(),
    updated: 0,
    settingsAt: 0,
    settings: structuredClone(DEFAULT_SETTINGS),
    cards: {},
    lessons: {},
    traps: {},
    journal: [],
    days: {},
    streak: { cur: 0, best: 0, last: null },
    labs: {},
    defis: {},
    flags: {},
  };
}

function safeGet(k) {
  try { return localStorage.getItem(k); } catch { return null; }
}
function safeSet(k, v) {
  try { localStorage.setItem(k, v); return true; } catch { return false; }
}

const V1_STATE = { new: 0, learning: 1, review: 2, relearning: 3 };

// Convertit une sauvegarde Praxis v1 (clé praxis.v1 ou fichier exporté) vers le format v2.
export function migrateV1(o) {
  const s = defaultState();
  if (!o || typeof o !== "object") return s;
  s.created = o.cree || Date.now();
  const r = o.reglages || {};
  s.settings.retention = r.retention ?? s.settings.retention;
  s.settings.sessionMin = r.dureeSession ?? s.settings.sessionMin;
  s.settings.newPerSession = r.nouveauxParSession ?? s.settings.newPerSession;
  s.settings.interleave = r.entrelacer ?? true;
  s.settings.theme = r.theme || "auto";
  if (Array.isArray(r.langues)) {
    s.settings.tracks.python = r.langues.includes("python");
    s.settings.tracks.cpp = r.langues.includes("cpp");
  }
  for (const [id, c] of Object.entries(o.cartes || {})) {
    s.cards[id] = {
      s: c.s || 0, d: c.d || 0, due: c.due || 0, last: c.last || 0, reps: c.reps || 0, lapses: c.lapses || 0,
      st: V1_STATE[c.state] ?? 0, ok: c.ok || 0, ko: c.ko || 0, ms: c.msTotal || 0,
    };
  }
  s.journal = (o.journal || []).map((j) => [j.t, j.id, j.note, j.ms || 0, 0]);
  s.days = {};
  for (const [d, v] of Object.entries(o.jours || {})) s.days[d] = { n: v.n || 0, ok: v.ok || 0, ms: v.ms || 0, l: 0 };
  if (o.serie) s.streak = { cur: o.serie.courant || 0, best: o.serie.record || 0, last: o.serie.dernier || null };
  for (const id of o.defisFaits || []) s.labs[id] = Date.now();   // les défis v1 sont devenus des labs (mêmes ids d1…d6)
  s.flags.migratedFromV1 = Date.now();
  s.updated = Date.now();
  return s;
}

function normalize(o) {
  const s = { ...defaultState(), ...o };
  s.settings = { ...structuredClone(DEFAULT_SETTINGS), ...(o.settings || {}) };
  s.settings.tracks = { ...DEFAULT_SETTINGS.tracks, ...((o.settings || {}).tracks || {}) };
  for (const k of ["cards", "lessons", "traps", "days", "labs", "defis", "flags"]) s[k] = { ...(o[k] || {}) };
  s.journal = Array.isArray(o.journal) ? o.journal.slice(-JOURNAL_MAX) : [];
  s.streak = { cur: 0, best: 0, last: null, ...(o.streak || {}) };
  return s;
}

function loadInitial() {
  const raw = safeGet(KEY);
  if (raw) {
    try { return normalize(JSON.parse(raw)); } catch { /* sauvegarde illisible : on repart proprement */ }
  }
  const v1 = safeGet(KEY_V1);
  if (v1) {
    try { return migrateV1(JSON.parse(v1)); } catch { /* ignore */ }
  }
  return defaultState();
}

let state = loadInitial();
const listeners = new Set();
let saveTimer = null;
let changeHook = null;

export const getState = () => state;
export const settings = () => state.settings;

export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function setChangeHook(fn) { changeHook = fn; }

function persistSoon(parts) {
  state.updated = Date.now();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => safeSet(KEY, JSON.stringify(state)), 150);
  if (changeHook) changeHook(parts);
  for (const fn of listeners) fn(state);
}

export function persistNow() {
  clearTimeout(saveTimer);
  safeSet(KEY, JSON.stringify(state));
}

export function update(fn, parts = ["meta"]) {
  fn(state);
  persistSoon(parts);
  return state;
}

export function replaceState(next) {
  state = normalize(next);
  persistSoon(["cards", "meta", "journal"]);
}

export function setSettings(patch) {
  update((s) => {
    Object.assign(s.settings, patch);
    s.settings.retention = Math.min(0.97, Math.max(0.75, +s.settings.retention || 0.9));
    s.settings.sessionMin = Math.min(120, Math.max(5, Math.round(+s.settings.sessionMin || 20)));
    s.settings.newPerSession = Math.min(40, Math.max(0, Math.round(+s.settings.newPerSession || 0)));
    s.settingsAt = Date.now();
  });
}

export const card = (id) => state.cards[id] || null;

function bumpDay(s, fn) {
  const d = today();
  const day = (s.days[d] ||= { n: 0, ok: 0, ms: 0, l: 0 });
  fn(day);
  if (s.streak.last !== d) {
    const y = today(Date.now() - DAY);
    s.streak.cur = s.streak.last === y ? s.streak.cur + 1 : 1;
    s.streak.last = d;
    s.streak.best = Math.max(s.streak.best || 0, s.streak.cur);
  }
}

// Enregistre une réponse : FSRS + stats du jour + journal + pièges.
// info : { correct, ms, trap (id du piège de l'exercice), hint }
export function recordAnswer(exId, grade, info = {}) {
  let result;
  update((s) => {
    const prev = s.cards[exId] || newCard();
    const r = review(prev, grade, { retention: s.settings.retention });
    const c = r.card;
    c.ok = (prev.ok || 0) + (grade >= 2 ? 1 : 0);
    c.ko = (prev.ko || 0) + (grade === 1 ? 1 : 0);
    c.ms = (prev.ms || 0) + (info.ms || 0);
    s.cards[exId] = c;
    result = r;
    s.journal.push([Date.now(), exId, grade, info.ms || 0, (info.hint ? 1 : 0) | (info.trap ? 2 : 0)]);
    if (s.journal.length > JOURNAL_MAX) s.journal.splice(0, s.journal.length - JOURNAL_MAX);
    bumpDay(s, (d) => { d.n += 1; d.ok += grade >= 2 ? 1 : 0; d.ms += info.ms || 0; });
    if (info.trap) {
      const t = (s.traps[info.trap] ||= { fell: 0, avoided: 0, run: 0, last: 0, lastFell: 0 });
      t.last = Date.now();
      if (grade === 1) { t.fell += 1; t.run = 0; t.lastFell = Date.now(); } else { t.avoided += 1; t.run += 1; }
    }
  }, ["cards", "meta", "journal"]);
  return result;
}

export function markLesson(modId, patch) {
  update((s) => {
    const l = (s.lessons[modId] ||= { read: 0, step: 1 });
    const wasRead = !!l.read;
    Object.assign(l, patch);
    if (patch.read && !wasRead) bumpDay(s, (d) => { d.l = (d.l || 0) + 1; });
  });
}

export function trapStatus(id) {
  const t = state.traps[id];
  if (!t || (!t.fell && !t.avoided)) return "neuf";
  if (t.run >= 2) return "deja";
  if (t.fell && t.run === 0) return "tombe";
  return "progres";
}

export function exportJSON() {
  return JSON.stringify({ app: "praxis", ...state, exportedAt: new Date().toISOString() }, null, 1);
}

// Fusionne une autre sauvegarde (autre appareil, fichier importé) dans l'état courant.
export function mergeState(base, other) {
  const a = normalize(base);
  const b = other.v === 2 ? normalize(other) : migrateV1(other);
  for (const [id, cb] of Object.entries(b.cards)) {
    const ca = a.cards[id];
    if (!ca || (cb.last || 0) > (ca.last || 0)) a.cards[id] = cb;
  }
  for (const [id, lb] of Object.entries(b.lessons)) {
    const la = a.lessons[id];
    if (!la) a.lessons[id] = lb;
    else {
      la.read = la.read && lb.read ? Math.min(la.read, lb.read) : la.read || lb.read || 0;
      la.step = Math.max(la.step || 1, lb.step || 1);
    }
  }
  for (const [id, tb] of Object.entries(b.traps)) {
    const ta = a.traps[id];
    if (!ta) a.traps[id] = tb;
    else if ((tb.last || 0) > (ta.last || 0)) a.traps[id] = { ...tb, fell: Math.max(ta.fell, tb.fell), avoided: Math.max(ta.avoided, tb.avoided) };
  }
  for (const [d, vb] of Object.entries(b.days)) {
    const va = a.days[d];
    a.days[d] = va ? { n: Math.max(va.n, vb.n), ok: Math.max(va.ok, vb.ok), ms: Math.max(va.ms, vb.ms), l: Math.max(va.l || 0, vb.l || 0) } : vb;
  }
  const seen = new Set(a.journal.map((j) => j[0] + j[1]));
  for (const j of b.journal) if (!seen.has(j[0] + j[1])) a.journal.push(j);
  a.journal.sort((x, y) => x[0] - y[0]);
  a.journal = a.journal.slice(-JOURNAL_MAX);
  for (const k of ["labs", "defis", "flags"]) a[k] = { ...b[k], ...a[k] };
  if ((b.settingsAt || 0) > (a.settingsAt || 0)) { a.settings = b.settings; a.settingsAt = b.settingsAt; }
  const sa = a.streak, sb = b.streak;
  if ((sb.last || "") > (sa.last || "")) a.streak = { ...sb, best: Math.max(sa.best || 0, sb.best || 0) };
  else a.streak.best = Math.max(sa.best || 0, sb.best || 0);
  a.created = Math.min(a.created || Date.now(), b.created || Date.now());
  return a;
}

export function importJSON(text) {
  const o = JSON.parse(text);
  if (!o || typeof o !== "object" || (!o.cards && !o.cartes)) throw new Error("ce fichier ne contient pas de progression Praxis");
  replaceState(mergeState(state, o));
}

export function resetAll() {
  state = defaultState();
  persistSoon(["cards", "meta", "journal"]);
}
