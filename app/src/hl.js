// Coloration syntaxique légère : Python, C++, shell, TOML/INI, CMake, JSON.
import { esc } from "./dom.js";

const PY_KW = new Set(("False None True and as assert async await break class continue def del elif else except finally for " +
  "from global if import in is lambda nonlocal not or pass raise return try while with yield match case").split(" "));
const PY_BI = new Set(("print len range int float str list dict set tuple bool bytes bytearray isinstance type sum min max abs " +
  "open enumerate zip map filter sorted reversed super object round divmod repr hash id iter next any all input " +
  "Exception ValueError TypeError KeyError IndexError ZeroDivisionError RuntimeError OSError AttributeError " +
  "StopIteration NameError UnboundLocalError NotImplementedError FileNotFoundError TimeoutError self cls").split(" "));
const CPP_KW = new Set(("alignas alignof asm auto bool break case catch char char8_t char16_t char32_t class concept const consteval " +
  "constexpr constinit const_cast continue co_await co_return co_yield decltype default delete do double dynamic_cast else enum " +
  "explicit export extern false float for friend goto if inline int long mutable namespace new noexcept nullptr operator " +
  "private protected public register reinterpret_cast requires return short signed sizeof static static_assert static_cast " +
  "struct switch template this thread_local throw true try typedef typeid typename union unsigned using virtual void volatile " +
  "wchar_t while override final").split(" "));
const CPP_TYPES = /^(?:std::[A-Za-z_]\w*|u?int(?:8|16|32|64)_t|size_t|ptrdiff_t|uintptr_t|intptr_t|String|byte)$/;
const SH_KW = new Set("if then else fi for do done while case esac in function export source cd echo exit".split(" "));

function lexer(lang) {
  if (lang === "cpp" || lang === "c" || lang === "arduino") {
    return [
      ["com", /\/\/[^\n]*|\/\*[\s\S]*?\*\//y],
      ["pp", /#[ \t]*[a-z]+(?:[ \t]*<[^>\n]*>)?/y],
      ["str", /R"\(([\s\S]*?)\)"|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])+'/y],
      ["num", /\b(?:0[xX][\da-fA-F']+|0[bB][01']+|\d[\d']*(?:\.\d[\d']*)?(?:[eE][+-]?\d+)?)[uUlLfFzZ]*\b|\.\d+(?:[eE][+-]?\d+)?[fF]?/y],
      ["word", /[A-Za-z_]\w*(?:::[A-Za-z_]\w*)*/y],
    ];
  }
  if (lang === "python" || lang === "py") {
    return [
      ["com", /#[^\n]*/y],
      ["str", /[rRbBfFuU]{0,2}(?:"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')/y],
      ["pp", /@[A-Za-z_][\w.]*/y],
      ["num", /\b(?:0[xX][\da-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+|\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][+-]?\d+)?j?)\b|\.\d+(?:[eE][+-]?\d+)?/y],
      ["word", /[A-Za-z_]\w*/y],
    ];
  }
  if (lang === "shell" || lang === "bash" || lang === "sh" || lang === "zsh") {
    return [
      ["com", /#[^\n]*/y],
      ["str", /"(?:\\.|[^"\\])*"|'[^']*'/y],
      ["pp", /\$\{?[A-Za-z_]\w*\}?|\$\(|--?[A-Za-z][\w-]*/y],
      ["word", /[A-Za-z_][\w.-]*/y],
    ];
  }
  if (lang === "toml" || lang === "ini" || lang === "cmake" || lang === "json" || lang === "yaml") {
    return [
      ["com", /#[^\n]*/y],
      ["str", /"(?:\\.|[^"\\\n])*"|'[^'\n]*'/y],
      ["pp", /^\s*\[[^\]\n]+\]/my],
      ["num", /\b\d[\d.]*\b/y],
      ["word", /[A-Za-z_][\w.-]*/y],
    ];
  }
  return null;
}

function classify(word, lang, rest) {
  if (lang === "python" || lang === "py") {
    if (PY_KW.has(word)) return "kw";
    if (PY_BI.has(word)) return "fn";
    if (rest.startsWith("(")) return "fn";
    if (/^[A-Z][A-Za-z0-9]+$/.test(word) && word.length > 1) return "type";
    return null;
  }
  if (lang === "cpp" || lang === "c" || lang === "arduino") {
    if (CPP_KW.has(word)) return "kw";
    if (CPP_TYPES.test(word)) return "type";
    if (rest.startsWith("(")) return "fn";
    if (/^[A-Z][A-Za-z0-9]+$/.test(word) && word.length > 1) return "type";
    return null;
  }
  if (lang === "shell" || lang === "bash" || lang === "sh" || lang === "zsh") {
    if (SH_KW.has(word)) return "kw";
    return null;
  }
  if (lang === "cmake") return rest.startsWith("(") ? "fn" : null;
  if (lang === "json" && (word === "true" || word === "false" || word === "null")) return "kw";
  return null;
}

// Renvoie une liste de lignes HTML (les jetons multi-lignes sont découpés proprement).
export function highlightLines(code, lang) {
  const src = String(code ?? "");
  const rules = lexer(lang);
  if (!rules) return src.split("\n").map(esc);
  const out = [];
  let i = 0;
  let plain = "";
  const flush = () => { if (plain) { out.push([null, plain]); plain = ""; } };
  while (i < src.length) {
    let matched = false;
    for (const [type, re] of rules) {
      re.lastIndex = i;
      const m = re.exec(src);
      if (m && m.index === i && m[0].length) {
        // un mot collé à un identifiant précédent (ex : 'x1') ne doit pas être coupé
        if (type === "num" && i > 0 && /[\w]/.test(src[i - 1])) break;
        flush();
        let cls = type;
        if (type === "word") cls = classify(m[0], lang, src.slice(i + m[0].length).trimStart());
        out.push([cls, m[0]]);
        i += m[0].length;
        matched = true;
        break;
      }
    }
    if (!matched) { plain += src[i]; i += 1; }
  }
  flush();
  const lines = [""];
  for (const [cls, text] of out) {
    const parts = text.split("\n");
    parts.forEach((p, k) => {
      if (k > 0) lines.push("");
      if (p) lines[lines.length - 1] += cls ? `<span class="tok-${cls}">${esc(p)}</span>` : esc(p);
    });
  }
  return lines;
}

export function highlight(code, lang) {
  return highlightLines(code, lang).join("\n");
}
