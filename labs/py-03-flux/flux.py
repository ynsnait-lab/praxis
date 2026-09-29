"""Traitement d'un flux de mesures, en générateurs (lab py-03)."""
from collections.abc import Callable, Iterable, Iterator


def lire_mesures(lignes: Iterable[str]) -> Iterator[tuple[float, float]]:
    """Produit (instant, température) pour chaque ligne valide « instant;température »."""
    raise NotImplementedError("à écrire")


def filtrer_plage(mesures: Iterable[tuple[float, float]], mini: float, maxi: float) -> Iterator[tuple[float, float]]:
    """Ne garde que les mesures dont la température est dans [mini, maxi]."""
    raise NotImplementedError("à écrire")


def moyenne_glissante(valeurs: Iterable[float], n: int) -> Iterator[float]:
    """Moyenne des n dernières valeurs, produite à partir de la n-ième."""
    raise NotImplementedError("à écrire")


def fronts_montants(valeurs: Iterable[float], seuil: float) -> Iterator[int]:
    """Indices où la valeur passe de < seuil à >= seuil."""
    raise NotImplementedError("à écrire")


def compteur() -> Callable[[], int]:
    """Renvoie une fonction qui renvoie 1, puis 2, puis 3… à chaque appel."""
    raise NotImplementedError("à écrire")
