// bits.cpp : solution du lab cpp-01.
#include "bits.hpp"

namespace {

constexpr std::uint32_t masque(unsigned largeur) {
    return largeur >= 32 ? 0xFFFF'FFFFu : (1u << largeur) - 1u;    // jamais 1u << 32 (UB)
}

}  // namespace

std::uint16_t combiner(std::uint8_t fort, std::uint8_t faible) {
    return static_cast<std::uint16_t>((fort << 8) | faible);        // calcul en int, puis conversion explicite
}

std::uint32_t extraire(std::uint32_t reg, unsigned pos, unsigned largeur) {
    return (reg >> pos) & masque(largeur);
}

std::uint32_t inserer(std::uint32_t reg, unsigned pos, unsigned largeur, std::uint32_t valeur) {
    const std::uint32_t m = masque(largeur) << pos;
    return (reg & ~m) | ((valeur << pos) & m);
}

std::uint8_t saturer_u8(std::int32_t v) {
    if (v < 0) return 0;
    if (v > 255) return 255;
    return static_cast<std::uint8_t>(v);
}

std::int16_t mul_q8_8(std::int16_t a, std::int16_t b) {
    std::int32_t p = static_cast<std::int32_t>(a) * b;              // Q16.16 sur 32 bits
    p = (p + (1 << 7)) >> 8;                                         // arrondi, retour en Q8.8
    if (p > INT16_MAX) return INT16_MAX;                             // saturation
    if (p < INT16_MIN) return INT16_MIN;
    return static_cast<std::int16_t>(p);
}

std::int32_t q12_4_vers_milli(std::int16_t brut) {
    return static_cast<std::int32_t>(brut) * 1000 / 16;             // multiplier d'abord, diviser ensuite
}
