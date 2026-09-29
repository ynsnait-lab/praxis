// Rendu Markdown maison : titres, listes (imbriquées), tableaux, citations typées,
// blocs de code colorés, figures SVG, formules LaTeX ($…$ et $$…$$) rendues en MathML.
import temml from "temml";
import { esc } from "./dom.js";
import { highlightLines } from "./hl.js";

const mathCache = new Map();

export function tex(src, display = false) {
  const key = (display ? "D" : "I") + src;
  let out = mathCache.get(key);
  if (out === undefined) {
    try {
      out = temml.renderToString(src, { displayMode: display, throwOnError: false, annotate: false });
    } catch (e) {
      out = `<code class="inline">${esc(src)}</code>`;
    }
    mathCache.set(key, out);
  }
  return out;
}

const LANG_LABEL = { python: "python", py: "python", cpp: "c++", c: "c", shell: "terminal", bash: "terminal", sh: "terminal",
  zsh: "terminal", toml: "toml", cmake: "cmake", json: "json", yaml: "yaml", text: "", txt: "", ini: "ini", arduino: "arduino" };

export function codeHTML(code, lang = "text", opts = {}) {
  const src = String(code ?? "").replace(/\n+$/, "");
  const lines = highlightLines(src, lang);
  const gutter = opts.gutter ?? lines.length >= 4;
  const label = opts.tag ?? LANG_LABEL[lang] ?? lang;
  const tag = label ? `<span class="tag">${esc(label)}</span>` : "";
  if (!gutter) {
    return `<pre class="code-block plain">${tag}${lines.join("\n")}</pre>`;
  }
  const body = lines.map((l, i) => `<div class="ln" data-n="${i + 1}"><span class="g">${i + 1}</span><span class="c">${l || " "}</span></div>`).join("");
  return `<div class="code-block">${tag}${body}</div>`;
}

// ---------------------------------------------------------------- inline

const PH = "\u0000";

