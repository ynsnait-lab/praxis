# py-05 · Une série de mesures qui parle Python

> Cours lié : *Classes & modèle de données* (py08).

## À écrire dans `serie.py`

1. `Mesure` : une **dataclass figée** (`frozen=True`) avec `capteur: str`, `valeur: float`, `unite: str = "K"`. Une température en kelvins négative ou nulle lève `ValueError` dès la création (`__post_init__`). Deux mesures identiques sont égales et peuvent servir de clés de dictionnaire.
2. `Serie` : une série de mesures d'**un seul** capteur.
   - `Serie(capteur)` démarre vide ; chaque série a **sa propre** liste.
   - `ajouter(valeur)` crée la `Mesure` et l'ajoute ; renvoie la série elle-même (pour enchaîner : `s.ajouter(1).ajouter(2)`).
   - `len(s)`, `for m in s`, `21.0 in s` (une **valeur** est-elle présente ?) et `s[0]` fonctionnent.
   - `s.moyenne` est une **propriété** (sans parenthèses) : la moyenne des valeurs, `0.0` si la série est vide.
   - `repr(s)` vaut par exemple `Serie('T1', 3 mesures)`.
   - `Serie.depuis_texte("T1", "20.5;21.0;21.5")` : constructeur alternatif (`@classmethod`).
3. `Instrument` : une classe de base **abstraite** (`abc.ABC`) avec une méthode abstraite `lire(self) -> float`.
4. `ThermometreSimule(Instrument)` : construit avec une liste de valeurs, `lire()` les renvoie une à une, puis lève `RuntimeError("plus de valeurs")`.

## Pour aller plus loin

Ajoute `Serie.__add__` pour concaténer deux séries **du même capteur** (et lever `ValueError` sinon), puis écris toi-même les tests correspondants dans un fichier `test_perso.py`.
