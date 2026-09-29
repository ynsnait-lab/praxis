"""Petites fonctions de gestion de mesures. Elles « marchent »… presque.

Cinq pièges se cachent ici : lance ./praxis check py-01 et corrige-les.
"""


def ajouter(mesure, historique=[]):
    """Ajoute `mesure` à `historique` (ou à une liste neuve) et renvoie la liste."""
    historique.append(mesure)
    return historique


def copie_config(config):
    """Renvoie une copie indépendante d'une configuration imbriquée (dicts et listes)."""
    return config.copy()


def grille(lignes, colonnes, valeur=0):
    """Renvoie une grille lignes × colonnes remplie de `valeur`, dont les lignes sont distinctes."""
    return [[valeur] * colonnes] * lignes


def normaliser(valeurs):
    """Renvoie une nouvelle liste : chaque valeur divisée par le maximum. L'entrée n'est pas modifiée."""
    maxi = max(valeurs)
    for i in range(len(valeurs)):
        valeurs[i] = valeurs[i] / maxi
    return valeurs


def est_absente(valeur):
    """True si la valeur est manquante (None). Une mesure à 0 n'est pas manquante."""
    return not valeur
