// Synchronisation entre appareils quand Praxis tourne comme page Claude (capabilities db + user),
// et enregistrement de fichiers (capability downloads, sinon lien de téléchargement classique).
import { getState, replaceState, mergeState, setChangeHook, defaultState } from "./store.js";

let db = null;
let uid = null;
let status = "local";
let statusFn = () => {};
const dirty = new Set();
let pushTimer = null;
let pushing = false;
let lastPull = 0;
let applyingRemote = false;

const round = (x, n = 4) => (typeof x === "number" ? Math.round(x * 10 ** n) / 10 ** n : x);

function encodeCards(cards) {
  const c = {};
  for (const [id, v] of Object.entries(cards)) c[id] = [round(v.s), round(v.d), v.due, v.last, v.reps, v.lapses, v.st, v.ok, v.ko, v.ms];
  return { c };
}
function decodeCards(o) {
  const cards = {};
  for (const [id, a] of Object.entries((o && o.c) || {})) {
    cards[id] = { s: a[0], d: a[1], due: a[2], last: a[3], reps: a[4], lapses: a[5], st: a[6], ok: a[7], ko: a[8], ms: a[9] };
  }
  return cards;
}
function encodeMeta(s) {
  return {
    v: 2, created: s.created, settings: s.settings, settingsAt: s.settingsAt || 0, lessons: s.lessons, traps: s.traps,
    days: s.days, streak: s.streak, labs: s.labs, defis: s.defis, flags: s.flags,
  };
}

const paths = () => ({
  cards: `data/users/${uid}/cards`,
  meta: `data/users/${uid}/meta`,
  journal: `data/users/${uid}/journal`,
});

function setStatus(s) {
  status = s;
  statusFn(s);
}
export const syncStatus = () => status;

export async function initSync(onStatus) {
  statusFn = onStatus || (() => {});
  const cl = typeof window !== "undefined" ? window.claude : null;
  if (!cl || typeof cl.use !== "function") return setStatus("local");
  try {
    const [d, u] = await Promise.all([cl.use("db"), cl.use("user")]);
    uid = u ? await u.id() : null;
    if (!d || !uid) return setStatus("local");
    db = d;
  } catch {
    return setStatus("local");
  }
  setChangeHook((parts) => {
    if (applyingRemote) return;
    for (const p of parts) dirty.add(p);
    schedulePush();
  });
  await pull(true);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
    else if (Date.now() - lastPull > 45_000) pull(false);
  });
}

async function pull(first) {
  if (!db) return;
  try {
    const p = paths();
    const [c, m, j] = await Promise.all([db.doc(p.cards).get(), db.doc(p.meta).get(), db.doc(p.journal).get()]);
    lastPull = Date.now();
    if (!c.exists && !m.exists && !j.exists) {
      // première synchro : on envoie tout
      ["cards", "meta", "journal"].forEach((k) => dirty.add(k));
      schedulePush(200);
      return setStatus("sync");
    }
    const remote = { ...defaultState(), ...(m.exists ? m.data() : {}), cards: c.exists ? decodeCards(c.data()) : {}, journal: j.exists ? (j.data().j || []) : [] };
    const merged = mergeState(getState(), remote);
    applyingRemote = true;
    replaceState(merged);
    applyingRemote = false;
    // si le local avait des choses en plus, on les renvoie
    ["cards", "meta", "journal"].forEach((k) => dirty.add(k));
    schedulePush(first ? 1500 : 4000);
    setStatus("sync");
  } catch (e) {
    applyingRemote = false;
    setStatus("error");
  }
}

function schedulePush(delay = 2500) {
  clearTimeout(pushTimer);
  pushTimer = setTimeout(flush, delay);
}

export async function flush() {
  if (!db || pushing || !dirty.size) return;
  pushing = true;
  const p = paths();
  const s = getState();
  try {
    for (const part of [...dirty]) {
      dirty.delete(part);
      let body;
      if (part === "cards") body = encodeCards(s.cards);
      else if (part === "meta") body = encodeMeta(s);
      else body = { j: s.journal.slice(-1500) };
      let size = JSON.stringify(body).length;
      if (part === "journal" && size > 240_000) body = { j: s.journal.slice(-600) };
      if (part === "meta" && size > 240_000) {
        const days = Object.keys(body.days).sort().slice(-400);
        body.days = Object.fromEntries(days.map((d) => [d, s.days[d]]));
        size = JSON.stringify(body).length;
      }
      await db.doc(p[part]).set(body);
    }
    setStatus("sync");
  } catch (e) {
    setStatus("error");
  } finally {
    pushing = false;
    if (dirty.size) schedulePush(5000);
  }
}

// ---------------------------------------------------------------- fichiers

export async function saveFile(filename, text) {
  const cl = typeof window !== "undefined" ? window.claude : null;
  if (cl && typeof cl.use === "function") {
    try {
      const dl = await cl.use("downloads");
      if (dl) {
        await dl.save({ filename, data: text });
        return "saved";
      }
    } catch (e) {
      if (e && e.code === "declined") return "declined";
    }
  }
  try {
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: filename });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return "saved";
  } catch {
    return "failed";
  }
}
