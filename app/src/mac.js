// Pont avec Praxis.app, le lanceur macOS : la page lui annonce la séance du jour et chaque séance terminée,
// et l'app les transmet à Praxis Rappels (launcher/macos/rappels). Ailleurs (navigateur, page Claude), rien.
import { C, TRACKS, TRACK_LABEL, nextLesson } from "./content.js";
import { summary } from "./engine.js";
import { getState, onChange } from "./store.js";
import { plural } from "./ui.js";

// Une journée compte comme pratiquée si une séance y a été terminée, ou si l'on y a répondu à au moins autant d'exercices.
const SEUIL_JOURNEE = 10;

function canal() {
  try {
    return (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.praxis) || null;
  } catch {
    return null;
  }
}

function envoyer(message) {
  const c = canal();
  if (!c) return false;
  try {
    c.postMessage(message);
    return true;
  } catch {
    return false;
  }
}

export const dansPraxisMac = () => !!canal();

// Ce que verra l'alerte de Praxis Rappels : la séance du jour, sa durée, et les journées pratiquées.
export function planDuJour() {
  const st = getState();
  const sm = summary();
  const total = sm.dueN + sm.newN;
  const id = TRACKS.filter((t) => st.settings.tracks[t] !== false).map(nextLesson).filter(Boolean)[0];
  const cours = id ? C.modules[id] : null;
  let title, subtitle, minutes;
  if (total) {
    title = `${plural(total, "exercice", "exercices")} au programme`;
    const parts = [];
    if (sm.dueN) parts.push(plural(sm.dueN, "révision due", "révisions dues"));
    if (sm.newN) parts.push(plural(sm.newN, "nouveau", "nouveaux"));
    if (cours) parts.push(`puis le cours « ${cours.title} »`);
    subtitle = parts.join(" · ");
    minutes = sm.minutes;
  } else if (cours) {
    title = cours.title;
    subtitle = `Cours suivant, piste ${TRACK_LABEL[cours.track] || cours.track}`;
    minutes = (cours.lesson && cours.lesson.minutes) || 10;
  } else {
    title = "Séance libre";
    subtitle = "Tout est à jour : un lab ou un défi";
    minutes = st.settings.sessionMin;
  }
  const jours = Object.entries(st.days)
    .filter(([, d]) => (d.s || 0) > 0 || (d.n || 0) >= SEUIL_JOURNEE)
    .map(([d]) => d)
    .sort()
    .slice(-60);
  return { title, subtitle, minutes, jours, serie: st.streak.cur || 0 };
}

export function seanceTerminee(bilan) {
  envoyer({ type: "seance-terminee", ...bilan });
  envoyer({ type: "plan", ...planDuJour() });
}

export function demarrerPontMac() {
  if (!canal()) return;
  const annoncer = () => envoyer({ type: "plan", ...planDuJour() });
  let minuteur = null;
  annoncer();
  onChange(() => {
    clearTimeout(minuteur);
    minuteur = setTimeout(annoncer, 1500);
  });
  window.addEventListener("pagehide", annoncer);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") annoncer(); });
}
