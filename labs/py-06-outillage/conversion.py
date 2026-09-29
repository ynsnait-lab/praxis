"""Conversions et seuils pour un banc de température (lab py-06).

Le code fonctionne (les tests passent), mais ruff et mypy --strict ont beaucoup à dire.
"""
import json
import os
from enum import Enum


class Unite(Enum):
    CELSIUS = "C"
    KELVIN = "K"
    FAHRENHEIT = "F"


def vers_kelvin(valeur, unite):
    if unite == Unite.CELSIUS:
        return valeur + 273.15
    if unite == Unite.FAHRENHEIT:
        return (valeur - 32) * 5 / 9 + 273.15
    return valeur


def charger_seuils(texte):
    try:
        donnees = json.loads(texte)
    except:
        return {}
    return {nom: float(v) for nom, v in donnees.items()}


def seuil(seuils, nom):
    return seuils.get(nom)


def marge(seuils, nom, mesure_k):
    s = seuil(seuils, nom)
    if s == None:
        return None
    return s - mesure_k


def rapport(seuils, mesures):
    lignes = [f"Rapport de seuils"]
    for nom, mesure in mesures.items():
        m = marge(seuils, nom, mesure)
        lignes.append(f"{nom} : " + ("pas de seuil" if m is None else f"marge {m:.1f} K"))
    return "\n".join(lignes)
