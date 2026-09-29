// Progression : chiffres clés, activité, prévisions, modules à retravailler.
import { h } from "../dom.js";
import { C, TRACKS, TRACK_LONG, allModules, exercisesOf, lessonRead } from "../content.js";
import { getState, today, trapStatus } from "../store.js";
import { mastery } from "../engine.js";
import { DAY, isMastered } from "../fsrs.js";
import { fmtMs, masteryBar } from "../ui.js";

export function statsView() {
  const st = getState();
  const page = h("div.page");
  const cards = Object.entries(st.cards).filter(([id]) => C.ex[id]);
  const seen = cards.filter(([, c]) => c.st).length;
  const mastered = cards.filter(([, c]) => isMastered(c)).length;
  const since = Date.now() - 30 * DAY;
  const j30 = st.journal.filter((j) => j[0] >= since);
  const acc30 = j30.length ? Math.round((100 * j30.filter((j) => j[2] >= 2).length) / j30.length) : null;
  const totalMs = Object.values(st.days).reduce((a, d) => a + (d.ms || 0), 0);
  const lessons = Object.values(st.lessons).filter((l) => l.read).length;
  const totalLessons = Object.values(C.modules).filter((m) => m.lesson).length;
  page.append(h("div.page-head", {}, h("div", {}, h("span.eyebrow", {}, "Tableau de bord"), h("h1", {}, "Progression"))));
  page.append(h("div.kpis", {},
    kpi(`${seen}`, `exercices vus sur ${Object.keys(C.ex).length}`),
    kpi(`${mastered}`, "maîtrisés (mémoire ≥ 3 semaines)"),
    kpi(acc30 == null ? "—" : `${acc30} %`, "réussite sur 30 jours"),
    kpi(`${lessons}/${totalLessons}`, "cours lus"),
    kpi(fmtMs(totalMs), "temps de réflexion"),
    kpi(`${st.streak.cur || 0} j`, `série · record ${st.streak.best || 0} j`)));

  // par piste
  const rows = TRACKS.map((t) => {
    const ids = allModules().filter((m) => C.modules[m].track === t).flatMap((m) => exercisesOf(m))
      .concat(t === "inge" ? C.tracks.inge.groups.flatMap((g) => g.quiz || []) : []);
    const m = mastery(ids);
    const jt = j30.filter((j) => C.ex[j[1]] && trackOf(j[1]) === t);
    const acc = jt.length ? Math.round((100 * jt.filter((j) => j[2] >= 2).length) / jt.length) : null;
    return [t, m, acc];
  });
  page.append(section("Par piste", h("div.tbl-wrap", {}, h("table.data", {},
    h("thead", {}, h("tr", {}, h("th", {}, "Piste"), h("th", {}, "Vus"), h("th", {}, "Maîtrisés"), h("th", {}, "Réussite 30 j"), h("th", {}, ""))),
    h("tbody", {}, rows.map(([t, m, acc]) => h("tr", {},
      h("td", {}, TRACK_LONG[t]), h("td.n", {}, `${m.seen}/${m.total}`), h("td.n", {}, String(m.mastered)),
      h("td.n", {}, acc == null ? "—" : `${acc} %`), h("td", { style: { width: "34%" } }, masteryBar(m)))))))));

  // activité (20 semaines)
  const heat = h("div.heat", { "aria-label": "Activité quotidienne des 20 dernières semaines" });
  const start = new Date();
  start.setDate(start.getDate() - 7 * 20 + 1 - ((start.getDay() + 6) % 7));
  for (let k = 0; k < 7 * 20 + ((new Date().getDay() + 6) % 7) + 1; k++) {
    const d = new Date(start.getTime() + k * DAY);
    const n = (st.days[today(d.getTime())] || {}).n || 0;
    const lvl = n === 0 ? "" : n < 10 ? "h1" : n < 25 ? "h2" : n < 50 ? "h3" : "h4";
    heat.append(h("i", { class: lvl, title: `${d.toLocaleDateString("fr-FR")} : ${n} réponses` }));
  }
  page.append(section("Activité", heat));

  // prévision 7 jours
  const now = Date.now();
  const days = [...Array(7)].map((_, k) => {
    const end = new Date(); end.setHours(23, 59, 59, 999);
    const lim = end.getTime() + k * DAY;
    const lo = k === 0 ? 0 : end.getTime() + (k - 1) * DAY;
    return cards.filter(([, c]) => c.st && c.due > lo && c.due <= lim).length;
  });
  const max = Math.max(4, ...days);
  page.append(section("Révisions prévues", h("div.bars7", {}, days.map((n, k) => {
    const d = new Date(now + k * DAY);
    return h("div.b", { title: `${n} révisions` }, h("span", {}, String(n)), h("i", { style: { height: `${Math.round((100 * n) / max)}%` } }),
      h("span", {}, k === 0 ? "auj." : d.toLocaleDateString("fr-FR", { weekday: "short" })));
  }))));

  // modules fragiles
  const weakMods = allModules().map((id) => [id, mastery(exercisesOf(id))]).filter(([, m]) => m.weak > 0)
    .sort((a, b) => b[1].weak - a[1].weak).slice(0, 8);
  if (weakMods.length) {
    page.append(section("À retravailler", h("div.stack.g6", {}, weakMods.map(([id, m]) =>
      h("div.row", {}, h(`span.dotlang.${C.modules[id].track}`), h("a", { href: `#/m/${id}` }, C.modules[id].title), h("span.spacer"),
        h("span.xs.faint", {}, `${m.weak} fragile${m.weak > 1 ? "s" : ""}`), h("a.btn.sm", { href: `#/session/module/${id}` }, "Revoir"))))));
  }
  const tc = { tombe: 0, progres: 0, deja: 0 };
  for (const p of Object.keys(st.traps)) { const s = trapStatus(p); if (s in tc) tc[s]++; }
  page.append(section("Pièges", h("p.small", {}, `${tc.tombe} actifs (tombé dedans), ${tc.progres} en progrès, ${tc.deja} déjoués. `, h("a", { href: "#/pieges" }, "Ouvrir le carnet"))));
  return page;
}

function trackOf(exId) {
  const e = C.ex[exId];
  return C.modules[e.mod] ? C.modules[e.mod].track : "inge";
}
function kpi(v, l) { return h("div.kpi", {}, h("div.v", {}, v), h("div.l", {}, l)); }
function section(title, content) {
  return h("div.panel", { style: { marginTop: "18px" } }, h("div.panel-head", {}, h("h3", {}, title)), content);
}
export { lessonRead };
