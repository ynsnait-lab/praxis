# Indices cpp-03

## Les deux bugs
Le premier est dans `moyenne` : quel est le type de la valeur initiale donnée à `std::accumulate` ? Le second est dans `ecarts` : que vaut `v.size() - 1` quand `v` est vide (et que `size()` est non signé) ?

## Correspondances boucle → algorithme
« Existe-t-il » : `std::any_of`. Additionner : `std::accumulate` (avec `0.0`). Différences successives : `std::adjacent_difference`, puis retirer le premier élément. Supprimer selon un critère : `std::erase_if` (C++20). Les k plus grands : `std::partial_sort` avec `std::greater<>()`, puis `resize(k)`.

## compter sans boucle
`std::for_each(codes.begin(), codes.end(), [&](const std::string& c) { ++resultat[c]; });`, ou `std::ranges::for_each`. Ici, `operator[]` qui crée l'entrée à 0 est exactement ce qu'on veut.

## Le tri à deux critères
`std::ranges::sort(m, [](const Mesure& a, const Mesure& b) { return std::tie(a.canal, b.valeur) < std::tie(b.canal, a.valeur); });` : l'inversion `b.valeur` / `a.valeur` donne l'ordre décroissant pour le second critère. Toujours `<`, jamais `<=`.
