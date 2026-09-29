// Carnet de pièges : catalogue, statut (tombé / en progrès / déjoué), fiche détaillée.
import { h } from "../dom.js";
import { md, codeHTML, inline } from "../md.js";
import { C, TRACKS, TRACK_LONG } from "../content.js";
import { getState, trapStatus } from "../store.js";
import { trapCard } from "./module.js";
import { trackPill, go } from "../ui.js";

const ST_LABEL = { tombe: "tombé dedans", progres: "en progrès", deja: "déjoué", neuf: "pas encore croisé" };

export function piegesView(parts) {
  const filter = TRACKS.includes(parts[1]) ? parts[1] : "all";
  const page = h("div.page");
  const all = C.piegeOrder.map((id) => C.pieges[id]);
  const counts = { tombe: 0, progres: 0, deja: 0, neuf: 0 };
  for (const p of all) counts[trapStatus(p.id)]++;
  page.append(h("div.page-head", {},
    h("div", {}, h("span.eyebrow", {}, "Carnet"), h("h1", {}, "Pièges"),
      h("p.sub", {}, "Les erreurs que font presque tous les débutants — et pas mal de confirmés. Les exercices piégés ne te préviennent pas : tu tombes dedans ou pas. Ceux où tu tombes reviennent plus souvent, jusqu'à ce que tu les déjoues deux fois de suite.")),
    h("div.seg", {}, [["all", "Tous"], ...TRACKS.map((t) => [t, TRACK_LONG[t]])].map(([k, l]) =>
      h(`button${k === filter ? ".on" : ""}`, { onclick: () => go(k === "all" ? "#/pieges" : `#/pieges/${k}`) }, l)))));
  page.append(h("div.kpis", { style: { marginBottom: "22px" } },
    ["tombe", "progres", "deja", "neuf"].map((k) => h("div.kpi", {}, h("div.v", {}, String(counts[k])), h("div.l", {}, ST_LABEL[k])))));
  for (const t of TRACKS) {
    if (filter !== "all" && filter !== t) continue;
    const list = all.filter((p) => p.track === t);
    if (!list.length) continue;
    const order = { tombe: 0, progres: 1, neuf: 2, deja: 3 };
    list.sort((a, b) => order[trapStatus(a.id)] - order[trapStatus(b.id)]);
    page.append(h("div.group-head", {}, h("h2", {}, TRACK_LONG[t]), h("span.xs.faint", {}, `${list.length} pièges`)));
    page.append(h("div.grid2", {}, list.map((p) => trapCard(p.id))));
  }
  return page;
}

export function piegeView(parts) {
  const p = C.pieges[parts[1]];
  const page = h("div.page.read");
  if (!p) { page.append(h("h1", {}, "Piège introuvable")); return page; }
  const st = trapStatus(p.id);
  const t = getState().traps[p.id] || { fell: 0, avoided: 0 };
  const exs = Object.values(C.ex).filter((e) => e.piege === p.id);
  const lang = p.lang || (p.track === "cpp" ? "cpp" : p.track === "python" ? "python" : "text");
  const mods = (p.modules || []).filter((m) => C.modules[m]);
  page.append(h("div.lesson-head", {},
    h("div.crumbs", {}, h("a", { href: "#/pieges" }, "Pièges"), h("span", {}, "›"), h("span", {}, TRACK_LONG[p.track])),
    h("h1", {}, p.title),
    p.en ? h("div.en", {}, `EN · ${p.en}`) : null,
    h("div.row", {}, trackPill(p.track), h(`span.pill.${{ tombe: "bad", progres: "warn", deja: "ok", neuf: "x" }[st]}`, {}, ST_LABEL[st]),
      t.fell || t.avoided ? h("span.xs.faint", {}, `tombé ${t.fell} fois · évité ${t.avoided} fois`) : null)));
  const sec = (title, src) => (src ? h("div.stack.g8", {}, h("span.eyebrow", {}, title), h("div.prose", { html: md(src) })) : null);
  page.append(h("div.stack.g20", {},
    sec("Le symptôme", p.symptom),
    p.bad ? h("div.stack.g8", {}, h("span.eyebrow", {}, p.track === "inge" ? "Le calcul piégé" : "Le code piégé"), h("div", { html: codeHTML(p.bad, lang) })) : null,
    sec("Pourquoi ça arrive", p.why),
    p.good ? h("div.stack.g8", {}, h("span.eyebrow", {}, p.track === "inge" ? "Le bon raisonnement" : "La bonne version"), h("div", { html: codeHTML(p.good, lang) })) : null,
    sec("Le réflexe à prendre", p.fix),
    mods.length ? h("div.stack.g8", {}, h("span.eyebrow", {}, "Expliqué dans"), h("div.row", {}, mods.map((m) => h("a.btn.sm", { href: `#/m/${m}` }, C.modules[m].title)))) : null,
    h("div.actions", {},
      exs.length ? h("a.btn.primary", { href: `#/session/trap/${p.id}` }, `M'entraîner sur ce piège (${exs.length})`) : h("span.small.muted", {}, "Pas encore d'exercice dédié à ce piège."),
      h("a.btn.ghost", { href: "#/pieges" }, "Retour au carnet"))));
  return page;
}

export { inline };
