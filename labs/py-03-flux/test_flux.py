"""Tests du lab py-03. Ne les modifie pas : complète flux.py."""
import inspect
import io
import itertools

import pytest

from flux import compteur, filtrer_plage, fronts_montants, lire_mesures, moyenne_glissante

RELEVE = """# instant_s;temperature_C
0;20.1

1;20.4
2;ERREUR
3;21.0;extra
4;22.6
5;22.9
"""


def test_ce_sont_des_generateurs():
    for f in (lire_mesures, filtrer_plage, moyenne_glissante, fronts_montants):
        assert inspect.isgeneratorfunction(f), f"{f.__name__} doit utiliser yield"


def test_lire_mesures():
    assert list(lire_mesures(io.StringIO(RELEVE))) == [(0.0, 20.1), (1.0, 20.4), (4.0, 22.6), (5.0, 22.9)]


def test_lire_mesures_paresseux():
    def lignes_infinies():
        for i in itertools.count():
            yield f"{i};{20 + i % 3}\n"
    assert list(itertools.islice(lire_mesures(lignes_infinies()), 3)) == [(0.0, 20.0), (1.0, 21.0), (2.0, 22.0)]


def test_filtrer_plage():
    m = [(0.0, -300.0), (1.0, 20.0), (2.0, 150.0), (3.0, 151.0)]
    assert list(filtrer_plage(m, -50, 150)) == [(1.0, 20.0), (2.0, 150.0)]


def test_moyenne_glissante():
    assert list(moyenne_glissante([1, 2, 3, 4, 5], 3)) == [2.0, 3.0, 4.0]
    assert list(moyenne_glissante([1, 2], 3)) == []
    assert list(moyenne_glissante(iter([10.0, 20.0]), 1)) == [10.0, 20.0]


def test_moyenne_glissante_sur_flux_infini():
    uns = itertools.repeat(1.0)
    assert list(itertools.islice(moyenne_glissante(uns, 4), 5)) == [1.0] * 5


def test_moyenne_glissante_n_invalide():
    with pytest.raises(ValueError):
        list(moyenne_glissante([1, 2, 3], 0))


def test_fronts_montants():
    signal = [20, 24, 26, 25, 24, 26, 27, 20, 25]
    assert list(fronts_montants(signal, 25)) == [2, 5, 8]
    assert list(fronts_montants([30, 30, 20], 25)) == []    # déjà au-dessus au départ : pas un front


def test_fronts_montants_generateur():
    valeurs = (v for v in [0, 10, 0, 10])
    assert list(fronts_montants(valeurs, 5)) == [1, 3]


def test_compteur():
    a = compteur()
    b = compteur()
    assert [a(), a(), a()] == [1, 2, 3]
    assert b() == 1, "deux compteurs doivent être indépendants"
