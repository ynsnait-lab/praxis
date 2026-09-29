// Exécution de code : Python dans le navigateur (Pyodide, dans un Web Worker),
// C++ via Compiler Explorer (option, désactivée par défaut).
export const PYODIDE_VERSION = "314.0.7";
const CDN = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

const WORKER_SRC = `
let py = null;
let stdlibReady = false;
// Page Claude : python_stdlib.zip est publié en base64 (le serveur ne sert pas les .zip).
// On le décode puis on intercepte la requête que fait Pyodide pour le zip.
async function installStdlib(indexURL) {
  const r = await fetch(indexURL + "python_stdlib.b64.txt");
  if (!r.ok) throw new Error("bibliothèque standard introuvable (" + r.status + ")");
  const b64 = (await r.text()).replace(/\\s+/g, "");
  const raw = atob(b64);
  const bin = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bin[i] = raw.charCodeAt(i);
  const orig = self.fetch.bind(self);
  self.fetch = (u, o) => {
    const s = String((u && u.url) || u);
    if (s.endsWith("/python_stdlib.zip")) return Promise.resolve(new Response(bin.slice(), { headers: { "Content-Type": "application/zip" } }));
    return orig(u, o);
  };
  stdlibReady = true;
}
async function boot(indexURL, packageBaseUrl, stdlibB64) {
  if (stdlibB64 && !stdlibReady) await installStdlib(indexURL);
  const mod = await import(indexURL + "pyodide.mjs");
  py = await mod.loadPyodide({ indexURL, packageBaseUrl });
  py.setStdin({ error: true });
  return py.version;
}
self.onmessage = async (ev) => {
  const { id, cmd } = ev.data;
  try {
    if (cmd === "init") {
      let version = null;
      const errs = [];
      for (const url of ev.data.urls) {
        try { version = await boot(url, ev.data.packageBaseUrl, ev.data.stdlibB64 && url === ev.data.urls[0]); break; }
        catch (e) { errs.push(String((e && e.message) || e)); py = null; }
      }
      if (!py) throw new Error(errs.join(" | ") || "Pyodide indisponible");
      self.postMessage({ id, ok: true, version });
      return;
    }
    if (cmd === "run") {
      let out = "";
      py.setStdout({ batched: (s) => { out += s + "\\n"; } });
      py.setStderr({ batched: (s) => { out += s + "\\n"; } });
      try { await py.loadPackagesFromImports(ev.data.code); } catch (e) { out += "[paquet indisponible : " + (e && e.message || e) + "]\\n"; }
      const ns = py.globals.get("dict")();
      // une dernière ligne sans retour à la ligne (print(..., end="")) resterait sinon dans le tampon
      const flush = () => { try { py.runPython("import sys as _s; _s.stdout.flush(); _s.stderr.flush()"); } catch (e) {} };
      try {
        await py.runPythonAsync(ev.data.code, { globals: ns, filename: "exercice.py" });
        flush();
        self.postMessage({ id, ok: true, out });
      } catch (e) {
        flush();
        self.postMessage({ id, ok: false, out, err: String((e && e.message) || e) });
      } finally {
        ns.destroy();
      }
    }
  } catch (e) {
    self.postMessage({ id, ok: false, err: String((e && e.message) || e) });
  }
};`;

function cleanTraceback(msg) {
  const lines = String(msg || "").split("\n");
  const first = lines.findIndex((l) => /File "exercice\.py"/.test(l));
  if (first >= 0) return ["Traceback (most recent call last):", ...lines.slice(first)].join("\n").trim();
  const tail = lines.filter((l) => !/\/lib\/python|_pyodide|pyodide\.asm/.test(l));
  return tail.slice(-8).join("\n").trim();
}

