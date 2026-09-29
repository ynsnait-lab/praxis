"""Conversions et seuils pour un banc de température (lab py-06) : solution."""
from __future__ import annotations

import json
from enum import Enum


class Unite(Enum):
    CELSIUS = "C"
    KELVIN = "K"
    FAHRENHEIT = "F"


def vers_kelvin(valeur: float, unite: Unite) -> float:
    if unite == Unite.CELSIUS:
        return valeur + 273.15
    if unite == Unite.FAHRENHEIT:
        return (valeur - 32) * 5 / 9 + 273.15
    return valeur


def charger_seuils(texte: str) -> dict[str, float]:
    try:
        donnees = json.loads(texte)
    except json.JSONDecodeError:
        return {}
    return {str(nom): float(v) for nom, v in donnees.items()}


def seuil(seuils: dict[str, float], nom: str) -> float | None:
    return seuils.get(nom)


def marge(seuils: dict[str, float], nom: str, mesure_k: float) -> float | None:
    s = seuil(seuils, nom)
    if s is None:
        return None
    return s - mesure_k


def rapport(seuils: dict[str, float], mesures: dict[str, float]) -> str:
    lignes = ["Rapport de seuils"]
    for nom, mesure in mesures.items():
        m = marge(seuils, nom, mesure)
        lignes.append(f"{nom} : " + ("pas de seuil" if m is None else f"marge {m:.1f} K"))
    return "\n".join(lignes)
