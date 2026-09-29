"""Traitement d'un flux de mesures, en générateurs (lab py-03) : solution."""
from collections import deque
from collections.abc import Callable, Iterable, Iterator


def lire_mesures(lignes: Iterable[str]) -> Iterator[tuple[float, float]]:
    """Produit (instant, température) pour chaque ligne valide « instant;température »."""
    for ligne in lignes:
        ligne = ligne.strip()
        if not ligne or ligne.startswith("#"):
            continue
        morceaux = ligne.split(";")
        if len(morceaux) != 2:
            continue
        try:
            yield float(morceaux[0]), float(morceaux[1])
        except ValueError:
            continue


def filtrer_plage(mesures: Iterable[tuple[float, float]], mini: float, maxi: float) -> Iterator[tuple[float, float]]:
    """Ne garde que les mesures dont la température est dans [mini, maxi]."""
    for instant, temperature in mesures:
        if mini <= temperature <= maxi:
            yield instant, temperature


def moyenne_glissante(valeurs: Iterable[float], n: int) -> Iterator[float]:
    """Moyenne des n dernières valeurs, produite à partir de la n-ième."""
    if n <= 0:
        raise ValueError(f"taille de fenêtre invalide : {n}")
    fenetre: deque[float] = deque(maxlen=n)
    for v in valeurs:
        fenetre.append(v)
        if len(fenetre) == n:
            yield sum(fenetre) / n


def fronts_montants(valeurs: Iterable[float], seuil: float) -> Iterator[int]:
    """Indices où la valeur passe de < seuil à >= seuil."""
    precedente = None
    for i, v in enumerate(valeurs):
        if precedente is not None and precedente < seuil <= v:
            yield i
        precedente = v


def compteur() -> Callable[[], int]:
    """Renvoie une fonction qui renvoie 1, puis 2, puis 3… à chaque appel."""
    n = 0

    def suivant() -> int:
        nonlocal n
        n += 1
        return n

    return suivant
