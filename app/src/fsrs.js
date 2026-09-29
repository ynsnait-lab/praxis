// Planificateur FSRS-6 (Free Spaced Repetition Scheduler), paramètres par défaut.
// Notes : 1 = à revoir (raté), 2 = difficile, 3 = correct, 4 = facile.
export const W = [0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722, 0.1666, 0.796, 1.4835, 0.0614,
  0.2629, 1.6483, 0.6014, 1.8729, 0.5425, 0.0912, 0.0658, 0.1542];
export const DAY = 86_400_000;
export const AGAIN = 1, HARD = 2, GOOD = 3, EASY = 4;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

function decay(w) {
  const d = w[20];
  return { d, f: Math.pow(0.9, -1 / d) - 1 };
}

export function newCard() {
  return { s: 0, d: 0, due: 0, last: 0, reps: 0, lapses: 0, st: 0, ok: 0, ko: 0, ms: 0 };
}

// Probabilité de rappel aujourd'hui.
export function retrievability(card, now = Date.now(), w = W) {
  if (!card || !card.s || !card.last) return 0;
  const { d, f } = decay(w);
  const t = Math.max(0, (now - card.last) / DAY);
  return Math.pow(1 + f * (t / card.s), -d);
}

function interval(s, retention, w, maxDays) {
  const { d, f } = decay(w);
  const i = (s / f) * (Math.pow(retention, -1 / d) - 1);
  return clamp(Math.round(i), 1, maxDays);
}

const initDifficulty = (w, g) => clamp(w[4] - Math.exp(w[5] * (g - 1)) + 1, 1, 10);
const initStability = (w, g) => clamp(w[g - 1], 0.01, 36500);

function nextDifficulty(w, d, g) {
  const delta = -w[6] * (g - 3);
  const dp = d + delta * ((10 - d) / 9);
  return clamp(w[7] * initDifficulty(w, EASY) + (1 - w[7]) * dp, 1, 10);
}

function recallStability(w, d, s, r, g) {
  const hard = g === HARD ? w[15] : 1;
  const easy = g === EASY ? w[16] : 1;
  const inc = Math.exp(w[8]) * (11 - d) * Math.pow(s, -w[9]) * (Math.exp(w[10] * (1 - r)) - 1) * hard * easy;
  return clamp(s * (1 + inc), 0.01, 36500);
}

function forgetStability(w, d, s, r) {
  const sf = w[11] * Math.pow(d, -w[12]) * (Math.pow(s + 1, w[13]) - 1) * Math.exp(w[14] * (1 - r));
  return clamp(Math.min(sf, s / Math.exp(w[17] * w[18])), 0.01, 36500);
}

function shortTermStability(w, s, g) {
  let inc = Math.exp(w[17] * (g - 3 + w[18])) * Math.pow(s, -w[19]);
  if (g >= GOOD) inc = Math.max(inc, 1);
  return clamp(s * inc, 0.01, 36500);
}

// Applique une note ; renvoie la nouvelle carte et l'intervalle en jours (0 = revient dans la séance / 10 min).
export function review(card, grade, { now = Date.now(), retention = 0.9, maxDays = 3650, w = W } = {}) {
  const g = clamp(Math.round(grade), 1, 4);
  const c = { ...newCard(), ...card };
  const r = retrievability(c, now, w);
  const sameDay = c.st !== 0 && c.last && now - c.last < DAY;
  if (c.st === 0 || !c.s) {
    c.d = initDifficulty(w, g);
    c.s = initStability(w, g);
    c.st = g === AGAIN ? 1 : 2;
  } else {
    c.d = nextDifficulty(w, c.d, g);
    if (sameDay) c.s = shortTermStability(w, c.s, g);
    else if (g === AGAIN) c.s = forgetStability(w, c.d, c.s, r);
    else c.s = recallStability(w, c.d, c.s, r, g);
    if (g === AGAIN) { c.lapses += 1; c.st = 3; } else c.st = 2;
  }
  c.reps += 1;
  c.last = now;
  const days = g === AGAIN ? 0 : interval(c.s, retention, w, maxDays);
  c.due = g === AGAIN ? now + 10 * 60_000 : now + days * DAY;
  return { card: c, days, r };
}

export const isDue = (card, now = Date.now()) => !!card && card.st !== 0 && card.due <= now;
// « Maîtrisée » : revue au moins deux fois, stabilité ≥ 21 jours.
export const isMastered = (card) => !!card && card.st === 2 && card.s >= 21 && card.reps >= 2;

export function formatDays(d) {
  if (d <= 0) return "dans 10 min";
  if (d === 1) return "demain";
  if (d < 30) return `dans ${d} j`;
  if (d < 365) return `dans ${(d / 30).toFixed(d < 90 ? 1 : 0).replace(".", ",")} mois`;
  return `dans ${(d / 365).toFixed(1).replace(".", ",")} ans`;
}
