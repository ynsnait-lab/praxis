#!/usr/bin/env python3
"""Chargement du contenu Praxis (YAML) et assemblage du paquet embarqué dans la page.

Le YAML est écrit à la main, en français : les « : » et les « # » y sont partout.
Pour éviter les pièges du YAML, les valeurs des clés de texte (q, t, why, e, title…)
sont converties automatiquement en blocs littéraux avant l'analyse. On peut donc écrire

    q: Que vaut `x` ici : 3 ou 4 ?

sans guillemets. Une valeur entièrement entre guillemets est laissée telle quelle.

Usage : python3 tools/content.py [--out dist/content.json]
"""
from __future__ import annotations

import json
import re
import sys
from datetime import date
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "content"

TEXT_KEYS = {
    "q", "t", "why", "e", "title", "goal", "hint", "back", "why_short", "en", "unit", "summary", "answer",
    "fix", "desc", "context", "caption", "label", "duration", "symptom", "summary_long",
}
TEXT_LIST_KEYS = {"lines", "extra", "accept", "trap_answers", "recap", "criteria", "vocab"}
RE_KEY = re.compile(r"^(\s*)(- )?([A-Za-z_]+): (.*)$")
RE_ITEM = re.compile(r"^(\s*)- (.*)$")
RE_KEYONLY = re.compile(r"^(\s*)(- )?([A-Za-z_]+):\s*$")


def _quoted(v: str) -> bool:
    v = v.strip()
    return len(v) >= 2 and ((v[0] == '"' and v[-1] == '"') or (v[0] == "'" and v[-1] == "'"))


def _dq(v: str) -> str:
    """Chaîne YAML entre guillemets doubles, qui préserve les espaces de tête."""
    return '"' + v.replace("\\", "\\\\").replace('"', '\\"') + '"'


def preprocess(src: str) -> str:
    out = []
    list_ctx = None  # (indentation de la clé, nom) quand on est dans une liste de textes
    for line in src.split("\n"):
        stripped = line.strip()
        indent = len(line) - len(line.lstrip(" "))
        if list_ctx and stripped and not stripped.startswith("#") and indent <= list_ctx[0] and not (indent == list_ctx[0] and stripped.startswith("- ")):
            list_ctx = None
        m_keyonly = RE_KEYONLY.match(line)
        if m_keyonly and m_keyonly.group(3) in TEXT_LIST_KEYS:
            base = len(m_keyonly.group(1)) + (2 if m_keyonly.group(2) else 0)
            list_ctx = (base, m_keyonly.group(3))
            out.append(line)
            continue
        if list_ctx:
            m_item = RE_ITEM.match(line)
            if m_item and len(m_item.group(1)) >= list_ctx[0]:
                val = m_item.group(2)
                if val.startswith(" ") and val.strip():
                    out.append(f"{m_item.group(1)}- {_dq(val)}")
                    continue
                if val and not val.startswith(("|", ">")) and not _quoted(val) and not (val.startswith("[") and list_ctx[1] not in ("lines", "extra")):
                    pad = " " * (len(m_item.group(1)) + 4)
                    out.append(f"{m_item.group(1)}- |-")
                    out.append(pad + val)
                    continue
                out.append(line)
                continue
        m = RE_KEY.match(line)
        if m and m.group(3) in TEXT_KEYS:
            ind, dash, key, val = m.groups()
            if val.startswith(" ") and val.strip():
                out.append(f"{ind}{dash or ''}{key}: {_dq(val)}")
                continue
            if val and not val.startswith(("|", ">")) and not _quoted(val):
                pad = " " * (len(ind) + (2 if dash else 0) + 2)
                out.append(f"{ind}{dash or ''}{key}: |-")
                out.append(pad + val)
                continue
        out.append(line)
    return "\n".join(out)


def load(path) -> object:
    text = Path(path).read_text(encoding="utf-8")
    try:
        return yaml.safe_load(preprocess(text))
    except yaml.YAMLError as e:
        raise SystemExit(f"YAML invalide dans {path} :\n{e}") from e


def _vocab(v):
    out = []
    for item in v or []:
        if isinstance(item, list):
            out.append([str(item[0]), str(item[1])])
        else:
            s = str(item)
            if " = " in s:
                fr, en = s.split(" = ", 1)
                out.append([fr.strip(), en.strip()])
    return out


# ------------------------------------------------------------------ chargement brut

