#!/usr/bin/env python3
"""Valide tout le contenu de Praxis.

- Vérifie le schéma (identifiants uniques, champs obligatoires, références).
- Exécute les exemples et les corrigés : sorties prédites, tests des exercices
  de code, blocs à trous, lignes à remettre dans l'ordre, calculs numériques.

Usage : python3 tools/validate.py [--no-run] [--only PREFIXE] [-j N] [-v]
Code de sortie non nul si une erreur est trouvée.
"""
from __future__ import annotations

import argparse
import concurrent.futures as cf
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "content"

TYPES = {"qcm", "predict", "cloze", "code", "bug", "flash", "parsons", "numeric"}
LEVELS_STEP = {1, 2, 3, 4, 5}
BLANK = re.compile(r"⟦(\d+)⟧")

CXX = os.environ.get("CXX") or shutil.which("g++") or shutil.which("clang++") or "c++"
CXXFLAGS = ["-std=c++20", "-O1", "-g", "-Wall", "-Wextra"]
SAN = ["-fsanitize=address,undefined", "-fno-sanitize-recover=all"]
CPP_PRELUDE = (
    "#include <algorithm>\n#include <array>\n#include <cstdint>\n#include <cstdio>\n#include <cstring>\n"
    "#include <iostream>\n#include <map>\n#include <memory>\n#include <optional>\n#include <span>\n"
    "#include <string>\n#include <string_view>\n#include <utility>\n#include <vector>\n"
)


class Report:
    def __init__(self) -> None:
        self.errors: list[str] = []
        self.warnings: list[str] = []
        self.ok = 0

    def err(self, where: str, msg: str) -> None:
        self.errors.append(f"✗ {where} : {msg}")

    def warn(self, where: str, msg: str) -> None:
        self.warnings.append(f"! {where} : {msg}")


# ---------------------------------------------------------------- chargement

def load_all():
    from content import load_raw
    R = load_raw()
    return R["modules"], R["domains"], R["quiz"], R["pieges"], R["concepts"], R["defis"], R["memos"]


def lang_of(ex, mod):
    if ex.get("lang"):
        return ex["lang"]
    return "cpp" if mod.get("track") == "cpp" else "python"


# ---------------------------------------------------------------- exécution

def norm_out(s: str) -> str:
    s = (s or "").replace("\r\n", "\n")
    return "\n".join(line.rstrip() for line in s.strip("\n").split("\n")).strip()


def run_python(code: str, timeout=20):
    with tempfile.TemporaryDirectory() as d:
        f = Path(d) / "main.py"
        f.write_text(code, encoding="utf-8")
        try:
            p = subprocess.run([sys.executable, str(f)], capture_output=True, text=True, timeout=timeout, cwd=d)
        except subprocess.TimeoutExpired:
            return None, "timeout"
        return p.returncode, p.stdout + (("\n[stderr]\n" + p.stderr) if p.stderr else "")


def run_python_stdout(code: str, timeout=20):
    with tempfile.TemporaryDirectory() as d:
        f = Path(d) / "main.py"
        f.write_text(code, encoding="utf-8")
        try:
            p = subprocess.run([sys.executable, str(f)], capture_output=True, text=True, timeout=timeout, cwd=d)
        except subprocess.TimeoutExpired:
            return None, "", "timeout"
        return p.returncode, p.stdout, p.stderr


def compile_cpp(src: str, run=True, sanitize=False, syntax_only=False, timeout=60, extra_flags=None):
    with tempfile.TemporaryDirectory() as d:
        f = Path(d) / "main.cpp"
        f.write_text(src, encoding="utf-8")
        exe = Path(d) / "a.out"
        flags = CXXFLAGS + (SAN if sanitize else []) + (extra_flags or [])
        cmd = [CXX, *flags, str(f)] + (["-fsyntax-only"] if syntax_only else ["-o", str(exe)])
        try:
            p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, cwd=d)
        except subprocess.TimeoutExpired:
            return "compile-timeout", "", ""
        if p.returncode != 0:
            return "compile-error", "", p.stderr
        if syntax_only or not run:
            return "ok", "", p.stderr
        try:
            r = subprocess.run([str(exe)], capture_output=True, text=True, timeout=20, cwd=d)
        except subprocess.TimeoutExpired:
            return "run-timeout", "", ""
        return ("ok" if r.returncode == 0 else f"exit-{r.returncode}"), r.stdout, r.stderr


