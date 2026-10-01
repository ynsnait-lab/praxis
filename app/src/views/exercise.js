// Rendu et correction d'un exercice, quel que soit son type.
import { h, clear, esc } from "../dom.js";
import { md, codeHTML, inline } from "../md.js";
import { C, exLang, trackOfEx, TYPE_LABEL, EX_LEVEL } from "../content.js";
import { getState } from "../store.js";
import { python, runCpp } from "../runners.js";
import { trackPill } from "../ui.js";

const LETTERS = "ABCDEFGH";
const normExact = (s) =>
  String(s ?? "").replace(/\r/g, "").replace(/[‘’]/g, "'").replace(/[“”«»]/g, '"').split("\n").map((l) => l.trimEnd())
    .join("\n").replace(/^\n+|\n+$/g, "");
const normSpaces = (s) => normExact(s).replace(/\s+/g, "");
const normLoose = (s) => normSpaces(s).toLowerCase();
const LANG_NOM = { python: "Python", cpp: "C++" };
const sansGuillemets = (s) => String(s).replace(/["']/g, "");

// Pourquoi une réponse courte (un trou, une sortie) diffère de l'attendue, quand on peut le dire
// précisément : majuscules, guillemets. Renvoie du texte au format inline, ou null.
function diagnostic(donne, attendu, lang) {
  const d = String(donne).trim().replace(/\s+/g, " ").replace(/`/g, "ˋ");
  const a = String(attendu).trim().replace(/\s+/g, " ");
  if (!d || d === a) return null;
  if (d.toLowerCase() === a.toLowerCase()) {
    const qui = LANG_NOM[lang] ? `${LANG_NOM[lang]} distingue` : "ici, on distingue";
    return `seules les majuscules diffèrent, et ${qui} majuscules et minuscules : \`${d}\` et \`${a}\` ne sont pas le même nom.`;
  }
  if (sansGuillemets(d) === sansGuillemets(a)) {
    const qd = /["']/.test(d), qa = /["']/.test(a);
    if (qd && !qa) return "sans guillemets : avec, c'est un texte ; sans, c'est le nom d'une variable, et le programme utilise sa valeur.";
    if (!qd && qa) return "il faut des guillemets : ici on veut un texte, pas le nom d'une variable.";
    if (lang === "cpp") return "en C++, les guillemets simples entourent un caractère (`'A'`, un `char`) et les doubles une chaîne (`\"A\"`) : ils ne sont pas interchangeables.";
  }
  return null;
}

// En Python, 'texte' et "texte" sont la même chaîne : un trou qui attend l'un accepte l'autre.
function litteralPython(s) {
  const m = /^(['"])(.*)\1$/.exec(String(s).trim());
  return m ? m[2] : null;
}

function mdEl(src, cls = "prose") {
  return h(`div.${cls}`, { html: md(src) });
}

function codeEl(code, lang, opts) {
  return h("div", { html: codeHTML(code, lang, opts) }).firstElementChild;
}

function consoleBox(text, kind = "") {
  return h(`pre.console${kind ? "." + kind : ""}`, { text });
}

// Bandeau piège (rayures de danger) affiché après la réponse
function trapBanner(e, fell, customMsg) {
  const p = C.pieges[e.piege];
  if (!p) return null;
  return h("div.trap-banner", {},
    h("div.tt", {}, fell ? `Piège : ${p.title}` : `Piège évité : ${p.title}`),
    customMsg ? h("div.small", { html: inline(customMsg) }) : null,
    fell ? h("div.small.muted", { html: inline(p.why_short || "") }) : null,
    h("a.small", { href: `#/piege/${p.id}` }, fell ? "Comprendre ce piège" : "Revoir la fiche du piège"));
}

// ------------------------------------------------------------------ point d'entrée

export function renderExercise(e, { onDone, index, total } = {}) {
  const t0 = Date.now();
  const root = h("div.exo", { "data-ex": e.id });
  let hintUsed = false;
  let done = false;
  let easy = false;

  const meta = h("div.exo-meta", {},
    trackPill(trackOfEx(e)),
    h("span.pill", {}, TYPE_LABEL[e.type] || e.type),
    h("span.pill", {}, EX_LEVEL[e.level] || ""),
    e.mod && C.modules[e.mod] ? h("a.pill", { href: `#/m/${e.mod}`, style: { textDecoration: "none" } }, C.modules[e.mod].title)
      : (e.mod && e.mod.startsWith("quiz:") && C.domains[e.mod.slice(5)] ? h("span.pill", {}, C.domains[e.mod.slice(5)].title) : null),
    h("span.spacer"),
    total ? h("span.xs.faint.num", {}, `${index + 1} / ${total}`) : null);
  root.append(meta);
  root.append(h("div.exo-prompt.prose", { html: md(e.q) }));
  if (e.code && !["predict", "bug"].includes(e.type)) root.append(codeEl(e.code, exLang(e)));
  const body = h("div.stack.g14");
  root.append(body);
  const feedback = h("div");
  const actions = h("div.actions");
  root.append(actions, feedback);

  function hintButton() {
    if (!e.hint) return null;
    const b = h("button.btn.ghost.sm", {
      onclick: () => {
        hintUsed = true;
        b.replaceWith(h("div.panel.flat.pad-sm.small", { html: md("**Indice** — " + e.hint) }));
      },
    }, "Indice");
    return b;
  }

  // termine l'exercice : affiche la correction et le bouton « suivant »
  function finish(correct, { extra = null, fellMsg = null, selfGraded = false, attempts = 0, forceGrade = null, immediate = false, horsPiege = false } = {}) {
    if (done) return;
    done = true;
    const ms = Date.now() - t0;
    // horsPiege : la seule faute est de forme (des majuscules), pas le piège que l'exercice entraîne
    const piege = horsPiege ? null : e.piege || null;
    const fell = !!piege && !correct;
    const grade = forceGrade ?? (correct ? (hintUsed || attempts > 0 ? 2 : 3) : 1);
    if (immediate) {
      onDone && onDone({ correct, grade, hint: hintUsed, trap: piege, ms });
      return;
    }
    clear(actions);
    const fb = h(`div.feedback.${correct ? "ok" : "ko"}`, { role: "status" },
      h("div.verdict", {}, correct ? (grade === 2 ? "Juste (avec de l'aide)" : "Juste") : "Pas tout à fait"),
      extra,
      piege ? trapBanner(e, fell, fell ? fellMsg : null) : null,
      e.e ? mdEl(e.e) : null);
    clear(feedback).append(fb);
    const next = h("button.btn.primary", {
      onclick: () => onDone && onDone({ correct, grade: easy ? 4 : grade, hint: hintUsed, trap: piege, ms }),
    }, "Suivant ", h("span.kbd", {}, "↵"));
    const easyBtn = correct && !selfGraded && grade === 3
      ? h("button.btn.ghost.sm", {
        onclick: (ev) => { easy = !easy; ev.currentTarget.textContent = easy ? "Noté : trop facile" : "Trop facile ?"; },
        title: "Espace davantage les révisions de cet exercice",
      }, "Trop facile ?")
      : null;
    actions.append(next, easyBtn);
    root.dataset.done = "1";
    next.focus({ preventScroll: true });
    fb.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  const ctx = { e, body, actions, feedback, finish, hintButton, root };
  const R = RENDERERS[e.type];
  if (!R) body.append(h("p", {}, `Type d'exercice inconnu : ${e.type}`));
  else R(ctx);
  // raccourcis clavier
  root.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" && !ev.shiftKey && done && !(ev.target instanceof HTMLTextAreaElement)) {
      const b = actions.querySelector(".btn.primary");
      if (b) { ev.preventDefault(); b.click(); }
    }
  });
  return root;
}

// ------------------------------------------------------------------ types

const RENDERERS = {
  qcm({ e, body, actions, finish, hintButton }) {
    const multi = !!e.multi;
    const picked = new Set();
    const order = e.shuffle === false ? e.choices.map((_, i) => i) : shuffleIdx(e.choices.length);
    const btns = order.map((ci, k) => {
      const c = e.choices[ci];
      const b = h("button.choice", { type: "button", "data-i": ci },
        h("span.key", {}, LETTERS[k]),
        h("span.body", {}, h("span", { html: inline(c.t) })));
      b.addEventListener("click", () => {
        if (b.disabled) return;
        if (multi) {
          if (picked.has(ci)) { picked.delete(ci); b.classList.remove("picked"); } else { picked.add(ci); b.classList.add("picked"); }
          validate.disabled = picked.size === 0;
        } else {
          picked.clear();
          picked.add(ci);
          check();
        }
      });
      return b;
    });
    body.append(multi ? h("p.small.muted", {}, "Plusieurs réponses possibles — coche toutes les bonnes puis valide.") : null,
      h("div.choices", {}, btns));
    const validate = h("button.btn.primary", { disabled: true, onclick: () => check() }, "Valider");
    if (multi) actions.append(validate);
    actions.append(hintButton());
    function check() {
      const good = new Set(e.choices.map((c, i) => (c.ok ? i : -1)).filter((i) => i >= 0));
      const correct = good.size === picked.size && [...good].every((i) => picked.has(i));
      let fellMsg = null;
      btns.forEach((b) => {
        const ci = +b.dataset.i;
        const c = e.choices[ci];
        b.disabled = true;
        if (c.ok) b.classList.add("good");
        else if (picked.has(ci)) { b.classList.add("bad"); if (c.piege) fellMsg = c.why || null; }
        else b.classList.add("dim");
        if (c.why) b.querySelector(".body").append(h("div.why", { html: inline(c.why) }));
      });
      finish(correct, { fellMsg });
    }
    root_keys(body, btns, () => (multi ? validate : null));
  },

  predict({ e, body, actions, finish, hintButton }) {
    const lang = exLang(e);
    body.append(codeEl(e.code, lang));
    const ta = h("textarea.field.mono", { rows: Math.min(8, Math.max(2, String(e.answer).split("\n").length + 1)), placeholder: "Ce que le programme affiche, exactement…", spellcheck: "false", autocapitalize: "off", "aria-label": "Sortie prédite" });
    body.append(h("label.eyebrow", {}, "Sortie"), ta);
    const btn = h("button.btn.primary", { onclick: () => check() }, "Valider ", h("span.kbd", {}, "⌘↵"));
    actions.append(btn, hintButton());
    ta.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" && (ev.metaKey || ev.ctrlKey)) { ev.preventDefault(); check(); }
    });
    setTimeout(() => ta.focus({ preventScroll: true }), 30);
    function check() {
      const given = ta.value;
      if (!given.trim()) { ta.focus(); return; }
      const answers = [e.answer, ...(e.accept || [])];
      let correct = answers.some((a) => normExact(a) === normExact(given));
      let note = null;
      if (!correct && answers.some((a) => normSpaces(a) === normSpaces(given))) {
        correct = true;
        note = "Accepté aux espaces près — la sortie exacte est :";
      }
      const casse = !correct && answers.some((a) => normLoose(a) === normLoose(given));
      let fellMsg = null;
      if (!correct && e.trap_answers && e.trap_answers.some((a) => normLoose(a) === normLoose(given))) {
        fellMsg = "Ta réponse est exactement celle que donne l'intuition piégée.";
      }
      ta.readOnly = true;
      const extra = h("div.stack.g6", {},
        casse ? h("p.small", { html: inline("**Presque** : seules les majuscules diffèrent. Une sortie se recopie exactement : `True` et `true`, ce n'est pas la même chose.") }) : null,
        h("span.eyebrow", {}, note || (correct ? "Sortie" : "Sortie réelle")),
        consoleBox(e.answer, correct ? "pass" : ""));
      finish(correct, { extra, fellMsg, horsPiege: casse });
    }
  },

  cloze({ e, body, actions, finish, hintButton }) {
    const lang = exLang(e);
    const parts = String(e.tpl).split(/⟦(\d+)⟧/);
    const inputs = [];
    const pre = h("pre.code-block.plain.cloze-code", {});
    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 0) {
        const span = h("span", { html: highlightInline(parts[i], lang) });
        pre.append(span);
      } else {
        const k = +parts[i];
        const ans = e.blanks[k] || [""];
        const w = Math.max(4, ...ans.map((a) => String(a).length)) + 1;
        const inp = h("input.blank", { type: "text", size: w, spellcheck: "false", autocapitalize: "off", autocorrect: "off", autocomplete: "off", "aria-label": `trou ${inputs.length + 1}` });
        inp.dataset.k = k;
        inputs.push(inp);
        pre.append(inp);
      }
    }
    body.append(pre);
    const btn = h("button.btn.primary", { onclick: () => check() }, "Valider");
    actions.append(btn, hintButton());
    inputs.forEach((inp, i) => inp.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") { ev.preventDefault(); if (i < inputs.length - 1) inputs[i + 1].focus(); else check(); }
    }));
    setTimeout(() => inputs[0] && inputs[0].focus({ preventScroll: true }), 30);
    function check() {
      let all = true;
      const n = (s) => String(s).trim().replace(/\s+/g, " ");
      const fautes = [];
      let formeSeule = true;
      inputs.forEach((inp, i) => {
        const attendus = e.blanks[+inp.dataset.k] || [""];
        const lit = lang === "python" ? litteralPython(inp.value) : null;
        const ok = attendus.some((a) => n(a) === n(inp.value) || (lit !== null && lit === litteralPython(a)));
        inp.classList.add(ok ? "good" : "bad");
        inp.readOnly = true;
        if (ok) return;
        all = false;
        inp.title = `Attendu : ${attendus[0]}`;
        const pourquoi = attendus.map((a) => diagnostic(inp.value, a, lang)).find(Boolean);
        if (!attendus.some((a) => n(a).toLowerCase() === n(inp.value).toLowerCase())) formeSeule = false;
        const ecrit = n(inp.value) ? `tu as écrit \`${n(inp.value).replace(/`/g, "ˋ")}\`` : "laissé vide";
        fautes.push(`**Trou ${i + 1}** : ${ecrit}, il fallait \`${attendus[0]}\`${pourquoi ? ` — ${pourquoi}` : "."}`);
      });
      const filled = String(e.tpl).replace(/⟦(\d+)⟧/g, (_, k) => e.blanks[+k][0]);
      const justes = inputs.length - fautes.length;
      const extra = all ? null : h("div.stack.g10", {},
        h("div.stack.g6", {},
          h("span.eyebrow", {}, fautes.length > 1 ? "Les trous à revoir" : "Le trou à revoir"),
          h("ul.prose.small", { style: { margin: 0, paddingLeft: "1.2em" } }, fautes.map((f) => h("li", { html: inline(f) }))),
          justes ? h("p.small.muted", { style: { margin: 0 } }, justes > 1 ? "Les autres trous sont justes." : "L'autre trou est juste.") : null),
        h("div.stack.g6", {}, h("span.eyebrow", {}, "Version complète"), codeEl(filled, lang)));
      finish(all, { extra, horsPiege: !all && formeSeule });
    }
  },

  bug({ e, body, actions, finish, hintButton }) {
    const lang = exLang(e);
    const el = codeEl(e.code, lang, { gutter: true });
    let sel = null;
    const lines = [...el.querySelectorAll(".ln")];
    lines.forEach((ln) => {
      ln.classList.add("pick");
      ln.tabIndex = 0;
      ln.setAttribute("role", "button");
      ln.setAttribute("aria-label", `ligne ${ln.dataset.n}`);
      const pick = () => {
        if (done) return;
        lines.forEach((l) => l.classList.remove("sel"));
        ln.classList.add("sel");
        sel = +ln.dataset.n;
        btn.disabled = false;
      };
      ln.addEventListener("click", pick);
      ln.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); pick(); } });
    });
    let done = false;
    body.append(h("p.small.muted", {}, "Clique sur la ligne fautive, puis valide."), el);
    const btn = h("button.btn.primary", { disabled: true, onclick: () => check() }, "Valider");
    actions.append(btn, hintButton());
    function check() {
      done = true;
      const correct = sel === +e.bad;
      lines.forEach((l) => l.classList.remove("pick", "sel"));
      lines[+e.bad - 1].classList.add("good");
      if (!correct && sel) lines[sel - 1].classList.add("wrong");
      const extra = h("div.stack.g6", {}, h("span.eyebrow", {}, `Correction de la ligne ${e.bad}`), codeEl(e.fix, lang, { gutter: false }));
      finish(correct, { extra });
    }
  },

  flash({ e, body, actions, finish }) {
    const back = h("div.stack.g14", { hidden: true }, mdEl(e.back), e.e ? mdEl(e.e) : null);
    const card = h("div.flash-card", {}, h("span.eyebrow", {}, "Réponds dans ta tête, puis retourne la carte"), back);
    body.append(card);
    let row = null;
    const flip = h("button.btn.primary", {
      onclick: () => {
        back.hidden = false;
        flip.remove();
        const grades = [
          [1, "À revoir", "raté"], [2, "Difficile", "avec effort"], [3, "Correct", "sans hésiter"], [4, "Facile", "évident"],
        ];
        // les cartes mémo sont notées par l'utilisateur lui-même
        row = h("div.grade-row", { style: { width: "100%" } }, grades.map(([g, l, s]) =>
          h(`button.btn${g === 3 ? ".primary" : ""}`, {
            "data-grade": g,
            onclick: () => finish(g >= 2, { selfGraded: true, forceGrade: g, immediate: true }),
          }, h("span", {}, l), h("small", {}, `${g} · ${s}`))));
        actions.append(row);
        row.querySelector(".btn.primary").focus({ preventScroll: true });
      },
    }, "Retourner la carte ", h("span.kbd", {}, "espace"));
    actions.append(flip);
    setTimeout(() => flip.focus({ preventScroll: true }), 30);
    const onKey = (ev) => {
      if (!document.body.contains(body)) return document.removeEventListener("keydown", onKey);
      if (ev.target instanceof HTMLInputElement || ev.target instanceof HTMLTextAreaElement) return;
      if (ev.key === " " && back.hidden) { ev.preventDefault(); flip.click(); }
      else if (row && "1234".includes(ev.key)) { ev.preventDefault(); row.querySelector(`[data-grade="${ev.key}"]`).click(); }
    };
    document.addEventListener("keydown", onKey);
  },

  parsons({ e, body, actions, finish, hintButton }) {
    const lang = exLang(e);
    const all = [...e.lines.map((t, i) => ({ t, k: i, extra: false })), ...(e.extra || []).map((t, i) => ({ t, k: 100 + i, extra: true }))];
    const pool = shuffle(all.slice());
    const chosen = [];
    const zPool = h("div.zone", { "aria-label": "Lignes disponibles" });
    const zSol = h("div.zone.sol", { "aria-label": "Ton programme" });
    body.append(h("p.small.muted", {}, "Clique les lignes dans l'ordre pour reconstruire le programme. Attention : certaines lignes sont des intrus. Clique une ligne de ton programme pour la retirer."),
      h("div.parsons", {}, h("div.stack.g6", {}, h("span.eyebrow", {}, "Lignes"), zPool), h("div.stack.g6", {}, h("span.eyebrow", {}, "Ton programme"), zSol)));
    let locked = false;
    function draw() {
      clear(zPool);
      clear(zSol);
      pool.forEach((it) => {
        if (chosen.includes(it)) return;
        zPool.append(h("button.pline", { type: "button", onclick: () => { if (!locked) { chosen.push(it); draw(); } }, html: highlightInline(it.t, lang) || " " }));
      });
      chosen.forEach((it, i) => {
        zSol.append(h("button.pline", { type: "button", "data-i": i, onclick: () => { if (!locked) { chosen.splice(i, 1); draw(); } }, html: highlightInline(it.t, lang) || " " }));
      });
      btn.disabled = chosen.length === 0;
    }
    const btn = h("button.btn.primary", { disabled: true, onclick: () => check() }, "Valider");
    const reset = h("button.btn.ghost.sm", { onclick: () => { if (!locked) { chosen.length = 0; draw(); } } }, "Tout retirer");
    actions.append(btn, reset, hintButton());
    draw();
    function check() {
      locked = true;
      const correct = chosen.length === e.lines.length && chosen.every((it, i) => !it.extra && it.t === e.lines[i]);
      [...zSol.children].forEach((b, i) => {
        const it = chosen[i];
        b.disabled = true;
        b.classList.add(!it.extra && it.t === e.lines[i] ? "good" : "bad");
        if (it.extra) b.classList.add("extra");
      });
      [...zPool.children].forEach((b) => { b.disabled = true; });
      const extra = correct ? null : h("div.stack.g6", {}, h("span.eyebrow", {}, "Ordre correct"), codeEl(e.lines.join("\n"), lang));
      finish(correct, { extra });
    }
  },

  numeric({ e, body, actions, finish, hintButton }) {
    const inp = h("input.field", { type: "text", inputmode: "decimal", placeholder: "ta réponse", autocomplete: "off", "aria-label": "Réponse numérique" });
    body.append(h("div.numeric-row", {}, inp, e.unit ? h("span.unit", { html: inline(e.unit) }) : null));
    const btn = h("button.btn.primary", { onclick: () => check() }, "Valider");
    actions.append(btn, hintButton());
    inp.addEventListener("keydown", (ev) => { if (ev.key === "Enter") { ev.preventDefault(); check(); } });
    setTimeout(() => inp.focus({ preventScroll: true }), 30);
    function check() {
      const v = parseNumber(inp.value);
      if (v === null) { inp.focus(); inp.select(); return; }
      const ans = +e.answer;
      const tol = e.tol ?? 0.02;
      const correct = ans === 0 ? Math.abs(v) <= tol : Math.abs(v - ans) <= tol * Math.abs(ans);
      inp.readOnly = true;
      let fellMsg = null;
      if (!correct && e.trap_values) {
        const hit = e.trap_values.find((tv) => Math.abs(v - tv.v) <= tol * Math.abs(tv.v || 1));
        if (hit) fellMsg = hit.why;
      }
      const extra = h("div.row", {}, h("span.eyebrow", {}, "Réponse"),
        h("span.num", { html: `${fmtNum(ans)} ${e.unit ? inline(e.unit) : ""}` }),
        h("span.xs.faint", {}, `(tolérance ±${Math.round(tol * 1000) / 10} %)`));
      finish(correct, { extra, fellMsg });
    }
  },

  code({ e, body, actions, finish, hintButton, root }) {
    const lang = exLang(e);
    const st = getState();
    const ta = h("textarea", { spellcheck: "false", autocapitalize: "off", autocomplete: "off", rows: Math.max(8, String(e.start).split("\n").length + 3), "aria-label": "Ton code" });
    ta.value = e.start;
    tabify(ta);
    const runBtn = h("button.btn.sm", { onclick: () => exec(false) }, "▶ Exécuter");
    const bar = h("div.editor-bar", {}, h("span", {}, lang === "cpp" ? "c++" : "python"), h("span.spacer"), h("span.faint", {}, "Tab indente · ⌘/Ctrl+↵ vérifie"));
    body.append(h("div.editor", {}, bar, ta));
    const out = h("div.stack.g8");
    body.append(out);
    let attempts = 0;
    const canRun = lang === "python" || st.settings.cppRunner === "godbolt";
    const verify = h("button.btn.primary", { onclick: () => exec(true) }, canRun ? "Vérifier" : "Comparer avec la solution");
    const sol = h("button.btn.ghost.sm", { onclick: () => giveUp() }, "Voir la solution");
    actions.append(verify, canRun ? runBtn : null, sol, hintButton());
    ta.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" && (ev.metaKey || ev.ctrlKey)) { ev.preventDefault(); exec(true); }
    });
    if (lang === "python") python.ensure().catch(() => {});

    async function exec(withTests) {
      if (!canRun) return selfCheck();
      const code = ta.value + (withTests ? "\n\n" + e.tests : "");
      clear(out).append(consoleBox(lang === "python" && python.state !== "ready" ? "Chargement de Python dans le navigateur (une fois, ~12 Mo)…" : withTests ? "Vérification…" : "Exécution…"));
      verify.disabled = runBtn.disabled = true;
      const r = lang === "python" ? await python.run(code) : await runCpp(code);
      verify.disabled = runBtn.disabled = false;
      if (r.unavailable) {
        clear(out).append(consoleBox(`${r.err}\n\nL'exécution n'est pas disponible ici. Compare ta solution à la référence.`, "err"));
        return selfCheck();
      }
      const text = [r.out, r.err].filter(Boolean).join("\n").trim();
      if (!withTests) {
        clear(out).append(consoleBox(text || "(rien d'affiché)", r.ok ? "" : "err"));
        return;
      }
      const passed = r.ok && /(^|\s)OK(\s|$)/.test(r.out || "");
      if (passed) {
        clear(out).append(consoleBox((text || "OK") + "\n\n✓ Tous les tests passent.", "pass"));
        ta.readOnly = true;
        const extra = h("div.stack.g6", {}, h("span.eyebrow", {}, "Solution de référence"), codeEl(e.sol, lang));
        finish(true, { extra, attempts });
      } else {
        attempts++;
        clear(out).append(consoleBox(text || "Les tests échouent sans message.", "err"),
          h("p.small.muted", {}, attempts >= 2 ? "Relis l'énoncé ligne par ligne, ou demande un indice." : "Corrige et revérifie. Chaque assert qui échoue te dit quel cas ne marche pas."));
      }
    }
    function selfCheck() {
      ta.readOnly = true;
      clear(actions);
      out.append(h("div.stack.g6", {}, h("span.eyebrow", {}, "Solution de référence"), codeEl(e.sol, lang)),
        h("div.stack.g6", {}, h("span.eyebrow", {}, "Tests qu'elle doit passer"), codeEl(e.tests, lang)),
        h("p.small", {}, "Compare honnêtement : ta version aurait-elle passé tous ces tests ?"));
      actions.append(
        h("button.btn.primary", { onclick: () => finish(true, { selfGraded: true }) }, "Oui, ma version était juste"),
        h("button.btn", { onclick: () => finish(false, { selfGraded: true }) }, "Non, il y avait des erreurs"));
    }
    function giveUp() {
      ta.readOnly = true;
      const extra = h("div.stack.g6", {}, h("span.eyebrow", {}, "Solution de référence"), codeEl(e.sol, lang));
      finish(false, { extra });
    }
  },
};

