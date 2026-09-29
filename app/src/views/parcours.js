// Parcours : modules par piste (Fondations → Avancé) et domaines de culture ingé.
import { h } from "../dom.js";
import { C, TRACKS, TRACK_LONG, lessonRead } from "../content.js";
import { mastery } from "../engine.js";
import { modRow } from "./module.js";
import { masteryBar, plural, go } from "../ui.js";

function groupStats(g) {
  const mods = g.modules;
  const all = mods.flatMap((m) => C.modules[m].ex || []).concat(g.quiz || []);
  return {
    ms: mastery(all),
    read: mods.filter((m) => C.modules[m].lesson && lessonRead(m)).length,
    withLesson: mods.filter((m) => C.modules[m].lesson).length,
  };
}

function domTile(g) {
  const { ms, read, withLesson } = groupStats(g);
  return h("button.dom-tile", {
    type: "button",
    onclick: () => document.getElementById(`dom-${g.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }),
  },
  h("span.t", {}, g.title),
  h("span.m", {}, `${read}/${withLesson} cours lus`),
  masteryBar(ms));
}

export function parcoursView(parts) {
  const track = TRACKS.includes(parts[1]) ? parts[1] : "python";
  const page = h("div.page");
  const T = C.tracks[track];
  page.append(h("div.page-head", {},
    h("div", {}, h("span.eyebrow", {}, "Parcours"), h("h1", {}, TRACK_LONG[track]), T.desc ? h("p.sub", {}, T.desc) : null),
    h("div.seg", { role: "tablist" }, TRACKS.map((t) =>
      h(`button${t === track ? ".on" : ""}`, { role: "tab", "aria-selected": t === track ? "true" : "false", onclick: () => go(`#/parcours/${t}`) }, TRACK_LONG[t])))));

  const renderGroup = (g) => {
    const mods = g.modules;
    const { ms, read, withLesson } = groupStats(g);
    const head = h("div.group-head", { id: track === "inge" ? `dom-${g.id}` : null },
      track === "inge" ? h("a", { href: `#/d/${g.id}`, style: { color: "inherit", textDecoration: "none" } }, h("h2", {}, g.title)) : h("h2", {}, g.title),
      g.en ? h("span.en", {}, g.en) : null,
      h("span.xs.faint", {}, withLesson ? `${read}/${withLesson} cours lus` : plural(mods.length, "module", "modules")),
      h("span.spacer"),
      h("div", { style: { width: "130px" } }, masteryBar(ms)));
    page.append(head);
    if (g.desc) page.append(h("p.small.muted", { style: { margin: "-4px 0 12px", maxWidth: "70ch" } }, g.desc));
    page.append(h("div.mod-list", {}, mods.map((m, i) => modRow(m, i + 1))));
    if (track === "inge" && g.quiz && g.quiz.length) {
      page.append(h("div.row", { style: { marginTop: "8px" } },
        h("a.btn.sm", { href: `#/session/quiz/${g.id}` }, `Quiz du domaine · ${g.quiz.length} questions`)));
    }
  };

  const fams = track === "inge" ? (T.families || []) : [];
  if (fams.length) {
    const byId = Object.fromEntries(T.groups.map((g) => [g.id, g]));
    page.append(h("nav.dom-toc", { "aria-label": "Sommaire des domaines" }, fams.map((f) =>
      h("div.dom-fam", {},
        h("span.eyebrow", {}, f.title),
        h("div.dom-grid", {}, f.domains.map((id) => domTile(byId[id])))))));
    for (const f of fams) {
      page.append(h("h2.fam-title", {}, f.title));
      for (const id of f.domains) renderGroup(byId[id]);
    }
  } else {
    for (const g of T.groups) renderGroup(g);
  }
  return page;
}