def fill_cloze(tpl: str, blanks) -> str:
    return BLANK.sub(lambda m: str(blanks[int(m.group(1))][0]), tpl)


# ---------------------------------------------------------------- vérifs

def check_schema(modules, domains, calibre, pieges, concepts, defis, memos, rep: Report):
    ids = {}
    mod_ids = {m["id"] for m in modules}
    piege_ids = {p["id"] for p in pieges}
    for p in pieges:
        for k in ("id", "track", "title", "why", "fix"):
            if not p.get(k):
                rep.err(f"piège {p.get('id')}", f"champ « {k} » manquant")
        for r in p.get("modules", []) or []:
            if r not in mod_ids:
                rep.err(f"piège {p['id']}", f"module inconnu {r}")
    if len(piege_ids) != len(pieges):
        rep.err("pieges.yaml", "identifiants en double")
    for m in modules:
        where = f"{m.get('_file')}:{m.get('id')}"
        for k in ("id", "title"):
            if not m.get(k):
                rep.err(where, f"champ « {k} » manquant")
        if m["id"] in ids:
            rep.err(where, f"id de module en double (déjà dans {ids[m['id']]})")
        ids[m["id"]] = where
        for r in m.get("requires", []) or []:
            if r not in mod_ids:
                rep.err(where, f"prérequis inconnu {r}")
        for pg in (m.get("lesson") or {}).get("pieges", []) or m.get("pieges", []) or []:
            if pg not in piege_ids:
                rep.err(where, f"piège inconnu {pg}")
        lesson = m.get("lesson") or ({"steps": m["steps"]} if m.get("steps") else None)
        if lesson:
            last = 0
            for i, st in enumerate(lesson.get("steps", [])):
                sw = f"{where} étape {i + 1}"
                if st.get("level") not in LEVELS_STEP:
                    rep.err(sw, f"niveau d'étape invalide {st.get('level')}")
                elif st["level"] < last:
                    rep.warn(sw, "le crescendo redescend")
                last = st.get("level", last)
                if not st.get("title") or not (st.get("body") or st.get("code")):
                    rep.err(sw, "titre ou contenu manquant")
                if st.get("check"):
                    chk = st["check"]
                    if not chk.get("q") or not chk.get("choices"):
                        rep.err(sw, "mini-question incomplète")
                    elif not any(c.get("ok") for c in chk["choices"]):
                        rep.err(sw, "mini-question sans bonne réponse")
        for ex in m.get("exercises", []) or []:
            check_ex_schema(ex, m, ids, piege_ids, rep)
    for dom, exs in calibre.items():
        for ex in exs:
            check_ex_schema(ex, {"id": f"calibre:{dom}", "track": "inge", "_file": f"_calibre/{dom}"}, ids, piege_ids, rep)
    for d in defis:
        if not d.get("id") or not d.get("title"):
            rep.err("defis.yaml", f"défi incomplet {d}")


def check_ex_schema(ex, m, ids, piege_ids, rep: Report):
    where = f"{m.get('_file')}:{ex.get('id')}"
    eid = ex.get("id")
    if not eid:
        rep.err(where, "exercice sans id")
        return
    if eid in ids:
        rep.err(where, f"id en double (déjà dans {ids[eid]})")
    ids[eid] = where
    t = ex.get("type")
    if t not in TYPES:
        rep.err(where, f"type inconnu {t}")
        return
    if ex.get("level") not in (1, 2, 3):
        rep.err(where, f"niveau invalide {ex.get('level')}")
    if not ex.get("q"):
        rep.err(where, "question manquante")
    if not ex.get("e") and t != "flash":
        rep.warn(where, "pas d'explication")
    if ex.get("piege") and ex["piege"] not in piege_ids:
        rep.err(where, f"piège inconnu {ex['piege']}")
    need = {
        "qcm": ["choices"], "predict": ["code", "answer"], "cloze": ["tpl", "blanks"], "code": ["start", "sol", "tests"],
        "bug": ["code", "bad", "fix"], "flash": ["back"], "parsons": ["lines"], "numeric": ["answer"],
    }[t]
    for k in need:
        if ex.get(k) in (None, "", []):
            rep.err(where, f"champ « {k} » manquant pour {t}")
    if t == "qcm" and ex.get("choices"):
        n_ok = sum(1 for c in ex["choices"] if c.get("ok"))
        if n_ok == 0:
            rep.err(where, "aucune bonne réponse")
        if n_ok > 1 and not ex.get("multi"):
            rep.err(where, "plusieurs bonnes réponses sans multi: true")
        if len({c["t"] for c in ex["choices"]}) != len(ex["choices"]):
            rep.err(where, "choix en double")
    if t == "cloze" and ex.get("tpl"):
        n = len(set(BLANK.findall(ex["tpl"])))
        if n != len(ex.get("blanks", [])):
            rep.err(where, f"{n} trous dans le texte mais {len(ex.get('blanks', []))} réponses")
    if t == "bug" and ex.get("code"):
        nl = len(ex["code"].split("\n"))
        if not (1 <= int(ex.get("bad", 0)) <= nl):
            rep.err(where, f"ligne fautive {ex.get('bad')} hors du code ({nl} lignes)")
    if t == "numeric":
        try:
            float(ex["answer"])
        except (TypeError, ValueError):
            rep.err(where, "réponse numérique non numérique")