// ------------------------------------------------------------------ utilitaires

function root_keys(body, btns, validateFn) {
  body.closest?.(".exo");
  const handler = (ev) => {
    if (ev.target instanceof HTMLInputElement || ev.target instanceof HTMLTextAreaElement) return;
    const k = ev.key.toUpperCase();
    const idx = "1234".includes(k) ? +k - 1 : LETTERS.indexOf(k);
    if (idx >= 0 && idx < btns.length && !btns[idx].disabled) { ev.preventDefault(); btns[idx].click(); }
    else if (ev.key === "Enter" && validateFn && validateFn() && !validateFn().disabled) { ev.preventDefault(); validateFn().click(); }
  };
  document.addEventListener("keydown", handler);
  const obs = new MutationObserver(() => {
    if (!document.body.contains(body)) { document.removeEventListener("keydown", handler); obs.disconnect(); }
  });
  obs.observe(document.body, { childList: true, subtree: true });
}

function highlightInline(text, lang) {
  // codeHTML retire les retours à la ligne de fin : on les remet, sinon un trou en début de ligne
  // se retrouve collé à la ligne précédente.
  const fin = String(text).match(/\n*$/)[0];
  return codeHTML(text, lang, { gutter: false, tag: "" }).replace(/^<pre class="code-block plain">/, "").replace(/<\/pre>$/, "") + fin;
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function shuffleIdx(n) { return shuffle([...Array(n).keys()]); }

export function parseNumber(s) {
  let t = String(s || "").trim().replace(/\s| | /g, "").replace(",", ".").replace(/×10\^?/i, "e").replace(/·10\^?/, "e");
  t = t.replace(/[⁻]/g, "-").replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (c) => "⁰¹²³⁴⁵⁶⁷⁸⁹".indexOf(c));
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(t)) return null;
  const v = parseFloat(t);
  return Number.isFinite(v) ? v : null;
}

