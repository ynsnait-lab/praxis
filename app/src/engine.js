// Construction des séances : révisions dues + nouveautés, entrelacées entre les pistes,
// avec priorité aux pièges dans lesquels tu es tombé récemment.
import { C, TRACKS, modOrder, isOpen, exercisesOf, trackOfEx } from "./content.js";
import { getState } from "./store.js";
import { isDue, retrievability } from "./fsrs.js";

const SEC_PER_CARD = 45;

function trackEnabled(tr) {
  const s = getState().settings;
  return s.tracks[tr] !== false;
}

function sortNew(ids) {
  return ids
    .map((id, i) => [id, i])
    .sort((a, b) => (C.ex[a[0]].level - C.ex[b[0]].level) || a[1] - b[1])
    .map((x) => x[0]);
}

// Candidats « nouveaux » d'une piste, dans l'ordre pédagogique
export function newCandidates(track) {
  const st = getState();
  const out = [];
  const pushFrom = (id) => {
    if (!isOpen(id)) return;
    for (const e of sortNew(exercisesOf(id))) if (!st.cards[e]) out.push(e);
  };
  if (track === "inge") {
    for (const g of C.tracks.inge.groups) {
      for (const m of g.modules) pushFrom(m);
      pushFrom(`quiz:${g.id}`);
    }
  } else {
    for (const m of modOrder(track)) pushFrom(m);
  }
  return out;
}

export function dueIds(now = Date.now()) {
  const st = getState();
  return Object.keys(st.cards).filter((id) => C.ex[id] && isDue(st.cards[id], now) && trackEnabled(trackOfEx(C.ex[id])));
}

function trapBoost(id) {
  const e = C.ex[id];
  if (!e || !e.piege) return 0;
  const t = getState().traps[e.piege];
  return t && t.fell && t.run === 0 ? 1 : 0;
}

export function summary() {
  const s = getState().settings;
  const due = dueIds();
  const perTrack = {};
  let newAvail = 0;
  for (const tr of TRACKS) {
    if (!trackEnabled(tr)) continue;
    const n = newCandidates(tr).length;
    perTrack[tr] = n;
    newAvail += n;
  }
  const maxCards = Math.max(6, Math.round((s.sessionMin * 60) / SEC_PER_CARD));
  const dueN = Math.min(due.length, maxCards);
  const newN = Math.min(newAvail, s.newPerSession, Math.max(0, maxCards - dueN));
  return { due: due.length, dueN, newN, newAvail, perTrack, minutes: Math.max(1, Math.round(((dueN + newN) * SEC_PER_CARD) / 60)) };
}

function interleave(lists) {
  const out = [];
  const q = lists.map((l) => [...l]);
  while (q.some((l) => l.length)) for (const l of q) if (l.length) out.push(l.shift());
  return out;
}

export function buildSession(scope = { type: "daily" }) {
  const st = getState();
  const s = st.settings;
  const now = Date.now();
  const maxCards = Math.max(6, Math.round((s.sessionMin * 60) / SEC_PER_CARD));
  const byR = (a, b) => retrievability(st.cards[a], now) - retrievability(st.cards[b], now);

  if (scope.type === "module" || scope.type === "quiz") {
    const ids = exercisesOf(scope.id);
    const unseen = sortNew(ids.filter((id) => !st.cards[id]));
    const due = ids.filter((id) => isDue(st.cards[id], now));
    const rest = ids.filter((id) => st.cards[id] && !isDue(st.cards[id], now)).sort(byR);
    return [...due, ...unseen, ...rest].slice(0, scope.all ? ids.length : Math.max(12, Math.min(ids.length, 20)));
  }
  if (scope.type === "one") return C.ex[scope.id] ? [scope.id] : [];
  if (scope.type === "trap") {
    const ids = Object.values(C.ex).filter((e) => e.piege === scope.id).map((e) => e.id);
    return ids.sort((a, b) => (st.cards[b]?.ko || 0) - (st.cards[a]?.ko || 0)).slice(0, 12);
  }
  if (scope.type === "weak") {
    const ids = Object.keys(st.cards).filter((id) => C.ex[id] && trackEnabled(trackOfEx(C.ex[id])));
    return ids.sort((a, b) => (st.cards[b].lapses - st.cards[a].lapses) || byR(a, b)).slice(0, 15);
  }
  if (scope.type === "track") {
    const due = dueIds(now).filter((id) => trackOfEx(C.ex[id]) === scope.id).sort((a, b) => st.cards[a].due - st.cards[b].due);
    const fresh = newCandidates(scope.id).slice(0, s.newPerSession);
    return [...due.slice(0, maxCards), ...fresh].slice(0, maxCards);
  }
  // séance du jour
  const due = dueIds(now).sort((a, b) => trapBoost(b) - trapBoost(a) || st.cards[a].due - st.cards[b].due).slice(0, maxCards);
  const room = Math.max(0, Math.min(s.newPerSession, maxCards - due.length));
  const tracks = TRACKS.filter(trackEnabled);
  let fresh;
  if (s.interleave) {
    const per = tracks.map((t) => newCandidates(t));
    fresh = interleave(per).slice(0, room);
  } else {
    fresh = tracks.flatMap((t) => newCandidates(t)).slice(0, room);
  }
  if (!s.interleave) return [...due, ...fresh];
  // on glisse les nouveautés entre les révisions (1 toutes les 3)
  const out = [];
  let k = 0;
  for (let i = 0; i < due.length; i++) {
    out.push(due[i]);
    if (i % 3 === 2 && k < fresh.length) out.push(fresh[k++]);
  }
  while (k < fresh.length) out.push(fresh[k++]);
  return out;
}

// Statistiques de maîtrise d'un ensemble d'exercices
export function mastery(ids) {
  const st = getState();
  let seen = 0, mastered = 0, weak = 0;
  for (const id of ids) {
    const c = st.cards[id];
    if (!c || !c.st) continue;
    seen++;
    if (c.st === 2 && c.s >= 21 && c.reps >= 2) mastered++;
    else if (c.st === 3 || (c.ko > c.ok)) weak++;
  }
  return { total: ids.length, seen, mastered, weak };
}
