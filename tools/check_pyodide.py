"""Compare les sorties affichées dans les cours avec Pyodide, l'interpréteur Python de l'app (3.14).

Le validateur (tools/validate.py) exécute les extraits avec le Python de la machine ; celui-ci les
rejoue dans le navigateur « simulé » (Node + Pyodide), là où le lecteur clique sur Exécuter.

Usage : python3 tools/check_pyodide.py [préfixe_de_module] [--ex]   (--ex : aussi les exercices « prédire »)
Prérequis : npm ci (paquet pyodide dans node_modules).
"""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
from validate import lang_of, load_all, norm_out  # noqa: E402


def main() -> int:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    only = args[0] if args else ""
    with_ex = "--ex" in sys.argv
    modules, *_ = load_all()
    items, expect = [], {}
    for m in modules:
        if only and not m["id"].startswith(only):
            continue
        lesson = m.get("lesson") or ({"steps": m.get("steps")} if m.get("steps") else None)
        for i, st in enumerate((lesson or {}).get("steps") or []):
            lang = st.get("lang") or ("cpp" if m.get("track") == "cpp" else "python")
            if lang == "python" and st.get("code") and st.get("out") is not None and st.get("verify", True) and st.get("run"):
                k = f"{m['id']} étape {i + 1}"
                items.append({"id": k, "code": st["code"]})
                expect[k] = [str(st["out"])]
        if with_ex:
            for ex in m.get("exercises") or []:
                if ex.get("type") == "predict" and lang_of(ex, m) == "python" and not ex.get("norun") and not ex.get("expect_error"):
                    k = f"{m['id']}:{ex['id']}"
                    items.append({"id": k, "code": ex["code"]})
                    expect[k] = [str(ex["answer"])] + [str(a) for a in ex.get("accept") or []]
    with tempfile.TemporaryDirectory() as d:
        fi, fo = Path(d) / "in.json", Path(d) / "out.json"
        fi.write_text(json.dumps(items), encoding="utf-8")
        p = subprocess.run(["node", str(ROOT / "tools" / "pyodide_run.mjs"), str(fi), str(fo)],
                           capture_output=True, text=True, timeout=1800)
        if p.returncode != 0:
            print(p.stderr[-2000:])
            return 1
        res = json.loads(fo.read_text(encoding="utf-8"))
    bad = 0
    for r in res:
        got = norm_out(r["out"])
        if r["err"] or got not in [norm_out(e) for e in expect[r["id"]]]:
            bad += 1
            print(f"≠ {r['id']}\n  attendu : {expect[r['id']][0]!r}\n  pyodide : {r['out']!r}\n  erreur  : {r['err']}")
    print(f"{len(res)} extraits rejoués dans Pyodide, {bad} différence(s)")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
