// Déroulé d'une séance : un exercice à la fois, relances des erreurs, bilan final.
import { h, clear } from "../dom.js";
import { C, TRACK_LABEL, nextLesson, trackOfEx } from "../content.js";
import { buildSession, summary } from "../engine.js";
import { recordAnswer, getState } from "../store.js";
import { renderExercise } from "./exercise.js";
import { formatDays } from "../fsrs.js";
import { fmtMs, plural, go } from "../ui.js";

let current = null; // séance en cours (survit à la navigation)

function scopeFromParts(parts) {
  const [, kind, id] = parts;
  if (kind === "module") return { type: "module", id };
  if (kind === "quiz") return { type: "quiz", id: `quiz:${id}` };
  if (kind === "trap") return { type: "trap", id };
  if (kind === "track") return { type: "track", id };
  if (kind === "weak") return { type: "weak" };
  if (kind === "all") return { type: "module", id, all: true };
  if (kind === "one") return { type: "one", id };
  return { type: "daily" };
}

const scopeKey = (s) => `${s.type}:${s.id || ""}`;

export function sessionView(parts) {
  const scope = scopeFromParts(parts);
  if (!current || current.key !== scopeKey(scope) || current.finished) {
    current = { key: scopeKey(scope), scope, queue: buildSession(scope), i: 0, results: [], requeued: new Set(), started: Date.now(), finished: false };
  }
  const page = h("div.page.narrow");
  if (!current.queue.length) {
    current = null;
    return emptyView(page, scope);
  }
  renderStep(page);
  return page;
}

function scopeTitle(scope) {
  if (scope.type === "module") return C.modules[scope.id] ? C.modules[scope.id].title : "Module";
  if (scope.type === "quiz") return `Quiz · ${(C.domains[scope.id.slice(5)] || {}).title || ""}`;
  if (scope.type === "trap") return `Piège · ${(C.pieges[scope.id] || {}).title || ""}`;
  if (scope.type === "track") return `Piste ${TRACK_LABEL[scope.id] || ""}`;
  if (scope.type === "weak") return "Points faibles";
  if (scope.type === "one") return "Exercice";
  return "Séance du jour";
}

function meter() {
  const s = current;
  return h("div.meter", { "aria-hidden": "true" }, s.queue.map((_, k) => {
    const r = s.results[k];
    return h("i", { class: k === s.i ? "now" : r ? (r.grade >= 2 ? "ok" : "ko") : "" });
  }));
}

function renderStep(page) {
  const s = current;
  clear(page);
  if (s.i >= s.queue.length) return renderEnd(page);
  const id = s.queue[s.i];
  const e = C.ex[id];
  const top = h("div.session-top", {},
    h("button.btn.ghost.sm", { onclick: () => { go("#/"); } }, "✕ Quitter"),
    meter(),
    h("span.xs.faint.mono", {}, scopeTitle(s.scope)));
  page.append(top);
  if (!e) { s.i++; return renderStep(page); }
  const exEl = renderExercise(e, {
    index: s.i,
    total: s.queue.length,
    onDone: (res) => {
      const r = recordAnswer(id, res.grade, { ms: res.ms, trap: res.trap, hint: res.hint });
      s.results[s.i] = { ...res, id, days: r ? r.days : 0 };
      if (res.grade === 1 && !s.requeued.has(id)) {
        s.requeued.add(id);
        const pos = Math.min(s.queue.length, s.i + 4);
        s.queue.splice(pos, 0, id);
      }
      s.i++;
      renderStep(page);
      page.scrollIntoView({ block: "start" });
      window.scrollTo({ top: 0 });
    },
  });
  page.append(exEl);
}

