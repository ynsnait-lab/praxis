# Indices cpp-01

## combiner et -Wconversion
`fort << 8` est un `int` (promotion) : le résultat doit être reconverti **explicitement** en `std::uint16_t` avec `static_cast`, sinon `-Wconversion` proteste.

## Un masque de largeur quelconque
Le masque de `largeur` bits vaut `(1u << largeur) - 1u`… sauf pour `largeur == 32`, où le décalage est un comportement indéfini. Traite ce cas à part : `largeur >= 32 ? 0xFFFF'FFFFu : (1u << largeur) - 1u`.

## inserer
Efface d'abord le champ (`reg & ~(masque << pos)`), puis ajoute la valeur tronquée et décalée (`(valeur & masque) << pos`).

## La multiplication Q8.8
Élargis à 32 bits **avant** de multiplier : `std::int32_t p = static_cast<std::int32_t>(a) * b;`. Arrondi : `p + (1 << 7)` avant de décaler de 8. Puis sature entre `INT16_MIN` et `INT16_MAX` avant de reconvertir. Attention : le décalage à droite d'un nombre négatif arrondit vers moins l'infini, ce qui est accepté par les tests.

## Millidegrés
Multiplie d'abord (sur 32 bits), divise ensuite : `static_cast<std::int32_t>(brut) * 1000 / 16`. La division entière C++ tronque vers zéro.
