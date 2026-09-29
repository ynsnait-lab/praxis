"""Tests du défi d3. Ne les modifie pas : complète pipeline.py."""
import inspect
import json
import math
import statistics
import tracemalloc

import pytest

from pipeline import Statistiques, analyser, lire_dossier, main, parser_ligne

ENTETE = "horodatage;capteur;valeur;unite\n"


def creer_dossier(dossier, n_fichiers, n_lignes=50):
    dossier.mkdir(exist_ok=True)
    for f in range(n_fichiers):
        lignes = [ENTETE]
        for i in range(n_lignes):
            capteur = "T1" if i % 2 else "P1"
            lignes.append(f"2026-09-29T10:{i % 60:02d}:00;{capteur};{20 + (i % 7) * 0.5};C\n")
        lignes.append("ligne;corrompue\n")
        (dossier / f"releve_{f:03d}.csv").write_text("".join(lignes), encoding="utf-8")
    return dossier


def test_lire_dossier_est_un_generateur(tmp_path):
    assert inspect.isgeneratorfunction(lire_dossier)
    d = creer_dossier(tmp_path / "d", 3, 4)
    lignes = list(lire_dossier(d))
    assert len(lignes) == 3 * (1 + 4 + 1)
    assert lignes[0] == ENTETE


def test_parser_ligne():
    assert parser_ligne("2026-09-29T10:00:00;T1;20.5;C\n") == ("T1", 20.5)
    assert parser_ligne(ENTETE) is None
    assert parser_ligne("2026-09-29T10:00:00;T1;abc;C") is None
    assert parser_ligne("2026-09-29T10:00:00;;20.5;C") is None
    assert parser_ligne("ligne;corrompue") is None
    assert parser_ligne("") is None


def test_statistiques_en_flux():
    valeurs = [20.0, 21.5, 19.0, 22.5, 20.0]
    s = Statistiques()
    for v in valeurs:
        s.ajouter(v)
    assert s.n == 5
    assert s.moyenne == pytest.approx(statistics.fmean(valeurs))
    assert s.ecart_type == pytest.approx(statistics.pstdev(valeurs))
    assert (s.mini, s.maxi) == (19.0, 22.5)
    assert not hasattr(s, "valeurs"), "l'accumulateur ne doit pas garder les valeurs"


def test_analyser(tmp_path):
    d = creer_dossier(tmp_path / "d", 4, 10)
    stats, lignes, rejets = analyser(lire_dossier(d))
    assert set(stats) == {"T1", "P1"}
    assert stats["T1"].n == 4 * 5 and stats["P1"].n == 4 * 5
    assert lignes == 4 * 11                    # données + ligne corrompue, en-têtes exclus
    assert rejets == 4


def test_analyser_filtre(tmp_path):
    d = creer_dossier(tmp_path / "d", 2, 10)
    stats, _, _ = analyser(lire_dossier(d), capteur="P1")
    assert list(stats) == ["P1"]


def test_memoire_independante_du_nombre_de_fichiers(tmp_path):
    petit = creer_dossier(tmp_path / "petit", 10, 200)
    grand = creer_dossier(tmp_path / "grand", 100, 200)

    def pic(dossier):
        tracemalloc.start()
        analyser(lire_dossier(dossier))
        _, pic_octets = tracemalloc.get_traced_memory()
        tracemalloc.stop()
        return pic_octets

    p_petit, p_grand = pic(petit), pic(grand)
    assert p_grand < 2 * p_petit + 200_000, f"pic mémoire {p_grand} o pour 100 fichiers contre {p_petit} o pour 10"


def test_main_rapport(tmp_path, capsys):
    d = creer_dossier(tmp_path / "d", 3, 10)
    assert main(["--dossier", str(d)]) == 0
    r = json.loads(capsys.readouterr().out)
    assert r["lignes"] == 33 and r["rejets"] == 3
    assert r["taux_rejet"] == pytest.approx(round(100 * 3 / 33, 4))
    t1 = r["capteurs"]["T1"]
    assert t1["n"] == 15
    assert set(t1) == {"n", "moyenne", "ecart_type", "min", "max"}
    assert math.isfinite(t1["ecart_type"])


def test_main_sortie_et_codes(tmp_path, capsys):
    d = creer_dossier(tmp_path / "d", 2, 10)
    cible = tmp_path / "rapport.json"
    assert main(["--dossier", str(d), "--sortie", str(cible)]) == 0
    assert capsys.readouterr().out == ""
    assert "capteurs" in json.loads(cible.read_text(encoding="utf-8"))
    assert main(["--dossier", str(tmp_path / "absent")]) == 2
    assert main(["--dossier", str(d), "--capteur", "X9"]) == 1


def test_pas_de_print():
    import pipeline
    source = inspect.getsource(pipeline)
    corps_main = source[source.index("def main"):]
    assert corps_main.count("print(") <= 1, "un seul print : celui du rapport JSON ; les messages passent par logging"