export function inline(s) {
  const slots = [];
  const put = (html) => `${PH}${slots.push(html) - 1}${PH}`;
  let t = String(s ?? "");
  // échappement \$ \* \_ \`
  t = t.replace(/\\([$*_`\\[\]])/g, (_, c) => put(esc(c)));
  // code en ligne (double ou simple accent grave)
  t = t.replace(/``\s?([\s\S]+?)\s?``|`([^`\n]+)`/g, (_, a, b) => put(`<code class="inline">${esc(a ?? b)}</code>`));
  // formules en ligne
  t = t.replace(/\$(?![\s$])([^$\n]+?)(?<!\s)\$/g, (_, m) => put(tex(m, false)));
  t = esc(t);
  // liens
  t = t.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (_, txt, url) => {
    const safe = /^(https?:|#|mailto:)/.test(url) ? url : "#";
    const ext = safe.startsWith("http");
    return `<a href="${safe}"${ext ? ' target="_blank" rel="noopener"' : ""}>${txt}</a>`;
  });
  t = t.replace(/\*\*([^*\n][\s\S]*?)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/(^|[^*\w])\*([^*\n]+?)\*(?!\*)/g, "$1<em>$2</em>");
  t = t.replace(/(^|[^\w])_([^_\n]+?)_(?!\w)/g, "$1<em>$2</em>");
  t = t.replace(/~~([^~\n]+)~~/g, "<del>$1</del>");
  t = t.replace(/==([^=\n]+)==/g, '<span class="hl">$1</span>');
  // restauration (deux passes : un lien peut contenir du code)
  for (let k = 0; k < 2; k++) t = t.replace(new RegExp(`${PH}(\\d+)${PH}`, "g"), (_, n) => slots[+n]);
  return t;
}

// ---------------------------------------------------------------- blocs

const RE_FENCE = /^(\s*)(```+|~~~+)\s*([\w+-]*)\s*(.*)$/;
const RE_LIST = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
const RE_HEAD = /^(#{1,4})\s+(.*)$/;
const RE_HR = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/;
const RE_TABLE_SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

function parseAttrs(s) {
  const attrs = {};
  String(s || "").replace(/(\w+)="([^"]*)"/g, (_, k, v) => { attrs[k] = v; return ""; });
  return attrs;
}

function splitRow(line) {
  let l = line.trim();
  if (l.startsWith("|")) l = l.slice(1);
  if (l.endsWith("|") && !l.endsWith("\\|")) l = l.slice(0, -1);
  const cells = [];
  let cur = "";
  let inCode = false;
  for (let i = 0; i < l.length; i++) {
    const c = l[i];
    if (c === "`") inCode = !inCode;
    if (c === "\\" && l[i + 1] === "|") { cur += "|"; i++; continue; }
    if (c === "|" && !inCode) { cells.push(cur.trim()); cur = ""; continue; }
    cur += c;
  }
  cells.push(cur.trim());
  return cells;
}

function renderList(items) {
  // items : [{indent, ordered, text, children: []}]
  const root = { children: [], indent: -1 };
  const stack = [root];
  for (const it of items) {
    while (stack.length > 1 && it.indent <= stack[stack.length - 1].indent) stack.pop();
    const parent = stack[stack.length - 1];
    const node = { ...it, children: [] };
    parent.children.push(node);
    stack.push(node);
  }
  const emit = (nodes) => {
    if (!nodes.length) return "";
    const ordered = nodes[0].ordered;
    const start = ordered && nodes[0].num > 1 ? ` start="${nodes[0].num}"` : "";
    const tag = ordered ? "ol" : "ul";
    return `<${tag}${start}>${nodes.map((n) => `<li>${inline(n.text)}${emit(n.children)}</li>`).join("")}</${tag}>`;
  };
  return emit(root.children);
}

export function md(src) {
  if (!src) return "";
  const lines = String(src).replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  let i = 0;
  const isBlockStart = (l, next) =>
    RE_FENCE.test(l) || RE_HEAD.test(l) || /^\s*>/.test(l) || RE_LIST.test(l) || RE_HR.test(l) || /^\s*\$\$/.test(l) ||
    (l.includes("|") && next !== undefined && RE_TABLE_SEP.test(next));
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const fence = line.match(RE_FENCE);
    if (fence) {
      const marker = fence[2];
      const lang = (fence[3] || "text").toLowerCase();
      const attrs = parseAttrs(fence[4]);
      const body = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(marker)) { body.push(lines[i]); i++; }
      i++;
      const indent = fence[1].length;
      const code = body.map((l) => l.slice(Math.min(indent, l.length - l.trimStart().length))).join("\n");
      if (lang === "svg") {
        out.push(`<div class="figure">${code}${attrs.caption ? `<div class="cap">${inline(attrs.caption)}</div>` : ""}</div>`);
      } else if (lang === "mail") {
        out.push(`<pre class="code-block plain wrap"><span class="tag">${esc(attrs.label || "mail")}</span>${esc(code)}</pre>`);
      } else if (lang === "math" || lang === "latex") {
        out.push(`<div class="math-block">${tex(code, true)}</div>`);
      } else {
        out.push(codeHTML(code, lang, attrs.label ? { tag: attrs.label } : {}));
      }
      continue;
    }
    if (/^\s*\$\$/.test(line)) {
      const buf = [];
      let l = line.trim().slice(2);
      if (l.trimEnd().endsWith("$$") && l.trim().length > 2) {
        buf.push(l.trimEnd().slice(0, -2));
        i++;
      } else {
        if (l.trim()) buf.push(l);
        i++;
        while (i < lines.length && !lines[i].trimEnd().endsWith("$$")) { buf.push(lines[i]); i++; }
        if (i < lines.length) { buf.push(lines[i].trimEnd().slice(0, -2)); i++; }
      }
      out.push(`<div class="math-block">${tex(buf.join("\n"), true)}</div>`);
      continue;
    }
    const head = line.match(RE_HEAD);
    if (head) {
      const tag = head[1].length <= 2 ? "h3" : "h4";
      out.push(`<${tag}>${inline(head[2])}</${tag}>`);
      i++;
      continue;
    }
    if (RE_HR.test(line)) { out.push("<hr>"); i++; continue; }
    if (/^\s*>/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) { buf.push(lines[i].replace(/^\s*>\s?/, "")); i++; }
      let cls = "";
      let title = "";
      const m = buf[0] && buf[0].match(/^\[!(\w+)\]\s*(.*)$/);
      if (m) {
        cls = m[1].toLowerCase();
        title = m[2];
        buf.shift();
      }
      const labels = { piege: "Piège", note: "À noter", astuce: "Astuce", attention: "Attention" };
      const head2 = cls ? `<strong>${title ? inline(title) : labels[cls] || ""}</strong>` : "";
      out.push(`<blockquote class="${cls}">${head2}${md(buf.join("\n"))}</blockquote>`);
      continue;
    }
    if (line.includes("|") && i + 1 < lines.length && RE_TABLE_SEP.test(lines[i + 1])) {
      const headCells = splitRow(line);
      const aligns = splitRow(lines[i + 1]).map((c) => (c.startsWith(":") && c.endsWith(":") ? "center" : c.endsWith(":") ? "right" : ""));
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) { rows.push(splitRow(lines[i])); i++; }
      const al = (k) => (aligns[k] ? ` style="text-align:${aligns[k]}"` : "");
      out.push(`<div class="tbl"><table><thead><tr>${headCells.map((c, k) => `<th${al(k)}>${inline(c)}</th>`).join("")}</tr></thead><tbody>${rows
        .map((r) => `<tr>${headCells.map((_, k) => `<td${al(k)}>${inline(r[k] ?? "")}</td>`).join("")}</tr>`)
        .join("")}</tbody></table></div>`);
      continue;
    }
    if (RE_LIST.test(line)) {
      const items = [];
      while (i < lines.length) {
        const l = lines[i];
        const m = l.match(RE_LIST);
        if (m) {
          items.push({ indent: m[1].length, ordered: /\d/.test(m[2]), num: parseInt(m[2], 10) || 1, text: m[3] });
          i++;
        } else if (l.trim() && /^\s{2,}\S/.test(l) && items.length && !RE_FENCE.test(l)) {
          items[items.length - 1].text += " " + l.trim();
          i++;
        } else if (!l.trim() && i + 1 < lines.length && RE_LIST.test(lines[i + 1]) && items.length) {
          i++;
        } else break;
      }
      out.push(renderList(items));
      continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && !(para.length && isBlockStart(lines[i], lines[i + 1]))) {
      para.push(lines[i].trim());
      i++;
    }
    out.push(`<p>${inline(para.join("\n")).replace(/\n/g, " ")}</p>`);
  }
  return out.join("");
}
