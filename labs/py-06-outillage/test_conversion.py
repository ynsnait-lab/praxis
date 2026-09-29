"""Tests du lab py-06 : ils passent déjà. Garde-les verts en corrigeant conversion.py."""
import pytest

from conversion import Unite, charger_seuils, marge, rapport, seuil, vers_kelvin


def test_vers_kelvin():
    assert vers_kelvin(0.0, Unite.CELSIUS) == pytest.approx(273.15)
    assert vers_kelvin(212.0, Unite.FAHRENHEIT) == pytest.approx(373.15)
    assert vers_kelvin(4.2, Unite.KELVIN) == 4.2


def test_charger_seuils():
    assert charger_seuils('{"T1": 300, "T2": 77.5}') == {"T1": 300.0, "T2": 77.5}
    assert charger_seuils("pas du json") == {}


def test_seuil_et_marge():
    s = {"T1": 300.0}
    assert seuil(s, "T1") == 300.0
    assert seuil(s, "T9") is None
    assert marge(s, "T1", 290.0) == pytest.approx(10.0)
    assert marge(s, "T9", 290.0) is None


def test_rapport():
    texte = rapport({"T1": 300.0}, {"T1": 295.0, "T2": 80.0})
    assert texte == "Rapport de seuils\nT1 : marge 5.0 K\nT2 : pas de seuil"