class PyRunner {
  constructor() {
    this.worker = null;
    this.ready = null;
    this.seq = 0;
    this.pending = new Map();
    this.state = "idle";
    this.version = null;
    this.listeners = new Set();
  }
  onState(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  setState(s) { this.state = s; for (const fn of this.listeners) fn(s); }
  call(msg, timeout) {
    return new Promise((resolve, reject) => {
      const id = ++this.seq;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        this.kill();
        reject(Object.assign(new Error("timeout"), { code: "timeout" }));
      }, timeout);
      this.pending.set(id, (data) => { clearTimeout(timer); resolve(data); });
      this.worker.postMessage({ ...msg, id });
    });
  }
  kill() {
    if (this.worker) this.worker.terminate();
    this.worker = null;
    this.ready = null;
    for (const fn of this.pending.values()) fn({ ok: false, err: "interrompu" });
    this.pending.clear();
    if (this.state !== "unavailable") this.setState("idle");
  }
  ensure() {
    if (this.ready) return this.ready;
    this.setState("loading");
    this.ready = (async () => {
      let w;
      try {
        const url = URL.createObjectURL(new Blob([WORKER_SRC], { type: "text/javascript" }));
        w = new Worker(url, { type: "module" });
      } catch (e) {
        throw new Error("Les Web Workers sont bloqués dans cette vue.");
      }
      this.worker = w;
      w.onmessage = (ev) => {
        const fn = this.pending.get(ev.data.id);
        if (fn) { this.pending.delete(ev.data.id); fn(ev.data); }
      };
      w.onerror = () => {};
      const local = new URL("pyodide/", document.baseURI).href;
      const stdlibB64 = globalThis.PRAXIS_TARGET === "artifact";
      const r = await this.call({ cmd: "init", urls: [local, CDN], packageBaseUrl: CDN, stdlibB64 }, 120000);
      if (!r.ok) throw new Error(r.err || "Pyodide indisponible");
      this.version = r.version;
      this.setState("ready");
      return true;
    })().catch((e) => {
      this.ready = null;
      if (this.worker) this.worker.terminate();
      this.worker = null;
      this.setState("unavailable");
      throw e;
    });
    return this.ready;
  }
  async run(code, { timeout = 10000 } = {}) {
    try {
      await this.ensure();
    } catch (e) {
      return { ok: false, unavailable: true, err: String(e.message || e) };
    }
    try {
      const r = await this.call({ cmd: "run", code }, timeout);
      if (!r.ok) return { ok: false, out: r.out || "", err: cleanTraceback(r.err) };
      return { ok: true, out: r.out || "" };
    } catch (e) {
      if (e.code === "timeout") return { ok: false, out: "", err: `Temps dépassé (${timeout / 1000} s) : boucle infinie ? L'interpréteur a été relancé.` };
      return { ok: false, out: "", err: String(e.message || e) };
    }
  }
}

export const python = new PyRunner();

// ------------------------------------------------------------ C++ (Compiler Explorer)

export async function runCpp(source, { stdin = "" } = {}) {
  let res;
  try {
    res = await fetch("https://godbolt.org/api/compiler/g141/compile", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        source,
        options: {
          userArguments: "-std=c++20 -O1 -Wall -Wextra",
          executeParameters: { args: [], stdin },
          compilerOptions: { executorRequest: true },
          filters: { execute: true },
          tools: [],
          libraries: [],
        },
        lang: "c++",
        allowStoreCodeDebug: false,
      }),
    });
  } catch (e) {
    return { ok: false, unavailable: true, err: "Compiler Explorer injoignable depuis cette page (réseau bloqué ou hors ligne)." };
  }
  if (!res.ok) return { ok: false, unavailable: true, err: `Compiler Explorer a répondu ${res.status}.` };
  const j = await res.json();
  const txt = (arr) => (arr || []).map((x) => x.text).join("\n");
  const build = j.buildResult || j;
  const buildErr = txt(build.stderr);
  if ((build.code ?? 0) !== 0 || j.didExecute === false) {
    return { ok: false, compile: true, out: "", err: buildErr || "La compilation a échoué." };
  }
  const out = txt(j.stdout);
  const err = txt(j.stderr);
  return { ok: (j.code ?? 0) === 0, out, err: err + (buildErr ? `\n[avertissements]\n${buildErr}` : ""), code: j.code };
}
