// Fiches : mémos, formulaire ingé (récapitulatifs des notions), glossaire français → anglais.
import { h, clear } from "../dom.js";
import { md, inline } from "../md.js";
import { C } from "../content.js";
import { go } from "../ui.js";

export function fichesView(parts) {
  const tab = parts[1] || "memos";
  const page = h("div.page.read");
  page.append(h("div.page-head", {}, h("div", {}, h("span.eyebrow", {}, "Aide-mémoire"), h("h1", {}, "Fiches"),
    h("p.sub", {}, "Tout ce qui se relit vite : mémos transverses, formules clés de chaque domaine, vocabulaire technique en anglais."))));
  page.append(h("div.tabs", {},
    [["memos", "Mémos"], ["formulaire", "Formulaire ingé"], ["glossaire", "Glossaire FR → EN"]].map(([k, l]) =>
      h(`button${tab === k ? ".on" : ""}`, { onclick: () => go(`#/fiches/${k}`) }, l))));
  if (tab === "formulaire") page.append(formulaire());
  else if (tab === "glossaire") page.append(glossaire());
  else page.append(memos());
  return page;
}

function memos() {
  return h("div.stack.g8", {}, (C.memos || []).map((m) =>
    h("a.mod-row", { href: `#/memo/${m.id}`, style: { gridTemplateColumns: "minmax(0,1fr) auto" } },
      h("div.stack.g4", {}, h("span.t", {}, m.title), h("span.g", {}, m.summary || "")),
      h("span.pill", {}, m.lang === "both" ? "Python + C++" : m.lang === "cpp" ? "C++" : m.lang === "inge" ? "Ingé" : "Python"))));
}

export function memoView(parts) {
  const m = (C.memos || []).find((x) => x.id === parts[1]);
  const page = h("div.page.read");
  if (!m) { page.append(h("h1", {}, "Mémo introuvable")); return page; }
  page.append(h("div.lesson-head", {},
    h("div.crumbs", {}, h("a", { href: "#/fiches" }, "Fiches"), h("span", {}, "›"), h("span", {}, "Mémo")),
    h("h1", {}, m.title), m.summary ? h("p.goal", {}, m.summary) : null));
  page.append(h("div.prose", { html: md(m.body) }));
  return page;
}

function formulaire() {
  const box = h("div.stack.g28");
  for (const g of C.tracks.inge.groups) {
    const items = g.modules.map((id) => C.modules[id]).filter((m) => m.lesson && m.lesson.recap && m.lesson.recap.length);
    if (!items.length) continue;
    box.append(h("div.stack.g10", {},
      h("div.group-head", { style: { margin: 0 } }, h("h2", {}, g.title), g.en ? h("span.en", {}, g.en) : null),
      ...items.map((m) => h("div.panel.pad-sm", {}, h("div.stack.g6", {},
        h("a", { href: `#/m/${m.id}`, style: { fontWeight: 600, textDecoration: "none" } }, m.title),
        h("ul.prose", { style: { margin: 0, paddingLeft: "1.2em" } }, m.lesson.recap.map((r) => h("li", { html: inline(r) }))))))));
  }
  if (!box.children.length) box.append(h("p.muted", {}, "Le formulaire se remplit avec les récapitulatifs des notions ingé."));
  return box;
}

function glossaire() {
  const rows = C.glossary || [];
  const box = h("div.stack.g14");
  const inp = h("input.field", { type: "search", placeholder: "Chercher un terme (français ou anglais)…", "aria-label": "Chercher dans le glossaire", id: "glossaire-q" });
  const count = h("span.xs.faint");
  const tbody = h("tbody");
  const norm = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  function draw() {
    const q = norm(inp.value.trim());
    const hits = rows.filter((r) => !q || norm(r[0]).includes(q) || norm(r[1]).includes(q));
    clear(tbody);
    hits.slice(0, 400).forEach((r) => tbody.append(h("tr", {},
      h("td", { html: inline(r[0]) }), h("td.mono", { html: inline(r[1]) }),
      h("td", {}, r[3] && C.modules[r[3]] ? h("a.small", { href: `#/m/${r[3]}` }, C.modules[r[3]].title) : h("span.small.muted", {}, r[2] || "")))));
    count.textContent = `${hits.length} terme${hits.length > 1 ? "s" : ""}`;
  }
  inp.addEventListener("input", draw);
  box.append(h("div.row", {}, h("div", { style: { flex: "1 1 260px" } }, inp), count),
    h("div.tbl-wrap", {}, h("table.data", {}, h("thead", {}, h("tr", {}, h("th", {}, "Français"), h("th", {}, "English"), h("th", {}, "Où"))), tbody)));
  draw();
  return box;
}
