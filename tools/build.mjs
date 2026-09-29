#!/usr/bin/env node
// Construit Praxis en une page autonome :
//   dist/index.html     page complète (GitHub Pages, usage local)
//   dist/artifact.html  même page sans squelette HTML (page Claude)
//   dist/pyodide/       interpréteur Python pour le navigateur
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONTENT = path.join(ROOT, "content");
const DIST = path.join(ROOT, "dist");
const args = new Set(process.argv.slice(2));
const warn = (m) => console.warn(`! ${m}`);

const exists = (p) => fs.existsSync(p);
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));

// ------------------------------------------------------------------ contenu
// Le contenu est assemblé par tools/content.py (même chargeur que le validateur).
import { execFileSync } from "node:child_process";
function buildContent() {
  const py = process.env.PYTHON || "python3";
  const out = execFileSync(py, [path.join(ROOT, "tools/content.py")], { maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "inherit"] });
  return JSON.parse(out.toString("utf8"));
}

// ------------------------------------------------------------------ page

async function bundleJs() {
  const r = await esbuild.build({
    entryPoints: [path.join(ROOT, "app/src/main.js")],
    bundle: true,
    format: "iife",
    minify: !args.has("--dev"),
    target: ["es2022"],
    write: false,
    legalComments: "none",
    charset: "utf8",
  });
  return r.outputFiles[0].text;
}

function page(C, js, css, { full }) {
  const data = JSON.stringify(C).replace(/<\//g, "<\\/").replaceAll(String.fromCharCode(0x2028), "\\u2028").replaceAll(String.fromCharCode(0x2029), "\\u2029");
  const fonts = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@0,400;0,500;0,600;1,400&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&display=swap">`;
  // Page Claude : le serveur ne sert pas les .zip, la bibliothèque standard Python part en base64 (.txt).
  const target = full ? "" : `<script>self.PRAXIS_TARGET = "artifact";</script>\n`;
  const body = `${target}<div id="app"><div style="padding:48px 24px;font-family:ui-monospace,Menlo,monospace;font-size:13px;color:#5A6865">Chargement de Praxis…</div><noscript>Praxis a besoin de JavaScript.</noscript></div>
<script type="application/json" id="praxis-data">${data}</script>
<script>${js.replace(/<\/script/gi, "<\\/script")}</script>`;
  if (!full) return `<title>Praxis</title>\n${fonts}\n<style>${css}</style>\n${body}\n`;
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Praxis</title>
<meta name="description" content="Praxis : apprendre Python, le C++ et la culture d'ingénieur avec des cours en crescendo, des exercices, des pièges et de la révision espacée.">
<meta name="theme-color" content="#0E4F4C">
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#0E4F4C"/><rect x="11" y="11" width="10" height="10" transform="rotate(45 16 16)" fill="#F2C230"/></svg>')}">
${fonts}
<style>${css}</style>
</head>
<body>
${body}
</body>
</html>
`;
}

function copyPyodide() {
  const src = path.join(ROOT, "node_modules/pyodide");
  const dst = path.join(DIST, "pyodide");
  fs.mkdirSync(dst, { recursive: true });
  for (const f of ["pyodide.js", "pyodide.mjs", "pyodide.asm.mjs", "pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json"]) {
    const s = path.join(src, f);
    if (exists(s)) fs.copyFileSync(s, path.join(dst, f));
    else warn(`fichier Pyodide absent : ${f}`);
  }
  const zip = path.join(dst, "python_stdlib.zip");
  if (exists(zip)) fs.writeFileSync(path.join(dst, "python_stdlib.b64.txt"), fs.readFileSync(zip).toString("base64"));
}

async function main() {
  const t0 = Date.now();
  const C = buildContent();
  C.owner = (process.env.PRAXIS_PRENOM || "").trim();       // prénom par défaut, hors du dépôt public
  const js = await bundleJs();
  const css = fs.readFileSync(path.join(ROOT, "app/styles.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\n\s*\n/g, "\n");
  fs.mkdirSync(DIST, { recursive: true });
  fs.writeFileSync(path.join(DIST, "index.html"), page(C, js, css, { full: true }));
  fs.writeFileSync(path.join(DIST, "artifact.html"), page(C, js, css, { full: false }));
  if (!args.has("--no-pyodide")) copyPyodide();
  const kb = (f) => (fs.statSync(path.join(DIST, f)).size / 1024).toFixed(0);
  const nLessons = Object.values(C.modules).filter((m) => m.lesson).length;
  if (args.has("--json")) fs.writeFileSync(path.join(DIST, "content.json"), JSON.stringify(C));
  console.log(`Praxis ${C.v} : ${Object.keys(C.modules).length} modules/notions (${nLessons} cours), ${Object.keys(C.ex).length} exercices, ` +
    `${C.piegeOrder.length} pièges, ${C.labs.length} labs, ${C.glossary.length} termes — index.html ${kb("index.html")} ko, JS ${(js.length / 1024).toFixed(0)} ko (${Date.now() - t0} ms)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
