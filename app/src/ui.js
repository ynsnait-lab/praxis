// Composants d'interface partagés.
import { h, $ } from "./dom.js";
import { TRACK_LABEL } from "./content.js";

export function toast(msg, ms = 2800) {
  let box = $(".toasts");
  if (!box) {
    box = h("div.toasts", { role: "status", "aria-live": "polite" });
    document.body.append(box);
  }
  const t = h("div.toast", { text: msg });
  box.append(t);
  setTimeout(() => t.remove(), ms);
}

export const trackPill = (tr) => h(`span.pill.${tr}`, {}, h(`span.dotlang.${tr}`), TRACK_LABEL[tr] || tr);

// Jauge « crescendo » : 5 barres croissantes ; levels = niveaux présents, upTo = niveau atteint
export function cresc(levels = [1, 2, 3, 4, 5], upTo = 5) {
  const set = new Set(levels);
  return h("span.cresc", { "aria-hidden": "true" },
    [1, 2, 3, 4, 5].map((l) => h("i", { class: set.has(l) ? (l <= upTo ? `l${l}` : `l${l} off`) : "" })));
}

export function lvChip(level, label) {
  return h("span.lvchip", {}, cresc([1, 2, 3, 4, 5].filter((l) => l <= level), level), label);
}

export function masteryBar(m) {
  const t = Math.max(1, m.total);
  const pct = (n) => `${(100 * n) / t}%`;
  return h("div.bar", { title: `${m.mastered} maîtrisés · ${m.seen} vus · ${m.total} au total` },
    h("i.m", { style: { width: pct(m.mastered) } }),
    h("i.s", { style: { width: pct(Math.max(0, m.seen - m.mastered - m.weak)) } }),
    h("i.f", { style: { width: pct(m.weak) } }));
}

export function fmtMs(ms) {
  const s = Math.round((ms || 0) / 1000);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`;
}

export const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;

export function sw(id, checked, onchange, label) {
  return h("label.switch", { title: label || "" },
    h("input", { type: "checkbox", id, checked, onchange: (e) => onchange(e.target.checked), "aria-label": label || id }),
    h("span"));
}

export function go(route) {
  if (location.hash === route) window.dispatchEvent(new HashChangeEvent("hashchange"));
  else location.hash = route;
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
