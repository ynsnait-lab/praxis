// bits.hpp : contrats du lab cpp-01. Ne modifie pas ce fichier : complète bits.cpp.
#pragma once
#include <cstdint>

// Assemble deux octets en un mot 16 bits, `fort` en poids fort.
std::uint16_t combiner(std::uint8_t fort, std::uint8_t faible);

// Valeur du champ de `largeur` bits (1..32) commençant au bit `pos` (pos + largeur <= 32).
std::uint32_t extraire(std::uint32_t reg, unsigned pos, unsigned largeur);

// `reg` dont le champ (pos, largeur) est remplacé par `valeur` tronquée à la largeur.
std::uint32_t inserer(std::uint32_t reg, unsigned pos, unsigned largeur, std::uint32_t valeur);

// `v` ramené dans [0, 255].
std::uint8_t saturer_u8(std::int32_t v);

// Produit de deux Q8.8 en Q8.8 : arrondi au plus proche, saturé à [INT16_MIN, INT16_MAX].
std::int16_t mul_q8_8(std::int16_t a, std::int16_t b);

// Lecture au 1/16 °C → millidegrés (division entière, troncature vers zéro).
std::int32_t q12_4_vers_milli(std::int16_t brut);
