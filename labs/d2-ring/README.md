# Défi d2 · Buffer circulaire générique

**Contexte.** Tu as besoin d'une file simple entre une routine d'interruption (le **producteur**, qui reçoit des octets) et la boucle principale (le **consommateur**, qui les traite), sans aucune allocation dynamique.

**Objectif.** Écrire dans `ring.hpp` une classe `template <typename T, std::size_t N> class Ring`, correcte, testée, sans `new`.

## Le contrat

- `bool push(const T& v)` : ajoute, ou renvoie `false` si la file est pleine ;
- `bool pop(T& v)` : retire le plus ancien dans `v`, ou renvoie `false` si la file est vide ;
- `std::size_t size() const`, `bool empty() const`, `bool full() const` ;
- capacité : exactement `N` éléments ;
- `N` doit être une puissance de 2 (`static_assert`), et l'indice se calcule avec `& (N - 1)`, pas `% N` ;
- la classe n'est **ni copiable ni déplaçable** (réfléchis : que voudrait dire « déplacer » une file partagée avec une interruption ?) ;
- version **un producteur / un consommateur** : les deux indices sont des `std::atomic<std::size_t>`, et un thread peut pousser pendant qu'un autre retire.

## Critères de réussite

- aucune allocation dynamique (un test compte les appels à `operator new`) ;
- `static_assert` sur `N` puissance de 2 ;
- compile sans avertissement avec `-Wall -Wextra -Wpedantic -Wconversion -Wshadow` ;
- passe sous `-fsanitize=address,undefined`.

```shell
./praxis check d2
```

## Pour aller plus loin

Compile les tests avec `-fsanitize=thread` au lieu d'`address` (dans un dossier de build à part) : ThreadSanitizer vérifie que les deux threads ne se marchent jamais dessus.
