"""Mesures, séries et instruments (lab py-05)."""


class Mesure:
    """À transformer en dataclass figée et validée."""


class Serie:
    """Série de mesures d'un capteur."""

    def __init__(self, capteur):
        raise NotImplementedError("à écrire")


class Instrument:
    """À transformer en classe de base abstraite avec une méthode lire()."""


class ThermometreSimule(Instrument):
    """Renvoie des valeurs prédéfinies, une à une."""

    def __init__(self, valeurs):
        raise NotImplementedError("à écrire")
