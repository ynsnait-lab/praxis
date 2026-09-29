"""Petites fonctions de gestion de mesures : version corrigée."""
import copy


def ajouter(mesure, historique=None):
    """Ajoute `mesure` à `historique` (ou à une liste neuve) et renvoie la liste."""
    # Une valeur par défaut est évaluée une seule fois : une liste par défaut serait partagée.
    if historique is None:
        historique = []
    historique.append(mesure)
    return historique


def copie_config(config):
    """Renvoie une copie indépendante d'une configuration imbriquée (dicts et listes)."""
    # dict.copy() ne copie que le premier niveau : les listes intérieures resteraient partagées.
    return copy.deepcopy(config)


def grille(lignes, colonnes, valeur=0):
    """Renvoie une grille lignes × colonnes remplie de `valeur`, dont les lignes sont distinctes."""
    # [ligne] * n répète la même ligne ; la compréhension en crée une neuve à chaque tour.
    return [[valeur] * colonnes for _ in range(lignes)]


def normaliser(valeurs):
    """Renvoie une nouvelle liste : chaque valeur divisée par le maximum. L'entrée n'est pas modifiée."""
    # On construit une nouvelle liste au lieu d'écrire dans celle de l'appelant.
    maxi = max(valeurs)
    return [v / maxi for v in valeurs]


def est_absente(valeur):
    """True si la valeur est manquante (None). Une mesure à 0 n'est pas manquante."""
    # `not valeur` est vrai pour 0 et 0.0 : on teste l'identité avec None.
    return valeur is None