export function fmtNum(x) {
  if (!Number.isFinite(x)) return String(x);
  const a = Math.abs(x);
  if (a !== 0 && (a >= 1e6 || a < 1e-3)) {
    const [m, ex] = x.toExponential(3).split("e");
    return `${m.replace(/\.?0+$/, "").replace(".", ",")} × 10^${+ex}`.replace("10^", "10").replace(/10(-?\d+)$/, (_, p) => `10<sup>${p}</sup>`);
  }
  return x.toLocaleString("fr-FR", { maximumSignificantDigits: 4 });
}

function tabify(ta) {
  ta.addEventListener("keydown", (ev) => {
    if (ev.key === "Tab") {
      ev.preventDefault();
      const { selectionStart: s, selectionEnd: en, value: v } = ta;
      if (ev.shiftKey) {
        const ls = v.lastIndexOf("\n", s - 1) + 1;
        if (v.slice(ls, ls + 4) === "    ") { ta.value = v.slice(0, ls) + v.slice(ls + 4); ta.selectionStart = ta.selectionEnd = Math.max(ls, s - 4); }
      } else {
        ta.value = v.slice(0, s) + "    " + v.slice(en);
        ta.selectionStart = ta.selectionEnd = s + 4;
      }
    } else if (ev.key === "Enter" && !ev.metaKey && !ev.ctrlKey) {
      const { selectionStart: s, value: v } = ta;
      const ls = v.lastIndexOf("\n", s - 1) + 1;
      const indent = (v.slice(ls, s).match(/^\s*/) || [""])[0];
      const extra = /[:{]\s*$/.test(v.slice(ls, s)) ? "    " : "";
      ev.preventDefault();
      ta.value = v.slice(0, s) + "\n" + indent + extra + v.slice(ta.selectionEnd);
      ta.selectionStart = ta.selectionEnd = s + 1 + indent.length + extra.length;
    }
  });
}

export { esc };
