// etats.hpp : machine à états d'acquisition (défi d6).
#pragma once

#include <array>
#include <cstddef>
#include <cstdint>

enum class Etat : std::uint8_t { Repos, Purge, Stabilisation, Mesure, Erreur };

struct Entrees {
    bool demarrer = false;
    bool acquitter = false;
    bool arret_urgence = false;
    bool defaut = false;
    std::uint32_t temps_ms = 0;             // temps passé dans l'état courant
    std::int32_t derive_mk_min = 1000;      // dérive de température, en millikelvins par minute (valeur absolue)
    std::uint32_t points = 0;               // points de mesure déjà acquis
};

inline constexpr std::uint32_t DUREE_PURGE_MS = 5'000;
inline constexpr std::int32_t DERIVE_MAX_MK_MIN = 100;           // 0,1 °C/min
inline constexpr std::uint32_t STABILISATION_MAX_MS = 600'000;   // 10 min
inline constexpr std::uint32_t MESURE_MAX_MS = 60'000;
inline constexpr std::uint32_t POINTS_REQUIS = 10;

// Fonction pure : l'état suivant, d'après le diagramme du README. À écrire.
constexpr Etat suivant(Etat e, const Entrees& in) noexcept {
    (void)in;
    return e;
}

const char* nom(Etat e) noexcept;

class Automate {
public:
    Etat etat() const noexcept { return etat_; }
    void pas(const Entrees& in) noexcept;
    std::size_t taille_journal() const noexcept { return n_; }
    const char* journal(std::size_t i) const noexcept;       // i = 0 : le plus ancien encore gardé

private:
    Etat etat_ = Etat::Repos;
    std::array<const char*, 16> journal_{};
    std::size_t n_ = 0;
};
