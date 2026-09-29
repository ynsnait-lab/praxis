# cpp-03 · Zéro boucle écrite à la main

> Cours liés : *Conteneurs de la STL* (cpp06) et *Algorithmes & lambdas* (cpp07).

`analyse.cpp` implémente sept traitements avec des boucles écrites à la main. Deux d'entre eux ont un bug, et la vérification refuse **toute** boucle `for` ou `while` dans ce fichier. Réécris chaque fonction avec l'algorithme standard qui dit son intention.

| Fonction | Contrat |
|---|---|
| `moyenne(v)` | moyenne arithmétique, `0.0` si vide |
| `alarme(v, seuil)` | au moins une valeur strictement supérieure au seuil ? |
| `ecarts(v)` | différences successives `v[i+1] − v[i]` ; moins de 2 valeurs : vecteur vide |
| `retirer_hors_bornes(v, lo, hi)` | supprime sur place les valeurs hors de `[lo, hi]`, ordre préservé |
| `compter(codes)` | nombre d'occurrences de chaque code, dans une `std::map` |
| `k_plus_grandes(v, k)` | les `k` plus grandes valeurs, décroissantes (toutes si `k > v.size()`) |
| `trier(mesures)` | par canal croissant, puis valeur décroissante |

Les paramètres « données contiguës en lecture » sont des `std::span<const double>` : ils acceptent un `std::vector`, un `std::array` ou un tableau C.

## Vérifier

```shell
./praxis check cpp-03
```

## Pour aller plus loin

Réécris `alarme` et `moyenne` avec les algorithmes de `std::ranges`, puis `ecarts` avec `std::views::adjacent_transform` (C++23) si ton compilateur le connaît.
