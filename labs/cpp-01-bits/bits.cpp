// bits.cpp : à compléter (lab cpp-01). Les contrats sont dans bits.hpp.
#include "bits.hpp"

std::uint16_t combiner(std::uint8_t fort, std::uint8_t faible) {
    (void)fort;
    (void)faible;
    return 0;  // à écrire
}

std::uint32_t extraire(std::uint32_t reg, unsigned pos, unsigned largeur) {
    (void)reg;
    (void)pos;
    (void)largeur;
    return 0;  // à écrire
}

std::uint32_t inserer(std::uint32_t reg, unsigned pos, unsigned largeur, std::uint32_t valeur) {
    (void)pos;
    (void)largeur;
    (void)valeur;
    return reg;  // à écrire
}

std::uint8_t saturer_u8(std::int32_t v) {
    (void)v;
    return 0;  // à écrire
}

std::int16_t mul_q8_8(std::int16_t a, std::int16_t b) {
    (void)a;
    (void)b;
    return 0;  // à écrire
}

std::int32_t q12_4_vers_milli(std::int16_t brut) {
    (void)brut;
    return 0;  // à écrire
}
