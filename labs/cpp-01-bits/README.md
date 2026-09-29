# cpp-01 · Registres, bits et virgule fixe

> Cours liés : *Modèle de compilation & types* (cpp01) et *Bits & arithmétique fixe* (cpp12).

Complète `bits.cpp` (les déclarations et les contrats sont dans `bits.hpp`, ne les change pas).

| Fonction | Contrat |
|---|---|
| `combiner(fort, faible)` | assemble deux octets en un mot 16 bits (*big-endian* : `fort` en poids fort) |
| `extraire(reg, pos, largeur)` | la valeur du champ de `largeur` bits commençant au bit `pos` (1 ≤ largeur ≤ 32, pos + largeur ≤ 32) |
| `inserer(reg, pos, largeur, valeur)` | `reg` avec ce champ remplacé par `valeur` (tronquée à la largeur), le reste intact |
| `saturer_u8(v)` | `v` ramené dans [0, 255] |
| `mul_q8_8(a, b)` | produit de deux Q8.8, en Q8.8, arrondi au plus proche, **saturé** au lieu de reboucler |
| `q12_4_vers_milli(brut)` | une lecture capteur au 1/16 °C, convertie en millidegrés (troncature vers zéro), sans flottant |

## Vérifier

```shell
./praxis check cpp-01
```

La vérification compile avec `-Wall -Wextra -Wpedantic -Wconversion -Wshadow` **et** avec AddressSanitizer + UBSan. Le lab n'est réussi que si les tests passent **et** qu'il ne reste aucun avertissement. Attention au piège classique : `extraire(x, 0, 32)` ne doit pas décaler de 32 bits.

## Pour aller plus loin

Rends toutes ces fonctions `constexpr` et ajoute dans `bits.cpp` des `static_assert` qui vérifient trois valeurs connues à la compilation.
