# Indices py-06

## Lire un message de ruff
`conversion.py:6:8: F401 [*] 'os' imported but unused` : fichier, ligne, colonne, code de la règle, explication. `[*]` signifie que `ruff check --fix` sait le corriger seul. `ruff rule F401` explique la règle en détail.

## Les trois remarques de ruff
Un import inutile (supprime-le), un `except:` nu (précise l'exception : `json.JSONDecodeError`, une sorte de `ValueError`), et une f-string sans `{}` (enlève le `f`). Au passage, remplace `s == None` par `s is None` : les règles par défaut de ruff ne le signalent pas, mais c'est la bonne écriture.

## Les annotations
Exemple : `def vers_kelvin(valeur: float, unite: Unite) -> float:`. Pour les seuils : `dict[str, float]`. `rapport` reçoit aussi un `dict[str, float]` de mesures et renvoie `str`.

## Le None que mypy refuse
`seuils.get(nom)` renvoie `float | None`. Annote `seuil` et `marge` en conséquence : mypy vérifie alors qu'on teste bien `is None` avant de calculer, ce que fait déjà `marge`.
