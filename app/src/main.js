// Point d'entrée : coquille (navigation), routeur par ancre, synchronisation.
import { h, clear, $ } from "./dom.js";
import { C } from "./content.js";
import { getState, onChange, persistNow } from "./store.js";
import { initSync, flush } from "./sync.js";
import { summary } from "./engine.js";
import { applyTheme } from "./theme.js";
import { todayView } from "./views/today.js";
import { parcoursView } from "./views/parcours.js";
import { moduleView, domainView } from "./views/module.js";
import { sessionView } from "./views/session.js";
import { piegesView, piegeView } from "./views/pieges.js";
import { labsView } from "./views/labs.js";
import { fichesView, memoView } from "./views/fiches.js";
import { statsView } from "./views/stats.js";
import { reglagesView } from "./views/reglages.js";

const NAV = [
  ["/", "◆", "Aujourd'hui", "Auj."],
  ["/parcours", "▤", "Parcours", "Parcours"],
  ["/pieges", "△", "Pièges", "Pièges"],
  ["/labs", "▣", "Labs", "Labs"],
  ["/fiches", "§", "Fiches", "Fiches"],
  ["/stats", "▚", "Progression", "Stats"],
  ["/reglages", "⚙", "Réglages", "Réglages"],
];

const ROUTES = {
  "": todayView, parcours: parcoursView, m: moduleView, d: domainView, session: sessionView, pieges: piegesView,
  piege: piegeView, labs: labsView, fiches: fichesView, memo: memoView, stats: statsView, reglages: reglagesView,
};

function parseRoute() {
  const raw = (location.hash || "").replace(/^#\/?/, "");
  const [path] = raw.split("?");
  const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
  return parts.length ? parts : [""];
}

let syncState = "local";
const app = h("div.app");
const rail = h("nav.rail", { "aria-label": "Navigation principale" });
const main = h("main.main", { id: "main" });
const mobileTop = h("div.mobile-top");
const tabbar = h("nav.tabbar", { "aria-label": "Navigation" });

function navActive(route) {
  const head = "/" + (route[0] || "");
  if (head === "/m" || head === "/d" || head === "/session") return "/parcours";
  if (head === "/piege") return "/pieges";
  if (head === "/memo") return "/fiches";
  return head === "/" ? "/" : head;
}

function drawChrome(route) {
  const active = navActive(route);
  const due = summary();
  const badge = due.dueN + due.newN;
  clear(rail).append(
    h("a.brand", { href: "#/", style: { textDecoration: "none", color: "inherit" } }, h("span.dot"), h("span.word", {}, "Praxis"), h("span.ver", {}, "py · c++ · ingé")),
    h("div.nav", {}, NAV.map(([r, g, long]) => h("a", { href: `#${r}`, class: active === r ? "on" : "", "aria-current": active === r ? "page" : null },
      h("span.glyph", {}, g), h("span.long", {}, long), r === "/" && badge ? h("span.badge", {}, String(badge)) : null))),
    h("div.rail-foot", {},
      h("a.btn.primary", { href: "#/session" }, "Séance du jour"),
      h(`div.sync-pill${syncState === "sync" ? ".on" : syncState === "error" ? ".err" : ""}`, { title: "État de la sauvegarde" }, h("i"),
        syncState === "sync" ? "synchronisé" : syncState === "error" ? "synchro en erreur" : "sauvegarde locale")));
  clear(mobileTop).append(
    h("a.brand", { href: "#/", style: { textDecoration: "none", color: "inherit" } }, h("span.dot"), h("span.word", {}, "Praxis")),
    h("span.spacer"),
    route[0] === "session" ? null : h("a.btn.primary.sm", { href: "#/session" }, badge ? `Séance · ${badge}` : "Séance"));
  const tabs = [NAV[0], NAV[1], NAV[2], NAV[3]];
  clear(tabbar).append(...tabs.map(([r, g, , short]) => h("a", { href: `#${r}`, class: active === r ? "on" : "" },
    h("span.glyph", {}, g), h("span", {}, short), r === "/" && badge ? h("span.badge", {}, String(badge)) : null)),
  h("a", { href: "#", class: ["/fiches", "/stats", "/reglages"].includes(active) ? "on" : "", onclick: (e) => { e.preventDefault(); openDrawer(); } },
    h("span.glyph", {}, "≡"), h("span", {}, "Plus")));
}

function openDrawer() {
  const back = h("div.drawer-back", { onclick: () => close() });
  const d = h("div.drawer", { role: "dialog", "aria-label": "Plus" },
    NAV.slice(4).map(([r, g, long]) => h("a", { href: `#${r}`, onclick: () => close() }, h("span.glyph", {}, g), long)));
  function close() { back.remove(); d.remove(); }
  document.body.append(back, d);
}

let lastKey = "";
function render() {
  const route = parseRoute();
  const view = ROUTES[route[0]] || todayView;
  document.body.classList.toggle("in-session", route[0] === "session");
  drawChrome(route);
  let el;
  try {
    el = view(route);
  } catch (err) {
    console.error(err);
    el = h("div.page", {}, h("h1", {}, "Oups"), h("p", {}, "Cette page n'a pas pu s'afficher. "), h("pre.console.err", {}, String(err && err.stack || err)), h("a.btn", { href: "#/" }, "Retour à l'accueil"));
  }
  clear(main).append(el);
  const key = route.join("/");
  if (key !== lastKey) { window.scrollTo(0, 0); lastKey = key; }
  const title = { "": "Praxis", parcours: "Parcours · Praxis", session: "Séance · Praxis", pieges: "Pièges · Praxis", labs: "Labs · Praxis", fiches: "Fiches · Praxis", stats: "Progression · Praxis", reglages: "Réglages · Praxis" }[route[0]];
  if (route[0] === "m" && C.modules[route[1]]) document.title = `${C.modules[route[1]].title} · Praxis`;
  else document.title = title || "Praxis";
}

function boot() {
  applyTheme(getState().settings.theme);
  app.append(rail, h("div", { style: { minWidth: 0 } }, mobileTop, main), tabbar);
  const root = document.getElementById("app");
  clear(root).append(app);
  window.addEventListener("hashchange", render);
  render();
  initSync((s) => {
    const changed = s !== syncState;
    syncState = s;
    if (changed) drawChrome(parseRoute());
    if (s === "sync" && parseRoute()[0] !== "session") render();
  });
  // rafraîchir les compteurs de la barre après chaque réponse sans tout redessiner
  onChange(() => drawChrome(parseRoute()));
  window.addEventListener("pagehide", () => { persistNow(); flush(); });
}

boot();
