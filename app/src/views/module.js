// Page d'un module / d'une notion : cours en crescendo, exercices, pièges.
import { h, clear } from "../dom.js";
import { md, codeHTML, inline } from "../md.js";
import { C, TRACK_LABEL, TRACK_LONG, TYPE_LABEL, EX_LEVEL, levelLabel, lessonRead, groupOf, modIndex, modOrder, exercisesOf } from "../content.js";
import { getState, markLesson, trapStatus, settings } from "../store.js";
import { mastery } from "../engine.js";
import { isDue, isMastered } from "../fsrs.js";
import { python } from "../runners.js";
import { cresc, lvChip, masteryBar, trackPill, go, plural } from "../ui.js";

const LETTERS = "ABCDEFGH";

export function moduleView(parts) {
  const id = parts[1];
  const m = C.modules[id];
  const page = h("div.page.read");
  if (!m) {
    page.append(h("h1", {}, "Module introuvable"), h("p", {}, h("a", { href: "#/parcours" }, "Retour au parcours")));
    return page;
  }
  const tab = parts[2] || (m.lesson ? "cours" : "exos");
  const g = groupOf(id);
  const dom = m.track === "inge" ? C.domains[m.domain] : null;
  const crumbs = h("div.crumbs", {},
    h("a", { href: `#/parcours/${m.track}` }, TRACK_LONG[m.track]), h("span", {}, "›"),
    dom ? h("a", { href: `#/d/${dom.id}` }, dom.title) : h("span", {}, g ? g.title : ""),
    h("span", {}, "›"), h("span", {}, `${m.track === "inge" ? "Notion" : "Module"} ${modIndex(id)}`));
  const read = lessonRead(id);
  const levels = m.lesson ? [...new Set(m.lesson.steps.map((s) => s.level))] : [];
  const exIds = exercisesOf(id);
  const ms = mastery(exIds);
  const pg = collectPieges(m);
  page.append(h("div.lesson-head", {},
    crumbs,
    h("h1", {}, m.title),
    m.en ? h("div.en", {}, `EN · ${m.en}`) : null,
    m.goal ? h("p.goal", {}, m.goal) : null,
    h("div.row", {},
      trackPill(m.track),
      m.lesson ? h("span.pill", {}, `${m.lesson.minutes || 8} min de lecture`) : h("span.pill", {}, "exercices seuls"),
      levels.length ? h("span.lvchip", { title: "Niveaux couverts par le cours, du plus intuitif au plus pointu" }, cresc(levels, 5), "crescendo") : null,
      read ? h("span.pill.ok", {}, "cours lu") : m.lesson ? h("span.pill.mark", {}, "à lire") : null,
      h("span.spacer"),
      exIds.length ? h("div", { style: { width: "140px" } }, masteryBar(ms)) : null)));

  const tabs = h("div.tabs", { role: "tablist" },
    m.lesson ? tabBtn("Cours", "cours") : null,
    tabBtn(`Exercices · ${exIds.length}`, "exos"),
    pg.length ? tabBtn(`Pièges · ${pg.length}`, "pieges") : null);
  function tabBtn(label, key) {
    return h(`button${tab === key ? ".on" : ""}`, { role: "tab", "aria-selected": tab === key ? "true" : "false", onclick: () => go(`#/m/${id}/${key}`) }, label);
  }
  page.append(tabs);
  const body = h("div");
  page.append(body);
  if (tab === "cours" && m.lesson) renderLesson(body, m);
  else if (tab === "pieges") renderPieges(body, pg);
  else renderExos(body, m, exIds);
  return page;
}

function collectPieges(m) {
  const set = new Set((m.lesson && m.lesson.pieges) || []);
  for (const eid of m.ex || []) if (C.ex[eid] && C.ex[eid].piege) set.add(C.ex[eid].piege);
  return [...set].filter((p) => C.pieges[p]);
}

// ---------------------------------------------------------------- cours