def jobs_for(modules, calibre, only, rep: Report):
    jobs = []
    for m in modules:
        if only and not m["id"].startswith(only):
            continue
        lesson = m.get("lesson") or ({"steps": m.get("steps")} if m.get("steps") else None)
        if lesson:
            for i, st in enumerate(lesson.get("steps") or []):
                if st.get("code") and st.get("verify", True):
                    lang = st.get("lang") or ("cpp" if m.get("track") == "cpp" else "python")
                    if lang in ("python", "cpp") and (st.get("out") is not None or st.get("run") or st.get("verify") == "compile"):
                        jobs.append(("step", m, i, st, lang))
        for ex in m.get("exercises", []) or []:
            jobs.append(("ex", m, None, ex, lang_of(ex, m)))
    for dom, exs in calibre.items():
        for ex in exs:
            if ex.get("type") == "numeric":
                jobs.append(("ex", {"id": dom, "track": "inge", "_file": "_calibre"}, None, ex, "python"))
    return jobs


def run_job(job):
    kind, m, idx, item, lang = job
    where = f"{m.get('_file')}:{m['id']}" + (f" étape {idx + 1}" if kind == "step" else f":{item.get('id')}")
    errs, warns = [], []
    try:
        if kind == "step":
            if lang == "python":
                rc, out, err = run_python_stdout(item["code"])
                if item.get("out") is not None:
                    if norm_out(out) != norm_out(str(item["out"])):
                        errs.append(f"sortie de l'exemple différente\n  attendu : {item['out']!r}\n  obtenu  : {out!r}\n  stderr : {err[-300:]!r}")
                elif rc not in (0,) and not item.get("raises"):
                    errs.append(f"l'exemple plante : {err[-400:]!r}")
            else:
                code = item["code"] if "int main" in item["code"] else None
                if code is None:
                    status, _, e = compile_cpp(CPP_PRELUDE + item["code"], syntax_only=True)
                    if status != "ok" and item.get("verify") != "fragment":
                        errs.append(f"l'exemple C++ ne compile pas : {e[-600:]}")
                else:
                    status, out, e = compile_cpp(code, run=item.get("out") is not None, extra_flags=item.get("flags"))
                    if item.get("out") is not None:
                        if status not in ("ok",) and not item.get("exit"):
                            errs.append(f"exemple C++ : {status} {e[-600:]}")
                        elif norm_out(out) != norm_out(str(item["out"])):
                            errs.append(f"sortie C++ différente\n  attendu : {item['out']!r}\n  obtenu  : {out!r}")
                    elif status != "ok":
                        errs.append(f"exemple C++ : {status} {e[-600:]}")
            return where, errs, warns
        ex = item
        t = ex["type"]
        if t == "predict" and not ex.get("norun"):
            expected = [norm_out(str(ex["answer"]))] + [norm_out(str(a)) for a in ex.get("accept", []) or []]
            if lang == "python":
                rc, out, err = run_python_stdout(ex["code"])
                got = norm_out(out)
                if ex.get("expect_error"):
                    got = norm_out(out + "\n" + (err.strip().split("\n")[-1] if err else ""))
                if got not in expected and norm_out(out) not in expected:
                    errs.append(f"sortie réelle ≠ réponse\n  réponse : {ex['answer']!r}\n  réelle  : {out!r}\n  stderr  : {err[-300:]!r}")
            elif lang == "cpp":
                status, out, err = compile_cpp(ex["code"], extra_flags=ex.get("flags"))
                if status == "compile-error":
                    errs.append(f"ne compile pas : {err[-600:]}")
                elif norm_out(out) not in expected:
                    errs.append(f"sortie réelle ≠ réponse ({status})\n  réponse : {ex['answer']!r}\n  réelle  : {out!r}")
        elif t == "code":
            if lang == "python":
                rc, out, err = run_python_stdout(ex["sol"] + "\n\n" + ex["tests"])
                if "OK" not in out.split():
                    errs.append(f"le corrigé ne passe pas les tests : {out[-300:]!r} {err[-500:]!r}")
                rc2, out2, err2 = run_python_stdout(ex["start"] + "\n\n" + ex["tests"])
                if "OK" in out2.split():
                    errs.append("le code de départ passe déjà les tests (tests trop faibles)")
            elif lang == "cpp":
                status, out, err = compile_cpp(ex["sol"] + "\n\n" + ex["tests"], sanitize=True)
                if status != "ok" or "OK" not in out.split():
                    errs.append(f"corrigé C++ : {status} {out[-200:]!r} {err[-800:]}")
                status2, out2, _ = compile_cpp(ex["start"] + "\n\n" + ex["tests"], sanitize=False)
                if status2 == "ok" and "OK" in out2.split():
                    errs.append("le code de départ C++ passe déjà les tests")
        elif t == "cloze":
            code = fill_cloze(ex["tpl"], ex["blanks"])
            if lang == "python":
                try:
                    compile(code, "<cloze>", "exec")
                except SyntaxError as e:
                    errs.append(f"texte à trous rempli invalide : {e}")
                if ex.get("run"):
                    rc, out, err = run_python_stdout(code)
                    if rc != 0:
                        errs.append(f"texte à trous rempli plante : {err[-300:]}")
                    elif ex.get("out") is not None and norm_out(out) != norm_out(str(ex["out"])):
                        errs.append(f"sortie du texte à trous ≠ attendu : {out!r}")
            elif lang == "cpp" and ex.get("verify", "auto") != "skip":
                src = code if "int main" in code else CPP_PRELUDE + ex.get("verify_prelude", "") + "\n" + code
                status, _, e = compile_cpp(src, syntax_only=True)
                if status != "ok":
                    (errs if ex.get("verify") == "compile" else warns).append(f"texte à trous C++ ne compile pas : {e[-400:]}")
        elif t == "parsons":
            code = "\n".join(ex["lines"])
            if lang == "python":
                try:
                    compile(code, "<parsons>", "exec")
                except SyntaxError as e:
                    errs.append(f"ordre correct invalide : {e}")
            elif lang == "cpp" and ex.get("verify", "auto") != "skip":
                src = code if "int main" in code else CPP_PRELUDE + ex.get("verify_prelude", "") + "\n" + code
                status, _, e = compile_cpp(src, syntax_only=True)
                if status != "ok":
                    (errs if ex.get("verify") == "compile" else warns).append(f"parsons C++ ne compile pas : {e[-400:]}")
        elif t == "bug":
            lines = ex["code"].split("\n")
            lines[int(ex["bad"]) - 1] = ex["fix"]
            code = ex["fixed"] if ex.get("fixed") else "\n".join(lines)
            if lang == "python":
                try:
                    compile(code, "<bug>", "exec")
                except SyntaxError as e:
                    warns.append(f"code corrigé invalide : {e}")
                try:
                    compile(ex["code"], "<bug-orig>", "exec")
                except SyntaxError as e:
                    if not ex.get("syntax_bug"):
                        warns.append(f"code fautif ne compile même pas (syntaxe) : {e}")
        elif t == "numeric" and ex.get("calc"):
            env = {k: getattr(math, k) for k in dir(math) if not k.startswith("_")}
            env.update(abs=abs, min=min, max=max, round=round, sum=sum)
            val = eval(ex["calc"], {"__builtins__": {}}, env)  # contenu du dépôt, pas d'entrée utilisateur
            ans = float(ex["answer"])
            tol = float(ex.get("tol", 0.02))
            if ans == 0:
                ok = abs(val) <= tol
            else:
                ok = abs(val - ans) <= tol * abs(ans)
            if not ok:
                errs.append(f"calcul {ex['calc']} = {val:.6g} ≠ réponse {ans} (tol {tol})")
    except Exception as e:  # noqa: BLE001
        errs.append(f"erreur du validateur : {type(e).__name__}: {e}")
    return where, errs, warns


