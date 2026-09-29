// pid.cpp : solution du défi d4. Aucun flottant : tout est entier, les produits en 64 bits.
#include "pid.hpp"

#include <algorithm>

Regulateur::Regulateur(Gains g, std::int32_t sortie_min, std::int32_t sortie_max, std::int64_t integrale_max)
    : g_(g), sortie_min_(sortie_min), sortie_max_(sortie_max), integrale_max_(integrale_max) {}

void Regulateur::reinitialiser() {
    integrale_ = 0;
    erreur_prec_ = 0;
    premier_ = true;
}

std::int32_t Regulateur::calculer(std::int32_t consigne, std::int32_t mesure) {
    const std::int64_t e = static_cast<std::int64_t>(consigne) - mesure;          // Q12.4, sur 64 bits
    const std::int64_t de = premier_ ? 0 : e - erreur_prec_;                     // pas de coup de dérivée au départ
    premier_ = false;
    erreur_prec_ = e;

    auto brut = [&](std::int64_t integrale) {
        return (g_.kp * e + g_.ki * integrale + g_.kd * de) >> DECALAGE;          // Q8.8 × Q12.4 → points
    };

    // Anti-emballement : si la sortie est déjà saturée dans le sens de l'erreur, on n'accumule pas.
    const std::int64_t u_avant = brut(integrale_);
    const bool bloque = (u_avant >= sortie_max_ && e > 0) || (u_avant <= sortie_min_ && e < 0);
    if (!bloque) integrale_ = std::clamp(integrale_ + e, -integrale_max_, integrale_max_);

    const std::int64_t u = brut(integrale_);
    return static_cast<std::int32_t>(std::clamp<std::int64_t>(u, sortie_min_, sortie_max_));
}
