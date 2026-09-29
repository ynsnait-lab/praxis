# Indices d6

## La forme de suivant
```cpp
constexpr Etat suivant(Etat e, const Entrees& in) noexcept {
    switch (e) {
        case Etat::Repos: return in.demarrer ? Etat::Purge : Etat::Repos;
        case Etat::Purge:
            if (in.defaut) return Etat::Erreur;
            if (in.arret_urgence) return Etat::Repos;
            return in.temps_ms >= DUREE_PURGE_MS ? Etat::Stabilisation : Etat::Purge;
        // … les autres états
    }
    return Etat::Erreur;          // valeur hors de l'énumération
}
```
Le `return` après le `switch` n'est atteint que pour une valeur corrompue : c'est là que va le cas « inattendu ».

## Vérifier à la compilation
`static_assert(suivant(Etat::Repos, Entrees{.demarrer = true}) == Etat::Purge);` (initialisation désignée, C++20).

## Le journal sans allocation
Un `std::array<const char*, 16>` et un compteur : les messages sont des littéraux (`"sortie Purge"`), qui vivent pendant tout le programme. Pour composer « sortie » + nom sans allocation, garde deux tableaux de littéraux indexés par l'état.
