"""Mesures, séries et instruments (lab py-05) : solution."""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass(frozen=True)
class Mesure:
    capteur: str
    valeur: float
    unite: str = "K"

    def __post_init__(self) -> None:
        if self.unite == "K" and self.valeur <= 0:
            raise ValueError(f"{self.valeur} K : une température absolue est strictement positive")


class Serie:
    """Série de mesures d'un capteur."""

    def __init__(self, capteur: str, unite: str = "K") -> None:
        self.capteur = capteur
        self.unite = unite
        self._mesures: list[Mesure] = []          # une liste par série

    def ajouter(self, valeur: float) -> Serie:
        self._mesures.append(Mesure(self.capteur, valeur, self.unite))
        return self

    @classmethod
    def depuis_texte(cls, capteur: str, texte: str) -> Serie:
        serie = cls(capteur)
        for morceau in texte.split(";"):
            serie.ajouter(float(morceau))
        return serie

    def __len__(self) -> int:
        return len(self._mesures)

    def __iter__(self):
        return iter(self._mesures)

    def __getitem__(self, i: int) -> Mesure:
        return self._mesures[i]

    def __contains__(self, valeur: object) -> bool:
        return any(m.valeur == valeur for m in self._mesures)

    @property
    def moyenne(self) -> float:
        return sum(m.valeur for m in self._mesures) / len(self._mesures) if self._mesures else 0.0

    def __repr__(self) -> str:
        return f"Serie({self.capteur!r}, {len(self)} mesures)"


class Instrument(ABC):
    @abstractmethod
    def lire(self) -> float: ...


class ThermometreSimule(Instrument):
    """Renvoie des valeurs prédéfinies, une à une."""

    def __init__(self, valeurs: list[float]) -> None:
        self._valeurs = iter(valeurs)

    def lire(self) -> float:
        v = next(self._valeurs, None)
        if v is None:
            raise RuntimeError("plus de valeurs")
        return v
