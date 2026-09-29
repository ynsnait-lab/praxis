"""Pipeline d'analyse de fichiers de mesures (défi d3) : solution."""
from __future__ import annotations

import argparse
import json
import logging
import math
from collections.abc import Iterable, Iterator
from pathlib import Path

log = logging.getLogger("pipeline")
ENTETE = "horodatage;"


def lire_dossier(dossier) -> Iterator[str]:
    """Enchaîne les lignes de tous les CSV du dossier, un fichier ouvert à la fois."""
    for chemin in sorted(Path(dossier).glob("*.csv")):
        log.debug("lecture de %s", chemin.name)
        with open(chemin, encoding="utf-8") as f:
            yield from f


def parser_ligne(ligne: str) -> tuple[str, float] | None:
    morceaux = ligne.strip().split(";")
    if len(morceaux) != 4 or not morceaux[1]:
        return None
    try:
        return morceaux[1], float(morceaux[2])
    except ValueError:
        return None


class Statistiques:
    """Accumulateur en flux (algorithme de Welford) : ne garde aucune valeur."""

    def __init__(self) -> None:
        self.n = 0
        self.moyenne = 0.0
        self._m2 = 0.0
        self.mini = math.inf
        self.maxi = -math.inf

    def ajouter(self, valeur: float) -> None:
        self.n += 1
        delta = valeur - self.moyenne
        self.moyenne += delta / self.n
        self._m2 += delta * (valeur - self.moyenne)
        self.mini = min(self.mini, valeur)
        self.maxi = max(self.maxi, valeur)

    @property
    def ecart_type(self) -> float:
        return math.sqrt(self._m2 / self.n) if self.n else 0.0


def analyser(lignes: Iterable[str], capteur: str | None = None) -> tuple[dict[str, Statistiques], int, int]:
    stats: dict[str, Statistiques] = {}
    n_lignes = rejets = 0
    for ligne in lignes:
        if ligne.startswith(ENTETE):
            continue
        n_lignes += 1
        mesure = parser_ligne(ligne)
        if mesure is None:
            rejets += 1
            log.debug("ligne rejetée : %r", ligne)
            continue
        nom, valeur = mesure
        if capteur is None or nom == capteur:
            stats.setdefault(nom, Statistiques()).ajouter(valeur)
    return stats, n_lignes, rejets


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Rapport par capteur sur un dossier de fichiers CSV.")
    p.add_argument("--dossier", required=True)
    p.add_argument("--sortie")
    p.add_argument("--capteur")
    p.add_argument("-v", "--verbeux", action="store_true")
    args = p.parse_args(argv)
    logging.basicConfig(format="%(levelname)s %(name)s: %(message)s")
    log.setLevel(logging.DEBUG if args.verbeux else logging.INFO)

    dossier = Path(args.dossier)
    if not dossier.is_dir():
        log.error("dossier introuvable : %s", dossier)
        return 2
    stats, n_lignes, rejets = analyser(lire_dossier(dossier), args.capteur)
    if not stats:
        log.error("aucune mesure valide")
        return 1
    rapport = {
        "capteurs": {
            nom: {"n": s.n, "moyenne": round(s.moyenne, 4), "ecart_type": round(s.ecart_type, 4),
                  "min": s.mini, "max": s.maxi}
            for nom, s in stats.items()
        },
        "lignes": n_lignes,
        "rejets": rejets,
        "taux_rejet": round(100 * rejets / n_lignes, 4) if n_lignes else 0.0,
    }
    texte = json.dumps(rapport, indent=2, sort_keys=True)
    if args.sortie:
        Path(args.sortie).write_text(texte + "\n", encoding="utf-8")
        log.info("rapport écrit dans %s (%d lignes, %d rejets)", args.sortie, n_lignes, rejets)
    else:
        print(texte)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
