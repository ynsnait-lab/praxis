"""Résumé de fichiers de mesures en ligne de commande (lab py-08) : solution.

Usage : python acquisition.py fichiers... [--capteur NOM] [--sortie CHEMIN] [-v]
"""
from __future__ import annotations

import argparse
import csv
import json
import logging
from collections import defaultdict
from pathlib import Path

log = logging.getLogger("acquisition")


def construire_parseur() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Résume des fichiers de mesures CSV (horodatage;capteur;valeur).")
    p.add_argument("fichiers", nargs="+", help="fichiers CSV à lire")
    p.add_argument("--capteur", help="ne garder que ce capteur")
    p.add_argument("--sortie", help="écrire le résumé JSON dans ce fichier")
    p.add_argument("-v", "--verbeux", action="store_true", help="journal détaillé")
    return p


def lire(chemin: Path, capteur: str | None, valeurs: dict[str, list[float]]) -> None:
    with open(chemin, newline="", encoding="utf-8") as f:
        for numero, ligne in enumerate(csv.DictReader(f, delimiter=";"), start=2):
            try:
                nom = ligne["capteur"]
                v = float(ligne["valeur"])
            except (TypeError, ValueError, KeyError):
                log.warning("%s, ligne %d ignorée : %r", chemin.name, numero, ligne)
                continue
            if capteur is None or nom == capteur:
                valeurs[nom].append(v)
    log.debug("%s lu", chemin)


def main(argv: list[str] | None = None) -> int:
    """Point d'entrée : renvoie 0 (succès), 1 (aucune mesure) ou 2 (fichier introuvable)."""
    args = construire_parseur().parse_args(argv)
    logging.basicConfig(format="%(levelname)s %(name)s: %(message)s")
    log.setLevel(logging.DEBUG if args.verbeux else logging.INFO)

    valeurs: dict[str, list[float]] = defaultdict(list)
    for nom in args.fichiers:
        chemin = Path(nom)
        if not chemin.is_file():
            log.error("fichier introuvable : %s", chemin)
            return 2
        lire(chemin, args.capteur, valeurs)

    if not valeurs:
        log.error("aucune mesure valide")
        return 1
    resume = {
        nom: {"n": len(v), "moyenne": round(sum(v) / len(v), 3), "min": round(min(v), 3), "max": round(max(v), 3)}
        for nom, v in valeurs.items()
    }
    texte = json.dumps(resume, indent=2, sort_keys=True)
    if args.sortie:
        Path(args.sortie).write_text(texte + "\n", encoding="utf-8")
        log.info("résumé écrit dans %s", args.sortie)
    else:
        print(texte)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