def load_raw():
    """Renvoie (modules, domaines, quiz, pièges, concepts, défis, mémos, labs, pistes, méta)."""
    tracks = load(CONTENT / "tracks.yaml")
    modules = []
    for track in ("python", "cpp"):
        for p in sorted((CONTENT / track).glob("*.yaml")):
            m = load(p)
            m["_file"] = str(p.relative_to(ROOT))
            m.setdefault("track", track)
            m["vocab"] = _vocab(m.get("vocab"))
            modules.append(m)
    domains = []
    for p in sorted((CONTENT / "inge").glob("*.yaml")):
        d = load(p)
        d["_file"] = str(p.relative_to(ROOT))
        d["vocab"] = _vocab(d.get("vocab"))
        domains.append(d)
        for n in d.get("notions") or []:
            n["track"] = "inge"
            n["domain"] = d["id"]
            n["_file"] = d["_file"]
            n["vocab"] = _vocab(n.get("vocab"))
            modules.append(n)
    quiz = {}
    for p in sorted((CONTENT / "inge" / "_calibre").glob("*.yaml")):
        c = load(p)
        quiz.setdefault(c["domain"], []).extend(c.get("exercises") or [])
    for d in domains:
        if d.get("exercises"):
            quiz.setdefault(d["id"], [])[:0] = d["exercises"]
    opt = lambda name, default: load(CONTENT / name) if (CONTENT / name).exists() else default  # noqa: E731
    pieges = opt("pieges.yaml", []) or []
    concepts = opt("concepts.yaml", {}) or {}
    memos = opt("memos.yaml", []) or []
    meta = opt("meta.yaml", {}) or {}
    glossaire = opt("glossaire.yaml", []) or []
    return dict(tracks=tracks, modules=modules, domains=domains, quiz=quiz, pieges=pieges, concepts=concepts,
                defis=[], memos=memos, labs=load_labs(), meta=meta, glossaire=glossaire)


# ------------------------------------------------------------------ labs (source : labs/*/lab.json + README.md)

LABS = ROOT / "labs"


def _readme_pour_app(texte: str) -> tuple[str, list[str]]:
    """Adapte le README d'un lab à l'app : sans titre, sans « Cours liés » (l'app met des liens),
    sans diagramme Mermaid (GitHub le dessine, l'app montre le tableau des transitions),
    titres descendus d'un niveau, et « Critères de réussite » extraits pour devenir des cases à cocher."""
    lignes, criteres, i = texte.splitlines(), [], 0
    out = []
    while i < len(lignes):
        l = lignes[i]
        if l.startswith("# ") and not out:
            i += 1
            continue
        if l.startswith("> Cours li"):
            i += 1
            continue
        if l.strip().startswith("```mermaid"):
            i += 1
            while i < len(lignes) and not lignes[i].strip().startswith("```"):
                i += 1
            i += 1
            continue
        if l.strip() == "## Critères de réussite":
            # la liste devient des cases à cocher ; la commande qui la suit est déjà sur la ligne du lab
            i += 1
            while i < len(lignes) and not lignes[i].startswith("## "):
                m = re.match(r"^[-*]\s+(.*)$", lignes[i])
                if m:
                    c = m.group(1).rstrip(" ;.").rstrip()
                    criteres.append(c[:1].upper() + c[1:])
                i += 1
            continue
        out.append("#" + l if l.startswith("## ") else l)
        i += 1
    md = re.sub(r"\n{3,}", "\n\n", "\n".join(out)).strip()
    return md, criteres


def load_labs():
    if not LABS.is_dir():
        return []
    labs = []
    for d in sorted(LABS.iterdir()):
        f = d / "lab.json"
        if not f.is_file():
            continue
        j = json.loads(f.read_text(encoding="utf-8"))
        readme = d / "README.md"
        corps, criteres = _readme_pour_app(readme.read_text(encoding="utf-8")) if readme.is_file() else ("", [])
        labs.append({
            "id": j["id"], "dir": d.name, "order": j.get("ordre", 999), "kind": j.get("genre", "lab"), "lang": j["lang"],
            "level": j.get("niveau"), "minutes": j.get("minutes"), "title": j["titre"], "summary": j.get("resume", ""),
            "modules": j.get("modules") or [], "tools": j.get("outils") or [], "readme": corps, "criteria": criteres,
        })
    return sorted(labs, key=lambda x: x["order"])


# ------------------------------------------------------------------ assemblage

STRIP = {"calc", "verify", "flags", "src", "norun", "expect_error", "syntax_bug", "run", "out", "_file"}


def ex_out(e, mod_id, lang):
    o = {k: v for k, v in e.items() if k not in STRIP}
    o["mod"] = mod_id
    if lang and lang != "python" and not o.get("lang"):
        o["lang"] = lang
    for k in ("answer", "q", "e", "back"):
        if k in o and o[k] is not None and not isinstance(o[k], str) and not (k == "answer" and e.get("type") == "numeric"):
            o[k] = str(o[k])
    if e.get("type") == "numeric":
        o["answer"] = float(e["answer"])
    return o


def lesson_of(m):
    if m.get("lesson"):
        L = dict(m["lesson"])
    elif m.get("steps"):
        L = {k: m.get(k) for k in ("minutes", "intro", "steps", "recap", "pieges") if m.get(k) is not None}
    else:
        return None
    if "minutes" not in L and m.get("minutes"):
        L["minutes"] = m["minutes"]
    steps = []
    for s in L.get("steps") or []:
        s = {k: v for k, v in s.items() if k not in ("verify", "flags")}
        if s.get("out") is not None:
            s["out"] = str(s["out"])
        steps.append(s)
    L["steps"] = steps
    return L


