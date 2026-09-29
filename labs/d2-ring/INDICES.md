# Indices d2

## Deux compteurs qui ne reviennent jamais en arrière
Garde `tete_` (nombre total d'éléments poussés) et `queue_` (nombre total retirés), qui ne font qu'augmenter. `size() = tete_ - queue_` (l'arithmétique non signée reboucle proprement), la case d'écriture est `tete_ & (N - 1)`. La file est pleine quand `size() == N`.

## Puissance de 2
`static_assert(N > 0 && (N & (N - 1)) == 0, "N doit être une puissance de 2");` en tête de classe.

## Les atomiques, côté producteur
```cpp
const std::size_t t = tete_.load(std::memory_order_relaxed);        // seul le producteur écrit tete_
if (t - queue_.load(std::memory_order_acquire) == N) return false;  // pleine
donnees_[t & (N - 1)] = v;
tete_.store(t + 1, std::memory_order_release);                      // publie l'élément
```
Le consommateur fait le symétrique avec `queue_`.

## Ni copie ni déplacement
`Ring(const Ring&) = delete;` et `Ring& operator=(const Ring&) = delete;`. Déclarer la copie supprimée empêche aussi la génération du déplacement.
