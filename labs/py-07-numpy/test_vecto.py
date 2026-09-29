"""Tests du lab py-07. Ne les modifie pas : réécris vecto.py sans boucle."""
import ast
from pathlib import Path

import numpy as np
import pytest

import vecto

FONCTIONS = ["volts", "rejeter_aberrants", "moyenne_glissante", "centrer_colonnes", "eclaircir", "compter_fronts"]
BOUCLES = (ast.For, ast.While, ast.ListComp, ast.SetComp, ast.DictComp, ast.GeneratorExp, ast.AsyncFor)


@pytest.mark.parametrize("nom", FONCTIONS)
def test_sans_boucle(nom):
    arbre = ast.parse(Path(vecto.__file__).read_text(encoding="utf-8"))
    defs = {n.name: n for n in ast.walk(arbre) if isinstance(n, ast.FunctionDef)}
    assert nom in defs, f"fonction {nom} introuvable"
    boucles = [type(n).__name__ for n in ast.walk(defs[nom]) if isinstance(n, BOUCLES)]
    assert not boucles, f"{nom} contient encore une boucle Python : {boucles}"


def test_volts():
    r = vecto.volts(np.array([0, 4095, 2048]))
    assert r == pytest.approx([0.0, 3.3, 2048 * 3.3 / 4095])
    assert vecto.volts([1023], vref=5.0, bits=10) == pytest.approx([5.0])


def test_rejeter_aberrants():
    rng = np.random.default_rng(0)
    x = np.concatenate([rng.normal(20.0, 0.5, 1000), [1000.0, -1000.0]])
    r = vecto.rejeter_aberrants(x)
    assert len(r) == 1000
    assert r.max() < 30 and r.min() > 10


def test_moyenne_glissante():
    assert vecto.moyenne_glissante(np.array([1.0, 2.0, 3.0, 4.0, 5.0]), 3) == pytest.approx([2.0, 3.0, 4.0])
    x = np.random.default_rng(1).normal(size=500)
    attendu = np.array([x[i:i + 7].mean() for i in range(len(x) - 6)])
    assert vecto.moyenne_glissante(x, 7) == pytest.approx(attendu)


def test_centrer_colonnes():
    a = np.array([[1.0, 10.0], [3.0, 30.0]])
    assert vecto.centrer_colonnes(a) == pytest.approx(np.array([[-1.0, -10.0], [1.0, 10.0]]))
    b = np.random.default_rng(2).normal(size=(100, 3))
    assert vecto.centrer_colonnes(b).mean(axis=0) == pytest.approx([0.0, 0.0, 0.0], abs=1e-12)


def test_eclaircir_sature():
    image = np.array([200, 250, 30, 0], dtype=np.uint8)
    r = vecto.eclaircir(image, 100)
    assert r.dtype == np.uint8
    assert r.tolist() == [255, 255, 130, 100], "uint8 a rebouclé au lieu de saturer à 255"


def test_eclaircir_assombrir():
    image = np.array([200, 50, 10], dtype=np.uint8)
    assert vecto.eclaircir(image, -60).tolist() == [140, 0, 0]


def test_compter_fronts():
    x = np.array([20, 24, 26, 25, 24, 26, 27, 20, 25])
    assert vecto.compter_fronts(x, 25) == 3
    assert vecto.compter_fronts(np.array([30, 30, 20]), 25) == 0
