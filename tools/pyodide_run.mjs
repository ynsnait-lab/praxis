// Exécute des extraits Python dans Pyodide sous Node : le même interpréteur que l'app (Python 3.14).
// Usage : node tools/pyodide_run.mjs in.json out.json   (in.json = [{id, code}], out.json = [{id, out, err}])
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PYODIDE = path.join(ROOT, "node_modules", "pyodide");
const { loadPyodide } = await import(pathToFileURL(path.join(PYODIDE, "pyodide.mjs")).href);

const [inp, outp] = process.argv.slice(2);
const items = JSON.parse(fs.readFileSync(inp, "utf8"));
const py = await loadPyodide({ indexURL: PYODIDE + path.sep });
const res = [];
for (const it of items) {
  let out = "";
  const dec = new TextDecoder();
  const w = { write: (buf) => { out += dec.decode(buf, { stream: true }); return buf.length; } };
  py.setStdout(w);
  py.setStderr(w);
  let err = null;
  try {
    await py.runPythonAsync(`import sys as __s\n__g = {"__name__": "__main__"}\n`);
    py.globals.set("__code", it.code);
    await py.runPythonAsync(`exec(compile(__code, "<cours>", "exec"), __g)`);
    await py.runPythonAsync(`__s.stdout.flush(); __s.stderr.flush()`);
  } catch (e) {
    err = String(e.message || e).split("\n").slice(-3).join("\n");
  }
  res.push({ id: it.id, out, err });
}
fs.writeFileSync(outp, JSON.stringify(res, null, 1));
