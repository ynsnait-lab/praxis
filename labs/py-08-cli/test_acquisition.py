"""Tests du lab py-08. Ne les modifie pas : complète acquisition.py."""
import json
import logging

import pytest

from acquisition import main

RELEVE_A = """horodatage;capteur;valeur
2026-09-29T10:00:00;T1;20.5
2026-09-29T10:00:01;T2;4.2
2026-09-29T10:00:02;T1;abc
2026-09-29T10:00:03;T1;21.5
"""
RELEVE_B = """horodatage;capteur;valeur
2026-09-29T11:00:00;T1;22.0
2026-09-29T11:00:01;T2
2026-09-29T11:00:02;T2;4.4
"""


@pytest.fixture
def fichiers(tmp_path):
    a, b = tmp_path / "a.csv", tmp_path / "b.csv"
    a.write_text(RELEVE_A, encoding="utf-8")
    b.write_text(RELEVE_B, encoding="utf-8")
    return str(a), str(b)


def test_resume_sur_la_sortie(fichiers, capsys):
    assert main(list(fichiers)) == 0
    resume = json.loads(capsys.readouterr().out)
    assert resume == {
        "T1": {"n": 3, "moyenne": 21.333, "min": 20.5, "max": 22.0},
        "T2": {"n": 2, "moyenne": 4.3, "min": 4.2, "max": 4.4},
    }


def test_json_indente_et_trie(fichiers, capsys):
    main([fichiers[0]])
    texte = capsys.readouterr().out
    assert texte.startswith('{\n  "T1": {\n    "max"'), "JSON indenté de 2 espaces, clés triées"


def test_filtre_capteur(fichiers, capsys):
    assert main([*fichiers, "--capteur", "T2"]) == 0
    assert list(json.loads(capsys.readouterr().out)) == ["T2"]


def test_lignes_abimees_journalisees(fichiers, caplog):
    caplog.set_level(logging.WARNING, logger="acquisition")
    main(list(fichiers))
    avertissements = [r.getMessage() for r in caplog.records if r.levelno == logging.WARNING]
    assert len(avertissements) == 2
    assert any("a.csv" in m and "ligne 4" in m for m in avertissements)
    assert any("b.csv" in m and "ligne 3" in m for m in avertissements)


def test_sortie_fichier(fichiers, tmp_path, capsys):
    cible = tmp_path / "resume.json"
    assert main([*fichiers, "--sortie", str(cible)]) == 0
    assert capsys.readouterr().out == ""
    assert json.loads(cible.read_text(encoding="utf-8"))["T1"]["n"] == 3


def test_fichier_introuvable(tmp_path, caplog):
    code = main([str(tmp_path / "absent.csv")])
    assert code == 2
    assert any(r.levelno == logging.ERROR for r in caplog.records)


def test_aucune_mesure(tmp_path, fichiers):
    assert main([*fichiers, "--capteur", "T9"]) == 1


def test_niveau_verbeux(fichiers, capsys):
    main([fichiers[0], "-v"])
    assert logging.getLogger("acquisition").level == logging.DEBUG
    main([fichiers[0]])
    assert logging.getLogger("acquisition").level == logging.INFO


def test_arguments_invalides(capsys):
    with pytest.raises(SystemExit) as info:
        main([])
    assert info.value.code == 2
