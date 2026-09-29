"""Outils de robustesse pour un script d'acquisition (lab py-04)."""
from contextlib import contextmanager


class MesureInvalide(ValueError):
    """Une mesure lisible mais hors des bornes physiques du capteur."""

    def __init__(self, capteur, valeur, mini, maxi):
        raise NotImplementedError("à écrire")


def convertir(capteur, brut, mini=-200.0, maxi=1500.0):
    """Convertit le texte brut en float, vérifie les bornes."""
    raise NotImplementedError("à écrire")


def trier_lot(lot):
    """Renvoie (valeurs valides, messages de rejet) sans jamais s'arrêter."""
    raise NotImplementedError("à écrire")


@contextmanager
def chrono(resultat):
    """Écrit la durée du bloc dans resultat["secondes"], même en cas d'exception."""
    raise NotImplementedError("à écrire")
    yield


def reessayer(n, exceptions=(TimeoutError,)):
    """Décorateur : jusqu'à n tentatives tant que la fonction lève une des exceptions."""
    raise NotImplementedError("à écrire")
