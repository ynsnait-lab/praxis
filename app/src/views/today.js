// Accueil : séance du jour, cours suivants, pièges actifs, activité récente.
import { h } from "../dom.js";
import { C, TRACKS, TRACK_LABEL, TRACK_LONG, nextLesson, lessonRead, modOrder } from "../content.js";
import { summary } from "../engine.js";
import { getState, today, trapStatus } from "../store.js";
import { DAY } from "../fsrs.js";
import { trapCard } from "./module.js";
import { plural, trackPill, fmtMs } from "../ui.js";

export function todayView() {
  const st = getState();
  const sm = summary();
  const page = h("div.page");
  const firstVisit = !Object.keys(st.cards).length && !Object.values(st.lessons).some((l) => l.read);
  const hour = new Date().getHours();
  const hello = hour < 6 ? "Bonne nuit" : hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";
  const prenom = String(st.settings.prenom || C.owner || "").trim();
  page.append(h("div.page-head", {}, h("div", {},
    h("span.eyebrow", {}, new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })),
    h("h1", {}, firstVisit ? "Bienvenue dans Praxis" : (prenom ? `${hello}, ${prenom}` : hello)),
    h("p.sub", {}, firstVisit
      ? "Des petits cours qui partent de zéro et montent en crescendo, des exercices qui reviennent au bon moment, et des pièges pour apprendre à ne plus tomber dedans."
      : st.streak.cur > 1 ? `${st.streak.cur} jours d'affilée. Record : ${st.streak.best}.` : "Une séance courte chaque jour vaut mieux qu'une longue par semaine."))));

  // --- séance du jour
  const total = sm.dueN + sm.newN;
  const hero = h("div.hero-session", {},
    h("div", {},
      h("span.eyebrow", {}, "Séance du jour"),
      h("div.figures", {},
        fig(sm.dueN, sm.dueN > 1 ? "révisions dues" : "révision due"),
        fig(sm.newN, sm.newN > 1 ? "nouveaux exercices" : "nouvel exercice"),
        fig(total ? `~${sm.minutes}` : "0", "minutes")),
      total
        ? h("div.actions", {}, h("a.btn.primary.big", { href: "#/session" }, "Commencer la séance"),
          sm.due > sm.dueN ? h("span.small.muted", {}, `${sm.due - sm.dueN} autres révisions attendront la prochaine séance`) : null)
        : h("div.stack.g8", {}, h("p", {}, firstVisit ? "Commence par lire un premier cours : ses exercices rejoindront tes séances." : "Rien de dû. Lis le cours suivant pour débloquer de nouveaux exercices."),
          h("div.actions", {}, ...TRACKS.map((t) => nextLesson(t)).filter(Boolean).slice(0, 1).map((id) => h("a.btn.primary", { href: `#/m/${id}` }, `Lire : ${C.modules[id].title}`))))),
    activity14());
  page.append(hero);

  // --- cours suivants
  const nexts = TRACKS.filter((t) => st.settings.tracks[t] !== false).map((t) => [t, nextLesson(t)]).filter((x) => x[1]);
  if (nexts.length) {
    page.append(h("div.group-head", { style: { marginTop: "30px" } }, h("h2", {}, "Continuer le parcours")));
    page.append(h("div.grid3", {}, nexts.map(([t, id]) => {
      const m = C.modules[id];
      const done = modOrder(t).filter((x) => C.modules[x].lesson && lessonRead(x)).length;
      const withLesson = modOrder(t).filter((x) => C.modules[x].lesson).length;
      return h("div.panel.next-card", {},
        h("div.row", {}, trackPill(t), h("span.xs.faint.num", {}, `${done} / ${withLesson} cours lus`)),
        h("span.t", {}, m.title),
        m.goal ? h("span.small.muted", {}, m.goal) : null,
        h("div.row", {}, h("a.btn.primary.sm", { href: `#/m/${id}` }, "Lire le cours"),
          h("span.xs.faint", {}, `${m.lesson.minutes || 8} min`)));
    })));
  }

  // --- pièges actifs
  const active = Object.keys(st.traps).filter((p) => C.pieges[p] && trapStatus(p) === "tombe")
    .sort((a, b) => st.traps[b].lastFell - st.traps[a].lastFell).slice(0, 4);
  if (active.length) {
    page.append(h("div.group-head", { style: { marginTop: "30px" } }, h("h2", {}, "Pièges à surveiller"),
      h("a.small", { href: "#/pieges" }, "tout le carnet")));
    page.append(h("div.grid2", {}, active.map((p) => trapCard(p))));
  }

  // --- raccourcis
  page.append(h("div.group-head", { style: { marginTop: "30px" } }, h("h2", {}, "S'entraîner autrement")));
  page.append(h("div.grid3", {},
    shortcut("Par piste", "Uniquement Python, C++ ou Ingé.", TRACKS.map((t) => h("a.btn.sm", { href: `#/session/track/${t}` }, TRACK_LABEL[t]))),
    shortcut("Points faibles", "Les exercices que tu rates le plus souvent.", [h("a.btn.sm", { href: "#/session/weak" }, "Lancer")]),
    shortcut("Labs sur ta machine", "Du vrai code dans VS Code, vérifié par des tests.", [h("a.btn.sm", { href: "#/labs" }, "Voir les labs")])));
  return page;
}

function fig(v, l) {
  return h("div.fig", {}, h("div.v", {}, String(v)), h("div.l", {}, l));
}

function shortcut(title, desc, btns) {
  return h("div.panel.pad-sm", {}, h("div.stack.g8", {}, h("strong", {}, title), h("span.small.muted", {}, desc), h("div.row.tight", {}, btns)));
}

function activity14() {
  const st = getState();
  const days = [];
  for (let k = 13; k >= 0; k--) {
    const t = Date.now() - k * DAY;
    const d = today(t);
    days.push([d, st.days[d] || { n: 0, ok: 0, ms: 0 }, new Date(t)]);
  }
  const max = Math.max(5, ...days.map((x) => x[1].n));
  const totalN = days.reduce((a, x) => a + x[1].n, 0);
  const totalMs = days.reduce((a, x) => a + x[1].ms, 0);
  return h("div.stack.g8", {},
    h("div.row", {}, h("span.eyebrow", {}, "14 derniers jours"), h("span.spacer"), h("span.xs.faint", {}, `${plural(totalN, "réponse", "réponses")} · ${fmtMs(totalMs)}`)),
    h("div.week", { "aria-hidden": "true" }, days.map(([d, v], i) =>
      h(`div.d${i === 13 ? ".today" : ""}`, { title: `${d} : ${v.n} réponses` }, h("i", { style: { height: `${Math.round((100 * v.n) / max)}%` } })))),
    h("div.week-lbl", {}, days.map(([, , dt]) => h("span", {}, "lmmjvsd"[(dt.getDay() + 6) % 7]))));
}

export { TRACK_LONG };
