// Accès au contenu embarqué (cours, exercices, pièges…) et index pratiques.
import { getState } from "./store.js";

function readData() {
  const el = document.getElementById("praxis-data");
  if (!el) throw new Error("données Praxis absentes");
  return JSON.parse(el.textContent);
}

export const C = readData();

export const TRACKS = ["python", "cpp", "inge"];
export const TRACK_LABEL = { python: "Python", cpp: "C++", inge: "Ingé" };
export const TRACK_LONG = { python: "Python", cpp: "C++", inge: "Culture ingé" };

export const LEVELS = {
  1: { short: "Image", long: "L'image" },
  2: { short: "Mécanisme", long: "Le mécanisme" },
  3: { short: "Code", long: "Le code" },
  4: { short: "Sous le capot", long: "Sous le capot" },
  5: { short: "Terrain", long: "Sur le terrain" },
};
export function levelLabel(lv, track) {
  if (lv === 3 && track === "inge") return "La formule";
  return LEVELS[lv]?.long || "";
}
export const EX_LEVEL = { 1: "Bases", 2: "Solide", 3: "Pointu" };
export const TYPE_LABEL = {
  qcm: "QCM", predict: "Prédire la sortie", cloze: "Texte à trous", code: "Écrire du code", bug: "Trouver le bug",
  flash: "Carte mémo", parsons: "Remettre dans l'ordre", numeric: "Calcul",
};

export const mod = (id) => C.modules[id];
export const ex = (id) => C.ex[id];
export const piege = (id) => C.pieges[id];

export function modOrder(track) {
  const t = C.tracks[track];
  return t ? t.groups.flatMap((g) => g.modules) : [];
}
export const allModules = () => TRACKS.flatMap(modOrder);

export function exLang(e) {
  if (e.lang) return e.lang;
  const m = C.modules[e.mod];
  return m && m.track === "cpp" ? "cpp" : "python";
}
export const trackOfEx = (e) => (C.modules[e.mod] ? C.modules[e.mod].track : "inge");

export function lessonRead(id) {
  const l = getState().lessons[id];
  return !!(l && l.read);
}

// Un module est « ouvert » (ses exercices entrent dans les séances) quand son cours est lu.
// Sans cours : quand tous ses prérequis sont ouverts. Quiz de domaine ingé : dès qu'une notion du domaine est lue.
const openCache = new Map();
export function isOpen(id, depth = 0) {
  if (id.startsWith("quiz:")) {
    const dom = C.domains[id.slice(5)];
    return !!dom && dom.modules.some((m) => lessonRead(m));
  }
  const m = C.modules[id];
  if (!m) return false;
  if (m.lesson) return lessonRead(id);
  if (depth > 20) return false;
  return (m.requires || []).every((r) => isOpen(r, depth + 1));
}
export function resetOpenCache() { openCache.clear(); }

// Exercices d'un « module » au sens large (module, notion, ou quiz de domaine)
export function exercisesOf(id) {
  if (id.startsWith("quiz:")) return (C.domains[id.slice(5)] || {}).quiz || [];
  return (C.modules[id] || {}).ex || [];
}

// Prochain cours non lu dans une piste (dans l'ordre)
export function nextLesson(track) {
  for (const id of modOrder(track)) {
    const m = C.modules[id];
    if (m.lesson && !lessonRead(id)) return id;
  }
  return null;
}

export function groupOf(modId) {
  const m = C.modules[modId];
  if (!m) return null;
  const t = C.tracks[m.track];
  return t.groups.find((g) => g.modules.includes(modId)) || null;
}

export function modIndex(modId) {
  const m = C.modules[modId];
  if (!m) return 0;
  const g = groupOf(modId);
  return g ? g.modules.indexOf(modId) + 1 : 0;
}
