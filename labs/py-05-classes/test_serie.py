"""Tests du lab py-05. Ne les modifie pas : complète serie.py."""
import dataclasses

import pytest

from serie import Instrument, Mesure, Serie, ThermometreSimule


def test_mesure_dataclass_figee():
    m = Mesure("T1", 77.2)
    assert dataclasses.is_dataclass(m)
    assert m.unite == "K"
    assert m == Mesure("T1", 77.2, "K")
    with pytest.raises(dataclasses.FrozenInstanceError):
        m.valeur = 0.0


def test_mesure_hashable():
    gains = {Mesure("T1", 4.2): 1.02}
    assert gains[Mesure("T1", 4.2)] == 1.02


def test_mesure_validee():
    with pytest.raises(ValueError):
        Mesure("T1", -5.0)
    assert Mesure("T1", -5.0, "C").valeur == -5.0      # en °C, une valeur négative est normale


def test_serie_ajout_et_protocoles():
    s = Serie("T1")
    assert s.ajouter(77.2) is s
    s.ajouter(76.8).ajouter(77.0)
    assert len(s) == 3
    assert [m.valeur for m in s] == [77.2, 76.8, 77.0]
    assert s[0] == Mesure("T1", 77.2)
    assert 76.8 in s and 50.0 not in s


def test_series_independantes():
    a, b = Serie("T1"), Serie("T2")
    a.ajouter(10.0)
    assert len(b) == 0, "chaque série doit avoir sa propre liste"


def test_moyenne_propriete():
    s = Serie("T1")
    assert s.moyenne == 0.0
    s.ajouter(1.0).ajouter(2.0).ajouter(6.0)
    assert s.moyenne == pytest.approx(3.0)
    assert isinstance(type(s).__dict__["moyenne"], property)


def test_repr():
    s = Serie.depuis_texte("T1", "20.5;21.0;21.5")
    assert repr(s) == "Serie('T1', 3 mesures)"
    assert [m.valeur for m in s] == [20.5, 21.0, 21.5]


def test_instrument_abstrait():
    with pytest.raises(TypeError):
        Instrument()


def test_thermometre_simule():
    t = ThermometreSimule([20.0, 20.5])
    assert isinstance(t, Instrument)
    assert t.lire() == 20.0
    assert t.lire() == 20.5
    with pytest.raises(RuntimeError, match="plus de valeurs"):
        t.lire()
