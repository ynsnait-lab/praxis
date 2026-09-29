# Indices cpp-04

## Convertir un texte en double
`std::strtod(texte.c_str(), &fin)` s'arrête au premier caractère non numérique et place `fin` dessus. Le texte est un nombre **complet** seulement si `fin` pointe sur la fin de la chaîne, et s'il n'est pas vide. Comme `strtod` veut une chaîne terminée par `'\0'`, copie d'abord la `std::string_view` dans une `std::string`.

## indice_de
`std::find` renvoie un itérateur ; s'il vaut `v.end()`, renvoie `std::nullopt`, sinon `static_cast<std::size_t>(it - v.begin())`.

## decoder
Vérifie dans l'ordre : longueur (exactement 5), entête, somme. Pour la valeur : `static_cast<std::int16_t>(octets[2] | (octets[3] << 8))`. Chaque sortie anticipée renvoie `{Erreur::…, {}}`.

## message et -Wswitch
Un `switch (e)` avec un `case` par énumérateur et **pas** de `default` : si quelqu'un ajoute un code d'erreur plus tard, `-Wswitch` signalera ce `switch` incomplet. Après le `switch`, un `return "?";` pour les valeurs hors énumération.

## Exceptions standard
`throw std::invalid_argument("nom de voie vide");` et `throw std::out_of_range("voie inconnue : " + nom);` (en-tête `<stdexcept>`).