function renderLesson(body, m) {
  const L = m.lesson;
  const st = getState();
  const rec = st.lessons[m.id] || { read: 0, step: 1 };
  const progressive = settings().reveal === "progressif" && !rec.read;
  let shown = progressive ? Math.min(Math.max(1, rec.step || 1), L.steps.length) : L.steps.length;
  const wrap = h("div.stack.g20");
  body.append(wrap);
  if (L.intro) wrap.append(h("div.prose.lg", { html: md(L.intro) }));
  const stepsBox = h("div", { style: { marginTop: "8px" } });
  wrap.append(stepsBox);
  const tail = h("div.stack.g20");
  wrap.append(tail);

  function draw() {
    clear(stepsBox);
    L.steps.slice(0, shown).forEach((s, i) => stepsBox.append(stepEl(s, i, m)));
    clear(tail);
    if (shown < L.steps.length) {
      const nextLv = L.steps[shown].level;
      tail.append(h("div.row", {},
        h("button.btn.primary", {
          onclick: () => {
            shown++;
            markLesson(m.id, { step: shown });
            draw();
            const last = stepsBox.lastElementChild;
            if (last) last.scrollIntoView({ block: "start", behavior: "smooth" });
          },
        }, "Continuer ", h("span.xs", { style: { opacity: ".8" } }, `→ ${levelLabel(nextLv, m.track).toLowerCase()}`)),
        h("button.btn.ghost.sm", { onclick: () => { shown = L.steps.length; markLesson(m.id, { step: shown }); draw(); } }, "Tout afficher"),
        h("span.xs.faint", {}, `étape ${shown} / ${L.steps.length}`)));
      return;
    }
    if (L.recap && L.recap.length) {
      tail.append(h("div.recap", {}, h("span.eyebrow", {}, "À retenir"), h("ul", {}, L.recap.map((r) => h("li", { html: inline(r) })))));
    }
    if (m.vocab && m.vocab.length) {
      tail.append(h("div.stack.g8", {}, h("span.eyebrow", {}, "Vocabulaire français → anglais"),
        h("div.vocab", {}, h("div.h", {}, "Français"), h("div.h", {}, "English"), m.vocab.flatMap(([fr, en]) => [h("div", { html: inline(fr) }), h("div", { html: inline(en) })]))));
    }
    const pg = (L.pieges || []).filter((p) => C.pieges[p]);
    if (pg.length) {
      tail.append(h("div.stack.g8", {}, h("span.eyebrow", {}, "Pièges de ce cours"),
        h("div.grid2", {}, pg.map((p) => trapCard(p)))));
    }
    const read = lessonRead(m.id);
    const nEx = (m.ex || []).length;
    const nextId = nextInOrder(m);
    tail.append(h("div.panel", {}, h("div.stack.g14", {},
      read
        ? h("p", {}, "Cours lu. Ses exercices font partie de tes séances.")
        : h("p", {}, nEx ? `Marque le cours comme lu : ses ${nEx} exercices entreront dans tes séances de révision.` : "Marque le cours comme lu pour suivre ta progression."),
      h("div.actions", {},
        !read && nEx ? h("button.btn.primary", { onclick: () => { markLesson(m.id, { read: Date.now(), step: L.steps.length }); go(`#/session/module/${m.id}`); } }, "J'ai compris : je m'entraîne") : null,
        !read ? h("button.btn", { onclick: () => { markLesson(m.id, { read: Date.now(), step: L.steps.length }); draw(); } }, "Marquer comme lu") : null,
        read && nEx ? h("a.btn.primary", { href: `#/session/module/${m.id}` }, "S'entraîner sur ce module") : null,
        nextId ? h("a.btn.ghost", { href: `#/m/${nextId}` }, `Suivant : ${C.modules[nextId].title} →`) : null))));
  }
  draw();
}

function nextInOrder(m) {
  const order = m.track === "inge" ? C.tracks.inge.groups.flatMap((g) => g.modules) : modOrder(m.track);
  const i = order.indexOf(m.id);
  return i >= 0 && i + 1 < order.length ? order[i + 1] : null;
}

function stepEl(s, i, m) {
  const lang = s.lang || (m.track === "cpp" ? "cpp" : "python");
  const bodyEl = h("div.body", {},
    lvChip(s.level, levelLabel(s.level, m.track)),
    h("h3", {}, s.title),
    s.body ? h("div.prose", { html: md(s.body) }) : null);
  if (s.code) bodyEl.append(codeRunner(s, lang));
  if (s.after) bodyEl.append(h("div.prose", { html: md(s.after) }));
  if (s.check) bodyEl.append(miniCheck(s.check));
  return h(`div.step.l${s.level}`, {}, h("div.nb", {}, String(i + 1)), bodyEl);
}

