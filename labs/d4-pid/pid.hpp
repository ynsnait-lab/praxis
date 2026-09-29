// pid.hpp : contrats du défi d4 (ne modifie que la partie private si tu en as besoin).
#pragma once

#include <cstdint>

// Gains en Q8.8 (valeur réelle = gain / 256).
struct Gains {
    std::int64_t kp;   // points de PWM par °C d'erreur
    std::int64_t ki;   // points de PWM par °C d'erreur accumulée à chaque pas
    std::int64_t kd;   // points de PWM par °C de variation d'erreur entre deux pas
};

class Regulateur {
public:
    // Sortie bornée à [sortie_min, sortie_max] ; intégrale bornée à ±integrale_max (en unités Q12.4 × pas).
    Regulateur(Gains g, std::int32_t sortie_min, std::int32_t sortie_max, std::int64_t integrale_max);

    // Températures en Q12.4 (1/16 °C). Renvoie la commande PWM, bornée.
    std::int32_t calculer(std::int32_t consigne, std::int32_t mesure);

    void reinitialiser();
    std::int64_t integrale() const { return integrale_; }

    static constexpr int DECALAGE = 12;   // Q8.8 × Q12.4 = 12 bits fractionnaires à retirer

private:
    Gains g_;
    std::int32_t sortie_min_, sortie_max_;
    std::int64_t integrale_max_;
    std::int64_t integrale_ = 0;
    std::int64_t erreur_prec_ = 0;
    bool premier_ = true;
};
