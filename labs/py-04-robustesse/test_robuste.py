"""Tests du lab py-04. Ne les modifie pas : complète robuste.py."""
import time

import pytest

from robuste import MesureInvalide, chrono, convertir, reessayer, trier_lot


def test_mesure_invalide_attributs_et_message():
    e = MesureInvalide("T3", -999.0, -200, 1500)
    assert isinstance(e, ValueError)
    assert (e.capteur, e.valeur, e.mini, e.maxi) == ("T3", -999.0, -200, 1500)
    assert str(e) == "capteur T3 : -999.0 hors bornes [-200.0, 1500.0]"


def test_convertir():
    assert convertir("T1", "21.5") == 21.5
    assert convertir("T1", " 4.2\n") == 4.2
    with pytest.raises(MesureInvalide):
        convertir("T3", "-999")
    with pytest.raises(ValueError):
        convertir("T2", "abc")


def test_convertir_illisible_n_est_pas_mesure_invalide():
    with pytest.raises(ValueError) as info:
        convertir("T2", "abc")
    assert not isinstance(info.value, MesureInvalide)


def test_trier_lot():
    lot = [("T1", "21.5"), ("T2", "abc"), ("T3", "-999"), ("T4", "22.0")]
    bonnes, rejets = trier_lot(lot)
    assert bonnes == [21.5, 22.0]
    assert rejets == ["capteur T2 : illisible ('abc')", "capteur T3 : -999.0 hors bornes [-200.0, 1500.0]"]


def test_chrono_mesure():
    r = {}
    with chrono(r):
        time.sleep(0.01)
    assert 0.005 < r["secondes"] < 1.0


def test_chrono_meme_si_exception():
    r = {}
    with pytest.raises(ZeroDivisionError):
        with chrono(r):
            1 / 0
    assert "secondes" in r, "la durée doit être écrite même si le bloc lève"


def test_reessayer_finit_par_reussir():
    appels = []

    @reessayer(3)
    def lire():
        """Lit l'instrument."""
        appels.append(1)
        if len(appels) < 3:
            raise TimeoutError("pas de réponse")
        return 42

    assert lire() == 42
    assert len(appels) == 3
    assert lire.__name__ == "lire" and lire.__doc__ == "Lit l'instrument."


def test_reessayer_abandonne():
    appels = []

    @reessayer(2)
    def lire():
        appels.append(1)
        raise TimeoutError("toujours rien")

    with pytest.raises(TimeoutError):
        lire()
    assert len(appels) == 2


def test_reessayer_ne_rattrape_pas_les_bugs():
    appels = []

    @reessayer(5, exceptions=(TimeoutError, OSError))
    def lire():
        appels.append(1)
        raise TypeError("bug dans le code")

    with pytest.raises(TypeError):
        lire()
    assert len(appels) == 1, "un bug ne doit pas être réessayé"


def test_reessayer_passe_les_arguments():
    @reessayer(2)
    def gain(x, *, facteur=2):
        return x * facteur

    assert gain(3) == 6
    assert gain(3, facteur=10) == 30