function codeRunner(s, lang) {
  const box = h("div.stack.g8");
  const view = h("div", { html: codeHTML(s.code, lang) });
  box.append(view);
  const canRun = lang === "python" && s.run !== false && s.run !== undefined;
  const out = h("div");
  if (s.out !== undefined && s.out !== null && !canRun) {
    out.append(h("pre.console", {}, h("span.lbl", {}, "Sortie"), String(s.out).replace(/\n$/, "")));
  }
  if (canRun) {
    let editing = false;
    let ta = null;
    const runBtn = h("button.btn.sm", {
      onclick: async () => {
        const code = editing ? ta.value : s.code;
        clear(out).append(h("pre.console", {}, python.state === "ready" ? "Exécution…" : "Chargement de Python dans le navigateur (une fois, ~12 Mo)…"));
        runBtn.disabled = true;
        const r = await python.run(code);
        runBtn.disabled = false;
        if (r.unavailable) {
          clear(out).append(h("pre.console.err", {}, `${r.err}\nExécution impossible ici.`),
            s.out !== undefined ? h("pre.console", {}, h("span.lbl", {}, "Sortie attendue"), String(s.out)) : null);
          return;
        }
        const text = [r.out, r.err].filter(Boolean).join("\n").trimEnd();
        clear(out).append(h(`pre.console${r.ok ? "" : ".err"}`, {}, h("span.lbl", {}, r.ok ? "Sortie" : "Erreur"), text || "(rien d'affiché)"));
      },
    }, "▶ Exécuter");
    const editBtn = h("button.btn.ghost.sm", {
      onclick: () => {
        if (editing) return;
        editing = true;
        ta = h("textarea", { spellcheck: "false", rows: Math.max(4, s.code.split("\n").length + 1), "aria-label": "Code modifiable" });
        ta.value = s.code;
        clear(view).append(h("div.editor", {}, h("div.editor-bar", {}, h("span", {}, "python"), h("span.spacer"), h("span.faint", {}, "modifie, puis exécute")), ta));
        ta.addEventListener("keydown", (ev) => {
          if (ev.key === "Tab") { ev.preventDefault(); const p = ta.selectionStart; ta.value = ta.value.slice(0, p) + "    " + ta.value.slice(ta.selectionEnd); ta.selectionStart = ta.selectionEnd = p + 4; }
          if (ev.key === "Enter" && (ev.metaKey || ev.ctrlKey)) { ev.preventDefault(); runBtn.click(); }
        });
        editBtn.remove();
        ta.focus();
      },
    }, "✎ Modifier");
    box.append(h("div.row.tight", {}, runBtn, editBtn));
  }
  box.append(out);
  return box;
}

function miniCheck(chk) {
  const box = h("div.check", {}, h("span.eyebrow", {}, "Vérifie que tu suis"), h("div.prose", { html: md(chk.q) }));
  const list = h("div.choices");
  let done = false;
  chk.choices.forEach((c, k) => {
    const b = h("button.choice", { type: "button" }, h("span.key", {}, LETTERS[k]), h("span.body", {}, h("span", { html: inline(c.t) })));
    b.addEventListener("click", () => {
      if (done) return;
      done = true;
      [...list.children].forEach((bb, kk) => {
        const cc = chk.choices[kk];
        bb.disabled = true;
        if (cc.ok) bb.classList.add("good");
        else if (bb === b) bb.classList.add("bad");
        else bb.classList.add("dim");
        if (cc.why && (cc.ok || bb === b)) bb.querySelector(".body").append(h("div.why", { html: inline(cc.why) }));
      });
      if (chk.e) box.append(h("div.prose.small", { html: md(chk.e) }));
    });
    list.append(b);
  });
  box.append(list);
  return box;
}

// ---------------------------------------------------------------- exercices

function statusOf(eid) {
  const c = getState().cards[eid];
  if (!c || !c.st) return ["neuf", ""];
  if (isMastered(c)) return ["maîtrisé", "ok"];
  if (isDue(c)) return ["à revoir", "mark"];
  if (c.st === 3 || c.ko > c.ok) return ["fragile", "bad"];
  return ["vu", "acc"];
}

