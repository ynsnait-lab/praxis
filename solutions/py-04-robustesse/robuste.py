"""Outils de robustesse pour un script d'acquisition (lab py-04) : solution."""
import functools
import time
from contextlib import contextmanager


class MesureInvalide(ValueError):
    """Une mesure lisible mais hors des bornes physiques du capteur."""

    def __init__(self, capteur, valeur, mini, maxi):
        self.capteur, self.valeur, self.mini, self.maxi = capteur, valeur, mini, maxi
        super().__init__(f"capteur {capteur} : {valeur} hors bornes [{float(mini)}, {float(maxi)}]")


def convertir(capteur, brut, mini=-200.0, maxi=1500.0):
    """Convertit le texte brut en float, vérifie les bornes."""
    valeur = float(brut)                       # ValueError si illisible
    if not mini <= valeur <= maxi:
        raise MesureInvalide(capteur, valeur, mini, maxi)
    return valeur


def trier_lot(lot):
    """Renvoie (valeurs valides, messages de rejet) sans jamais s'arrêter."""
    bonnes, rejets = [], []
    for capteur, brut in lot:
        try:
            bonnes.append(convertir(capteur, brut))
        except MesureInvalide as e:            # la plus précise d'abord
            rejets.append(str(e))
        except ValueError:
            rejets.append(f"capteur {capteur} : illisible ({brut!r})")
    return bonnes, rejets


@contextmanager
def chrono(resultat):
    """Écrit la durée du bloc dans resultat["secondes"], même en cas d'exception."""
    debut = time.perf_counter()
    try:
        yield
    finally:
        resultat["secondes"] = time.perf_counter() - debut


def reessayer(n, exceptions=(TimeoutError,)):
    """Décorateur : jusqu'à n tentatives tant que la fonction lève une des exceptions."""
    def decorateur(fonction):
        @functools.wraps(fonction)
        def enveloppe(*args, **kwargs):
            for tentative in range(1, n + 1):
                try:
                    return fonction(*args, **kwargs)
                except exceptions:
                    if tentative == n:
                        raise
        return enveloppe
    return decorateur
