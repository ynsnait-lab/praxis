// Tests du défi d4. Ne les modifie pas : corrige pid.cpp.
#include <climits>
#include <cmath>
#include <cstdint>

#include "pid.hpp"
#include "praxis_test.hpp"

namespace {
constexpr std::int32_t C(double celsius) { return static_cast<std::int32_t>(celsius * 16); }   // °C → Q12.4
constexpr std::int64_t G(double gain) { return static_cast<std::int64_t>(gain * 256); }        // gain → Q8.8
}  // namespace

TEST("gains nuls : sortie au minimum") {
    Regulateur r({0, 0, 0}, 0, 1023, 1'000'000);
    CHECK_EQ(r.calculer(C(60), C(20)), 0);
    CHECK_EQ(r.calculer(C(20), C(60)), 0);
}

TEST("proportionnel seul") {
    Regulateur r({G(1), 0, 0}, 0, 1023, 1'000'000);
    CHECK_EQ(r.calculer(C(30), C(20)), 10);          // 1 point par °C, 10 °C d'erreur
    CHECK_EQ(r.calculer(C(20), C(30)), 0);           // erreur négative : bornée à 0
}

TEST("sortie saturée") {
    Regulateur r({G(100), 0, 0}, 0, 1023, 1'000'000);
    CHECK_EQ(r.calculer(C(40), C(20)), 1023);
    Regulateur r2({G(100), 0, 0}, -500, 500, 1'000'000);
    CHECK_EQ(r2.calculer(C(0), C(40)), -500);
}

TEST("intégrale : un point de plus à chaque pas") {
    Regulateur r({0, G(1), 0}, 0, 1023, 1'000'000);
    for (int pas = 1; pas <= 5; ++pas) CHECK_EQ(r.calculer(C(21), C(20)), pas);
}

TEST("intégrale bornée") {
    Regulateur r({0, 1, 0}, 0, 1023, 1000);
    for (int i = 0; i < 100; ++i) r.calculer(C(30), C(20));
    CHECK_EQ(r.integrale(), std::int64_t{1000});
}

TEST("pas de coup de dérivée au premier pas") {
    Regulateur r({0, 0, G(10)}, 0, 1023, 1'000'000);
    CHECK_EQ(r.calculer(C(30), C(20)), 0);
    CHECK_EQ(r.calculer(C(30), C(20)), 0);
    CHECK_EQ(r.calculer(C(32), C(20)), 20);          // l'erreur a gagné 2 °C : 10 points par °C
}

TEST("réinitialiser") {
    Regulateur r({0, G(1), G(10)}, 0, 1023, 1'000'000);
    for (int i = 0; i < 10; ++i) r.calculer(C(21), C(20));
    r.reinitialiser();
    CHECK_EQ(r.integrale(), std::int64_t{0});
    CHECK_EQ(r.calculer(C(21), C(20)), 1);           // ni reste d'intégrale, ni dérivée au redémarrage
}

TEST("anti-emballement : la saturation ne gonfle pas l'intégrale") {
    Regulateur r({0, G(1), 0}, 0, 1023, 1LL << 40);
    int derniere = 0;
    for (int i = 0; i < 10000; ++i) derniere = r.calculer(C(70), C(20));   // longue chauffe au maximum
    CHECK_EQ(derniere, 1023);
    CHECK(r.integrale() < 20000);
    int pas = 0;
    while (r.calculer(C(20), C(25)) == 1023 && pas < 1000) ++pas;
    CHECK(pas < 10);
}

TEST("convergence sur un modèle thermique du premier ordre") {
    Regulateur r({G(30), G(0.25), 0}, 0, 1023, 1LL << 30);
    double t = 20.0, t_max = t;
    for (int k = 0; k < 1000; ++k) {
        const int u = r.calculer(C(60), static_cast<std::int32_t>(std::lround(t * 16)));
        t += (20.0 + 0.1 * u - t) / 100.0;           // chauffe proportionnelle à u, pertes vers 20 °C
        if (t > t_max) t_max = t;
    }
    CHECK_NEAR(t, 60.0, 0.1);
    CHECK(t_max < 61.0);
}

TEST("valeurs extrêmes prolongées : aucun débordement (UBSan veille)") {
    Regulateur r({1LL << 20, 1LL << 20, 1LL << 20}, 0, 1023, 1LL << 40);
    bool bornee = true;
    for (int i = 0; i < 1000; ++i) {
        const int u = (i % 2) ? r.calculer(INT32_MAX, INT32_MIN) : r.calculer(INT32_MIN, INT32_MAX);
        bornee = bornee && u >= 0 && u <= 1023;
    }
    CHECK(bornee);
}