function renderExos(body, m, exIds) {
  const read = lessonRead(m.id);
  body.append(h("div.stack.g14", {},
    m.lesson && !read ? h("div.panel.flat.pad-sm.small", {}, "Tu peux t'entraîner tout de suite, mais ces exercices n'entreront dans tes séances automatiques qu'une fois le cours marqué comme lu.") : null,
    h("div.actions", {},
      exIds.length ? h("a.btn.primary", { href: `#/session/module/${m.id}` }, "S'entraîner sur ce module") : null,
      exIds.length ? h("a.btn", { href: `#/session/all/${m.id}` }, `Tout faire (${exIds.length})`) : null),
    h("div.tbl-wrap", {}, h("table.data", {},
      h("thead", {}, h("tr", {}, h("th", {}, "#"), h("th", {}, "Type"), h("th", {}, "Niveau"), h("th", {}, "Énoncé"), h("th", {}, "État"))),
      h("tbody", {}, exIds.map((eid, i) => {
        const e = C.ex[eid];
        const [lbl, cls] = statusOf(eid);
        return h("tr", {},
          h("td.n", {}, String(i + 1)),
          h("td", {}, TYPE_LABEL[e.type]),
          h("td", {}, EX_LEVEL[e.level]),
          h("td", {}, h("a", { href: `#/session/one/${eid}`, html: inline(firstLine(e.q)) })),
          h("td", {}, h(`span.pill${cls ? "." + cls : ""}`, {}, lbl)));
      }))))));
}

function firstLine(q) {
  const t = String(q).split("\n")[0].replace(/[#>*]/g, "").trim();
  return t.length > 110 ? t.slice(0, 107) + "…" : t;
}

// ---------------------------------------------------------------- pièges

export function trapCard(pid) {
  const p = C.pieges[pid];
  const st = trapStatus(pid);
  const lbl = { neuf: "pas encore croisé", tombe: "tombé dedans", progres: "en progrès", deja: "déjoué" }[st];
  const cls = { neuf: "", tombe: "bad", progres: "warn", deja: "ok" }[st];
  return h(`a.trap-card.st-${st}`, { href: `#/piege/${pid}` },
    h("div.top", {}, h("span.t", {}, p.title), h(`span.pill${cls ? "." + cls : ""}`, {}, lbl)),
    h("span.small.muted", { html: inline(p.why_short || "") }));
}

function renderPieges(body, pg) {
  body.append(h("div.grid2", {}, pg.map((p) => trapCard(p))));
}

// ---------------------------------------------------------------- domaine ingé

export function domainView(parts) {
  const dom = C.domains[parts[1]];
  const page = h("div.page.read");
  if (!dom) { page.append(h("h1", {}, "Domaine introuvable")); return page; }
  const all = [...dom.modules.flatMap((m) => C.modules[m].ex || []), ...(dom.quiz || [])];
  const ms = mastery(all);
  page.append(h("div.lesson-head", {},
    h("div.crumbs", {}, h("a", { href: "#/parcours/inge" }, "Culture ingé"), h("span", {}, "›"), h("span", {}, dom.title)),
    h("h1", {}, dom.title),
    dom.en ? h("div.en", {}, `EN · ${dom.en}`) : null,
    dom.intro ? h("div.prose.lg", { html: md(dom.intro) }) : null,
    h("div.row", {}, trackPill("inge"), h("span.pill", {}, plural(dom.modules.length, "notion", "notions")), h("span.pill", {}, plural(all.length, "question", "questions")),
      h("span.spacer"), h("div", { style: { width: "140px" } }, masteryBar(ms)))));
  page.append(h("div.mod-list", {}, dom.modules.map((mid, i) => modRow(mid, i + 1))));
  if (dom.quiz && dom.quiz.length) {
    const qm = mastery(dom.quiz);
    page.append(h("div.panel", { style: { marginTop: "18px" } }, h("div.row", {},
      h("div.stack.g4", {}, h("strong", {}, "Quiz du domaine"), h("span.small.muted", {}, `${dom.quiz.length} questions de culture ingé, avec explication. ${qm.seen} déjà vues.`)),
      h("span.spacer"), h("a.btn.primary", { href: `#/session/quiz/${dom.id}` }, "Lancer le quiz"))));
  }
  return page;
}

export function modRow(mid, n) {
  const m = C.modules[mid];
  const read = lessonRead(mid);
  const ms = mastery(m.ex || []);
  return h("a.mod-row", { href: `#/m/${mid}` },
    h(`span.idx${read ? ".done" : ""}`, {}, read ? "✓" : String(n).padStart(2, "0")),
    h("div.stack.g4", { style: { minWidth: 0 } },
      h("span.t", {}, m.title),
      m.goal ? h("span.g", {}, m.goal) : null),
    h("div.side", {},
      m.lesson ? h("span.xs.faint", {}, `${m.lesson.minutes || 8} min · ${plural((m.ex || []).length, "exo", "exos")}`) : h("span.xs.faint", {}, plural((m.ex || []).length, "exo", "exos")),
      masteryBar(ms)));
}

export { TRACK_LABEL };