def build(warn=print):
    R = load_raw()
    meta = R["meta"]
    pkg = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
    C = {
        "v": pkg["version"], "built": date.today().isoformat(), "repo": meta.get("repo"), "labsIntro": meta.get("labs_intro", ""),
        "tracks": {}, "modules": {}, "ex": {}, "domains": {}, "pieges": {}, "piegeOrder": [], "concepts": R["concepts"],
        "memos": R["memos"], "labs": R["labs"], "glossary": [],
    }
    by_id = {m["id"]: m for m in R["modules"]}

    def add(m, extra):
        track = m["track"]
        lang = "cpp" if track == "cpp" else ("python" if track == "python" else None)
        ids = []
        for e in m.get("exercises") or []:
            if e["id"] in C["ex"]:
                warn(f"! exercice en double {e['id']}")
            C["ex"][e["id"]] = ex_out(e, m["id"], lang)
            ids.append(e["id"])
        C["modules"][m["id"]] = {
            "id": m["id"], "track": track, "title": m.get("title", ""), "goal": m.get("goal", ""), "en": m.get("en", ""),
            "level": m.get("level"), "requires": m.get("requires") or [], "concepts": m.get("concepts") or [],
            "vocab": m.get("vocab") or [], "lesson": lesson_of(m), "ex": ids, **extra,
        }
        for fr, en in m.get("vocab") or []:
            C["glossary"].append([fr, en, extra.get("domainTitle", ""), m["id"]])

    T = R["tracks"]
    for track in ("python", "cpp"):
        groups = []
        for g in T[track]["groups"]:
            mods = []
            for mid in g["modules"]:
                if mid not in by_id:
                    continue
                add(by_id[mid], {"group": g["id"]})
                mods.append(mid)
            groups.append({"id": g["id"], "title": g["title"], "desc": g.get("desc", ""), "modules": mods})
        C["tracks"][track] = {"id": track, "title": T[track]["title"], "desc": T[track].get("desc", ""), "groups": groups}

    doms = {d["id"]: d for d in R["domains"]}
    igroups = []
    for did in T["inge"]["domains"]:
        d = doms.get(did, {"id": did, "title": did, "notions": []})
        mods = []
        for n in d.get("notions") or []:
            add(n, {"domain": did, "domainTitle": d.get("title", did)})
            mods.append(n["id"])
        quiz = []
        for e in R["quiz"].get(did, []):
            C["ex"][e["id"]] = ex_out(e, f"quiz:{did}", None)
            quiz.append(e["id"])
        for fr, en in d.get("vocab") or []:
            C["glossary"].append([fr, en, d.get("title", did), None])
        if not mods and not quiz:
            continue
        C["domains"][did] = {"id": did, "title": d.get("title", did), "en": d.get("en", ""), "intro": d.get("intro", ""), "modules": mods, "quiz": quiz}
        igroups.append({"id": did, "title": d.get("title", did), "en": d.get("en", ""), "desc": d.get("desc", ""), "modules": mods, "quiz": quiz})
    present = {g["id"] for g in igroups}
    fams = []
    for f in T["inge"].get("families") or []:
        ds = [d for d in f.get("domains", []) if d in present]
        if ds:
            fams.append({"title": f["title"], "domains": ds})
    C["tracks"]["inge"] = {"id": "inge", "title": T["inge"]["title"], "desc": T["inge"].get("desc", ""), "groups": igroups, "families": fams}

    taught = {}
    for m in C["modules"].values():
        for p in (m["lesson"] or {}).get("pieges") or []:
            taught.setdefault(p, []).append(m["id"])
    for p in R["pieges"]:
        mods = list(dict.fromkeys((p.get("modules") or []) + taught.get(p["id"], [])))
        C["pieges"][p["id"]] = {**p, "modules": mods}
        C["piegeOrder"].append(p["id"])
    for e in C["ex"].values():
        if e.get("piege") and e["piege"] not in C["pieges"]:
            warn(f"! piège inconnu {e['piege']} ({e['id']})")

    for row in R["glossaire"]:
        if isinstance(row, str) and " = " in row:
            fr, rest = row.split(" = ", 1)
            en, _, where = rest.partition(" @ ")
            C["glossary"].append([fr.strip(), en.strip(), where.strip(), None])
    seen, gl = set(), []
    for r in C["glossary"]:
        k = (r[0] + "|" + r[1]).lower()
        if k not in seen:
            seen.add(k)
            gl.append(r)
    C["glossary"] = sorted(gl, key=lambda r: r[0].lower())

    return C


def main():
    out = None
    if "--out" in sys.argv:
        out = Path(sys.argv[sys.argv.index("--out") + 1])
    C = build(warn=lambda m: print(m, file=sys.stderr))
    data = json.dumps(C, ensure_ascii=False, separators=(",", ":"))
    if out:
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(data, encoding="utf-8")
    else:
        sys.stdout.write(data)


if __name__ == "__main__":
    main()
