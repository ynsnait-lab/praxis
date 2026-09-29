"""Tests du lab py-01. Ne les modifie pas : corrige mesures.py."""
from mesures import ajouter, copie_config, est_absente, grille, normaliser


def test_ajouter_fonctionne():
    assert ajouter(20.5) == [20.5]
    h = [1.0]
    assert ajouter(2.0, h) == [1.0, 2.0]
    assert h == [1.0, 2.0]                     # la liste fournie est bien complétée


def test_ajouter_independant():
    a = ajouter(1)
    b = ajouter(2)
    assert a == [1]
    assert b == [2], "deux appels sans historique doivent donner deux listes indépendantes"
    assert a is not b


def test_copie_config_premier_niveau():
    config = {"nom": "cryostat", "seuils": [4.2, 300.0]}
    c = copie_config(config)
    c["nom"] = "four"
    assert config["nom"] == "cryostat"


def test_copie_config_profonde():
    config = {"nom": "cryostat", "seuils": [4.2, 300.0], "pid": {"kp": 1.2, "gains": [1, 2]}}
    c = copie_config(config)
    c["seuils"].append(350.0)
    c["pid"]["gains"][0] = 99
    assert config["seuils"] == [4.2, 300.0], "la liste intérieure est encore partagée"
    assert config["pid"]["gains"] == [1, 2], "le dict intérieur est encore partagé"


def test_grille_forme():
    g = grille(2, 3)
    assert g == [[0, 0, 0], [0, 0, 0]]


def test_grille_lignes_distinctes():
    g = grille(3, 3)
    g[0][0] = 1
    assert g == [[1, 0, 0], [0, 0, 0], [0, 0, 0]], "les lignes de la grille sont le même objet"


def test_normaliser_resultat():
    assert normaliser([1.0, 2.0, 4.0]) == [0.25, 0.5, 1.0]


def test_normaliser_ne_modifie_pas_l_entree():
    v = [1.0, 2.0, 4.0]
    r = normaliser(v)
    assert v == [1.0, 2.0, 4.0], "normaliser a modifié la liste de l'appelant"
    assert r is not v


def test_est_absente():
    assert est_absente(None) is True
    assert est_absente(21.5) is False


def test_zero_n_est_pas_absent():
    assert est_absente(0) is False, "une mesure à 0 n'est pas une mesure manquante"
    assert est_absente(0.0) is False