def check_labs(modules, rep: Report):
    """Structure des labs : métadonnées, fichiers attendus, solution, règles de style compilables.
    Les labs eux-mêmes se vérifient avec ./praxis check --all --solution."""
    import json
    labs_dir, sol_dir = ROOT / "labs", ROOT / "solutions"
    mod_ids = {m["id"] for m in modules}
    ids, ordres = {}, {}
    for d in sorted(p for p in labs_dir.iterdir() if (p / "lab.json").is_file()):
        where = f"labs/{d.name}"
        try:
            j = json.loads((d / "lab.json").read_text(encoding="utf-8"))
        except ValueError as e:
            rep.err(where, f"lab.json illisible : {e}")
            continue
        for k in ("id", "ordre", "lang", "genre", "niveau", "minutes", "titre", "resume", "modules"):
            if k not in j:
                rep.err(where, f"lab.json : champ « {k} » manquant")
        if j.get("lang") not in ("python", "cpp"):
            rep.err(where, f"langage inconnu : {j.get('lang')}")
        if j.get("genre") not in ("lab", "defi"):
            rep.err(where, f"genre inconnu : {j.get('genre')}")
        for key, seen in (("id", ids), ("ordre", ordres)):
            v = j.get(key)
            if v in seen:
                rep.err(where, f"{key} {v!r} déjà pris par {seen[v]}")
            seen[v] = d.name
        for m in j.get("modules") or []:
            if m not in mod_ids:
                rep.err(where, f"module inconnu : {m}")
        attendus = ["README.md", "INDICES.md"] + (["CMakeLists.txt"] if j.get("lang") == "cpp" else [])
        for f in attendus + list(j.get("fichiers") or []):
            if not (d / f).is_file():
                rep.err(where, f"fichier manquant : {f}")
        if not any(p.name.startswith("test_") for p in d.iterdir()):
            rep.err(where, "aucun fichier de test (test_*)")
        if (d / "INDICES.md").is_file() and "\n## " not in (d / "INDICES.md").read_text(encoding="utf-8"):
            rep.err(where, "INDICES.md sans indice (titres « ## »)")
        if j.get("lang") == "cpp" and (d / "CMakeLists.txt").is_file() and "TIMEOUT" not in (d / "CMakeLists.txt").read_text(encoding="utf-8"):
            rep.err(where, "CMakeLists.txt : pas de TIMEOUT sur les tests (une boucle infinie bloquerait la CI)")
        sol = sol_dir / d.name
        if not sol.is_dir() or not any(p.is_file() for p in sol.rglob("*")):
            rep.err(where, f"pas de solution de référence dans solutions/{d.name}")
        for regle in list(j.get("interdits") or []) + list(j.get("requis") or []):
            try:
                re.compile(regle["motif"])
            except (re.error, KeyError) as e:
                rep.err(where, f"règle de style invalide {regle} : {e}")
            if not (d / regle.get("fichier", "")).is_file():
                rep.err(where, f"règle de style sur un fichier absent : {regle.get('fichier')}")
        rep.ok += 1


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-run", action="store_true")
    ap.add_argument("--only", default="")
    ap.add_argument("-j", type=int, default=os.cpu_count() or 4)
    ap.add_argument("-v", action="store_true")
    a = ap.parse_args()
    rep = Report()
    modules, domains, calibre, pieges, concepts, defis, memos = load_all()
    check_schema(modules, domains, calibre, pieges, concepts, defis, memos, rep)
    check_labs(modules, rep)
    n_ex =sum(len(m.get("exercises", []) or []) for m in modules) + sum(len(v) for v in calibre.values())
    if not a.no_run:
        jobs = jobs_for(modules, calibre, a.only, rep)
        with cf.ThreadPoolExecutor(max_workers=a.j) as pool:
            for where, errs, warns in pool.map(run_job, jobs):
                for e in errs:
                    rep.err(where, e)
                for w in warns:
                    rep.warn(where, w)
                if not errs:
                    rep.ok += 1
    if a.v or rep.warnings:
        for w in rep.warnings:
            print(w)
    for e in rep.errors:
        print(e)
    n_lessons = sum(1 for m in modules if m.get("lesson") or m.get("steps"))
    print(f"\n{len(modules)} modules/notions ({n_lessons} avec cours), {n_ex} exercices, {len(pieges)} pièges — "
          f"{rep.ok} vérifications exécutées OK, {len(rep.warnings)} avertissements, {len(rep.errors)} erreurs")
    sys.exit(1 if rep.errors else 0)


if __name__ == "__main__":
    main()
