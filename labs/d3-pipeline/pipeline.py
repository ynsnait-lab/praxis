"""Pipeline d'analyse de fichiers de mesures (défi d3)."""
from __future__ import annotations

import logging
from collections.abc import Iterable, Iterator

log = logging.getLogger("pipeline")


def lire_dossier(dossier) -> Iterator[str]:
    raise NotImplementedError("à écrire")


def parser_ligne(ligne: str) -> tuple[str, float] | None:
    raise NotImplementedError("à écrire")


class Statistiques:
    """Accumulateur en flux : n, moyenne, écart-type (population), mini, maxi."""

    def ajouter(self, valeur: float) -> None:
        raise NotImplementedError("à écrire")


def analyser(lignes: Iterable[str], capteur: str | None = None) -> tuple[dict[str, Statistiques], int, int]:
    raise NotImplementedError("à écrire")


def main(argv: list[str] | None = None) -> int:
    raise NotImplementedError("à écrire")


if __name__ == "__main__":
    raise SystemExit(main())
