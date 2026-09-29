# py-03 · Un pipeline de générateurs

> Cours liés : *Fonctions, portée, closures* (py05) et *Itérateurs, générateurs, comprehensions* (py06).

Un enregistreur produit des lignes `instant_s;temperature_C`, avec des commentaires (`#`), des lignes vides et parfois des lignes corrompues. Le flux peut être **infini** (lecture en direct d'un port série) : aucune fonction de ce lab n'a le droit de tout charger en mémoire, ni d'utiliser `len()` sur ce qu'elle reçoit.

## À écrire dans `flux.py`

Chaque fonction prend un **itérable** et renvoie un **générateur** (utilise `yield`).

1. `lire_mesures(lignes)` : produit des tuples `(instant: float, temperature: float)` ; ignore commentaires, lignes vides et lignes illisibles.
2. `filtrer_plage(mesures, mini, maxi)` : ne garde que les mesures dont la température est dans `[mini, maxi]`.
3. `moyenne_glissante(valeurs, n)` : pour chaque nouvelle valeur à partir de la n-ième, la moyenne des `n` dernières. `n <= 0` lève `ValueError`.
4. `fronts_montants(valeurs, seuil)` : les **indices** où la valeur franchit le seuil vers le haut (précédente `< seuil`, courante `>= seuil`).
5. `compteur()` : une fonction qui renvoie une fonction ; chaque appel de cette dernière renvoie 1, 2, 3… Deux compteurs sont indépendants (closure et `nonlocal`).

Les tests vérifient aussi que tes fonctions sont **paresseuses** : elles doivent fonctionner sur un générateur infini, dont on ne prend que les premiers éléments avec `itertools.islice`.

## Pour aller plus loin

Enchaîne les étapes sur un vrai fichier : `with open("releve.csv") as f:` puis `fronts_montants((t for _, t in filtrer_plage(lire_mesures(f), -50, 150)), 25.0)`. Le fichier n'est jamais chargé en entier.