function renderEnd(page) {
  const s = current;
  s.finished = true;
  const res = s.results.filter(Boolean);
  const ok = res.filter((r) => r.grade >= 2).length;
  const ms = res.reduce((a, r) => a + (r.ms || 0), 0);
  const trapsFell = [...new Set(res.filter((r) => r.trap && r.grade === 1).map((r) => r.trap))];
  const trapsOk = [...new Set(res.filter((r) => r.trap && r.grade >= 2).map((r) => r.trap))].filter((t) => !trapsFell.includes(t));
  const firstTry = new Map();
  for (const r of res) if (!firstTry.has(r.id)) firstTry.set(r.id, r);
  const missed = [...firstTry.values()].filter((r) => r.grade === 1);
  const sm = summary();
  page.append(
    h("div.page-head", {}, h("div", {}, h("span.eyebrow", {}, "Bilan"), h("h1", {}, scopeTitle(s.scope)))),
    h("div.kpis", {},
      kpi(`${ok}/${res.length}`, "réponses justes"),
      kpi(res.length ? `${Math.round((100 * ok) / res.length)} %` : "—", "réussite"),
      kpi(fmtMs(ms), "temps de réflexion"),
      kpi(String(getState().streak.cur || 0), "jours d'affilée")),
  );
  if (trapsFell.length || trapsOk.length) {
    page.append(h("div.panel", { style: { marginTop: "18px" } },
      h("div.panel-head", {}, h("h3", {}, "Pièges croisés")),
      h("div.stack.g8", {},
        trapsFell.map((t) => h("a.trap-card", { href: `#/piege/${t}` }, h("span.t", {}, C.pieges[t]?.title || t), h("span.small.muted", {}, "Tombé dedans : il reviendra dans tes prochaines séances."))),
        trapsOk.map((t) => h("a.trap-card.st-deja", { href: `#/piege/${t}` }, h("span.t", {}, C.pieges[t]?.title || t), h("span.small.muted", {}, "Évité."))))));
  }
  if (missed.length) {
    page.append(h("div.panel", { style: { marginTop: "18px" } },
      h("div.panel-head", {}, h("h3", {}, "À retravailler"), h("span.xs.faint", {}, "ces exercices reviennent dans 10 minutes, puis selon ta mémoire")),
      h("div.stack.g6", {}, missed.map((r) => {
        const e = C.ex[r.id];
        const m = C.modules[e.mod];
        const titre = m ? m.title : (C.domains[(e.mod || "").slice(5)] || {}).title || "";
        const q = String(e.q).split("\n")[0].replace(/[#>*`]/g, "").trim();
        return h("a.row.small", { href: `#/session/one/${r.id}`, style: { color: "inherit", textDecoration: "none" } },
          h(`span.dotlang.${trackOfEx(e)}`), h("span.faint.xs", {}, titre), h("span", {}, q.length > 80 ? q.slice(0, 77) + "…" : q));
      }))));
  }
  const next = res.map((r) => r.days).filter((d) => d > 0).sort((a, b) => a - b)[0];
  page.append(h("p.small.muted", { style: { marginTop: "16px" } },
    next ? `Prochaine révision de ces exercices : ${formatDays(next)}. ` : "",
    sm.due ? `${plural(sm.due, "exercice encore dû", "exercices encore dus")}. ` : "Plus rien de dû pour aujourd'hui. ",
    sm.newAvail ? `${plural(sm.newAvail, "nouvel exercice disponible", "nouveaux exercices disponibles")}.` : ""));
  const nl = ["python", "cpp", "inge"].map(nextLesson).filter(Boolean)[0];
  page.append(h("div.actions", { style: { marginTop: "18px" } },
    h("button.btn.primary", { onclick: () => { current = null; go(s.scope.type === "daily" ? "#/session/again" : location.hash); } }, "Encore une série"),
    nl ? h("a.btn", { href: `#/m/${nl}` }, `Cours suivant : ${C.modules[nl].title}`) : null,
    h("a.btn.ghost", { href: "#/" }, "Retour à l'accueil")));
}

function kpi(v, l) {
  return h("div.kpi", {}, h("div.v", {}, v), h("div.l", {}, l));
}

function emptyView(page, scope) {
  const nl = ["python", "cpp", "inge"].map((t) => [t, nextLesson(t)]).filter((x) => x[1]);
  page.append(
    h("div.page-head", {}, h("div", {}, h("span.eyebrow", {}, scopeTitle(scope)), h("h1", {}, "Rien à faire ici pour l'instant"))),
    h("div.panel", {}, h("div.stack.g14", {},
      h("p", {}, scope.type === "daily"
        ? "Aucune révision n'est due et aucun nouvel exercice n'est débloqué. Les exercices d'un module entrent dans tes séances quand tu as lu son cours."
        : "Cette sélection ne contient pas d'exercice."),
      nl.length ? h("div.stack.g8", {}, h("span.eyebrow", {}, "Prochains cours"),
        nl.map(([t, id]) => h("a.btn", { href: `#/m/${id}`, style: { justifyContent: "flex-start" } }, h(`span.dotlang.${t}`), `${TRACK_LABEL[t]} · ${C.modules[id].title}`))) : null,
      h("a.btn.ghost", { href: "#/parcours" }, "Voir tout le parcours"))));
  return page;
}

export function resetSession() { current = null; }
