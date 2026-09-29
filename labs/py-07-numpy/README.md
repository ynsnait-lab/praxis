# py-07 · Vectoriser avec NumPy

> Cours lié : *Performance & NumPy* (py12). Demande NumPy : `./praxis setup` l'installe.

`vecto.py` contient six traitements écrits « à l'ancienne », avec des boucles Python. Ils sont justes (sauf un, qui cache un débordement), mais lents : sur un million de points, chacun prend une fraction de seconde au lieu de quelques millisecondes.

## La règle du lab

Les tests vérifient les résultats **et** analysent ton code : les six fonctions ne doivent contenir **aucune** boucle (`for`, `while`, compréhension, expression génératrice). Tout passe par des opérations sur les tableaux.

| Fonction | Ce qu'elle calcule |
|---|---|
| `volts(brut, vref=3.3, bits=12)` | conversion d'un code de CAN en volts : `brut × vref / (2^bits − 1)` |
| `rejeter_aberrants(x, k=3.0)` | les valeurs à moins de `k` écarts-types de la moyenne |
| `moyenne_glissante(x, n)` | moyennes sur des fenêtres de `n` points (`len(x) − n + 1` valeurs) |
| `centrer_colonnes(a)` | chaque colonne d'un tableau 2D moins sa moyenne |
| `eclaircir(image, delta)` | image `uint8` + `delta`, **bornée** à 255 (et à 0 si `delta` est négatif), résultat en `uint8` |
| `compter_fronts(x, seuil)` | nombre de passages de `< seuil` à `>= seuil` |

## Pour aller plus loin

Mesure l'écart avec `timeit` : version boucle contre version vectorisée, sur `np.random.default_rng(0).normal(20, 1, 1_000_000)`. Note le rapport dans un commentaire en tête de fichier.
