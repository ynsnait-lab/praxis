// Labs : exercices à coder sur ta machine (VS Code, pytest, compilateur, sanitizers) et défis longs.
// Le contenu vient des dossiers labs/*/ (lab.json + README.md), assemblé par tools/content.py.
import { h } from "../dom.js";
import { md, inline } from "../md.js";
import { C } from "../content.js";
import { getState, update } from "../store.js";
import { trackPill, copyText, toast } from "../ui.js";

const GROUPES = [
  { titre: "Python · labs guidés", test: (l) => l.kind !== "defi" && l.lang === "python" },
  { titre: "C++ · labs guidés", test: (l) => l.kind !== "defi" && l.lang === "cpp" },
  { titre: "Défis", test: (l) => l.kind === "defi", note: "Plus longs, moins guidés : un contrat, des tests, et des critères à cocher toi-même." },
];

export function labsView() {
  const page = h("div.page");
  const st = getState();
  const labs = C.labs || [];
  const done = labs.filter((l) => st.labs[l.id]).length;
  page.append(h("div.page-head", {}, h("div", {},
    h("span.eyebrow", {}, "Sur ta machine"), h("h1", {}, "Labs"),
    h("p.sub", { html: inline("Les vrais outils : ton éditeur, le terminal, pytest, le compilateur avec ses avertissements et les sanitizers. Chaque lab a un énoncé, du code de départ et des tests : tu as fini quand `./praxis check` est vert.") }))));
  page.append(h("div.panel", {}, h("div.stack.g14", {},
    h("div.row", {}, h("h3", {}, "Démarrer"), h("span.spacer"), C.repo && C.repo.url ? h("a.small", { href: C.repo.url, target: "_blank", rel: "noopener" }, "le dépôt GitHub") : null),
    h("div.prose", { html: md(C.labsIntro || "") }))));
  page.append(h("div.row", { style: { marginTop: "22px" } }, h("span.xs.faint", {}, `${done} / ${labs.length} terminés`)));
  for (const g of GROUPES) {
    const items = labs.filter(g.test);
    if (!items.length) continue;
    const faits = items.filter((l) => st.labs[l.id]).length;
    page.append(h("div.group-head", { style: { marginTop: "18px" } }, h("h2", {}, g.titre), h("span.xs.faint", {}, `${faits} / ${items.length}`)));
    if (g.note) page.append(h("p.small.muted", { style: { margin: "0 0 10px" } }, g.note));
    page.append(h("div.stack.g8", {}, items.map(labRow)));
  }
  return page;
}

function labRow(l) {
  const st = getState();
  const isDone = !!st.labs[l.id];
  const cmd = `./praxis check ${l.id}`;
  const cours = (l.modules || []).filter((id) => C.modules[id]);
  const details = h("div.stack.g10.lab-details", { hidden: true },
    h("p.xs.muted", { style: { margin: 0 } },
      "Dossier ", h("code.inline", {}, `labs/${l.dir}/`),
      cours.length ? " · Cours liés : " : null,
      cours.map((id, i) => [i ? ", " : null, h("a", { href: `#/m/${id}` }, C.modules[id].title)])),
    l.readme ? h("div.prose.small", { html: md(l.readme) }) : null,
    l.criteria && l.criteria.length ? h("div.stack.g6", {}, h("span.eyebrow", {}, "Critères de réussite"),
      ...l.criteria.map((c, i) => critRow(l.id, i, c))) : null,
    h("p.xs.faint", {}, "Bloqué ? ", h("code.inline", {}, `./praxis hint ${l.id}`), " donne les indices un par un ; ",
      h("code.inline", {}, `./praxis solution ${l.id}`), " compare ta version à la solution, après un premier essai."));
  const toggle = h("button.btn.ghost.sm", { "aria-expanded": "false", onclick: () => {
    details.hidden = !details.hidden;
    toggle.textContent = details.hidden ? "Énoncé" : "Masquer";
    toggle.setAttribute("aria-expanded", String(!details.hidden));
  } }, "Énoncé");
  return h("div.lab-row", {},
    h("div.stack.g6", { style: { minWidth: 0 } },
      h("div.row.tight", {}, trackPill(l.lang), h("span.pill", {}, l.kind === "defi" ? "Défi" : "Lab"), l.level ? h("span.pill", {}, l.level) : null,
        ...(l.tools || []).map((t) => h("span.pill.info", {}, t)), l.minutes ? h("span.xs.faint", {}, `~${l.minutes} min`) : null),
      h("span.t", {}, `${l.id} · ${l.title}`),
      h("span.small.muted", { html: inline(l.summary || "") }),
      h("div.row.tight", {},
        h("code.inline", {}, cmd),
        h("button.btn.ghost.sm", { onclick: async () => toast((await copyText(cmd)) ? "Commande copiée" : "Copie impossible ici : sélectionne la commande") }, "Copier"),
        l.readme ? toggle : null)),
    h("label.check-row", {}, h("input", {
      type: "checkbox", id: `lab-${l.id}`, checked: isDone,
      onchange: (e) => update((s) => { if (e.target.checked) s.labs[l.id] = Date.now(); else delete s.labs[l.id]; }),
    }), h("span.small", {}, "fait")),
    details);
}

function critRow(labId, i, text) {
  const key = `${labId}#${i}`;
  const st = getState();
  return h("label.check-row.small", {},
    h("input", { type: "checkbox", id: `crit-${labId}-${i}`, checked: !!st.defis[key], onchange: (e) => update((s) => { if (e.target.checked) s.defis[key] = Date.now(); else delete s.defis[key]; }) }),
    h("span", { html: inline(text) }));
}
