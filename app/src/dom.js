// Petit utilitaire de création d'éléments : h("div.card#id", {props}, ...enfants)

// append() natif convertit null/false en texte « null » : on les ignore partout.
for (const proto of [Element.prototype, DocumentFragment.prototype]) {
  const native = proto.append;
  proto.append = function (...nodes) {
    return native.apply(this, nodes.filter((n) => n !== null && n !== undefined && n !== false));
  };
}
export function h(sel, props = null, ...children) {
  const [tagPart, ...classes] = String(sel).split(".");
  const [tag, id] = tagPart.split("#");
  const el = document.createElement(tag || "div");
  if (id) el.id = id;
  if (classes.length) el.className = classes.join(" ");
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = [el.className, v].filter(Boolean).join(" ");
      else if (k === "html") el.innerHTML = v;
      else if (k === "text") el.textContent = v;
      else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
      else if (k === "dataset") Object.assign(el.dataset, v);
      else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
      else if (k === "value") el.value = v;
      else if (k === "checked") el.checked = !!v;
      else el.setAttribute(k, v === true ? "" : v);
    }
  }
  append(el, children);
  return el;
}

export function append(el, children) {
  for (const c of children.flat(8)) {
    if (c == null || c === false || c === true) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

export const esc = (s) =>
  String(s ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

export function frag(...children) {
  const f = document.createDocumentFragment();
  append(f, children);
  return f;
}
