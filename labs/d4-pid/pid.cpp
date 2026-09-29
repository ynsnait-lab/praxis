// pid.cpp : première version naïve (défi d4). Elle a plusieurs défauts : les tests les révèlent.
#include "pid.hpp"

Regulateur::Regulateur(Gains g, std::int32_t sortie_min, std::int32_t sortie_max, std::int64_t integrale_max)
    : g_(g), sortie_min_(sortie_min), sortie_max_(sortie_max), integrale_max_(integrale_max) {}

void Regulateur::reinitialiser() {}

std::int32_t Regulateur::calculer(std::int32_t consigne, std::int32_t mesure) {
    const std::int32_t e = consigne - mesure;
    integrale_ += e;
    const std::int64_t de = e - erreur_prec_;
    erreur_prec_ = e;
    return static_cast<std::int32_t>((g_.kp * e + g_.ki * integrale_ + g_.kd * de) >> DECALAGE);
}
