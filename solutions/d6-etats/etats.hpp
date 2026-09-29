// etats.hpp : solution du défi d6.
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

// Fonction pure : aucune variable globale, aucun accès matériel, aucune horloge.
constexpr Etat suivant(Etat e, const Entrees& in) noexcept {
    switch (e) {
        case Etat::Repos:
            return in.demarrer ? Etat::Purge : Etat::Repos;
        case Etat::Purge:
            if (in.defaut) return Etat::Erreur;
            if (in.arret_urgence) return Etat::Repos;
            return in.temps_ms >= DUREE_PURGE_MS ? Etat::Stabilisation : Etat::Purge;
        case Etat::Stabilisation:
            if (in.defaut) return Etat::Erreur;
            if (in.arret_urgence) return Etat::Repos;
            if (in.derive_mk_min < DERIVE_MAX_MK_MIN) return Etat::Mesure;
            return in.temps_ms > STABILISATION_MAX_MS ? Etat::Erreur : Etat::Stabilisation;
        case Etat::Mesure:
            if (in.defaut) return Etat::Erreur;
            if (in.arret_urgence) return Etat::Repos;
            if (in.points >= POINTS_REQUIS) return Etat::Repos;
            return in.temps_ms > MESURE_MAX_MS ? Etat::Erreur : Etat::Mesure;
        case Etat::Erreur:
            return in.acquitter ? Etat::Repos : Etat::Erreur;
    }
    return Etat::Erreur;                    // valeur hors énumération : jamais d'UB, on se met en sécurité
}

// Vérifications à la compilation : si une règle du diagramme casse, le programme ne compile plus.
static_assert(suivant(Etat::Repos, Entrees{.demarrer = true}) == Etat::Purge);
static_assert(suivant(Etat::Purge, Entrees{.temps_ms = DUREE_PURGE_MS}) == Etat::Stabilisation);
static_assert(suivant(Etat::Mesure, Entrees{.defaut = true, .points = POINTS_REQUIS}) == Etat::Erreur);
static_assert(suivant(Etat::Erreur, Entrees{.demarrer = true}) == Etat::Erreur);

const char* nom(Etat e) noexcept;

class Automate {
public:
    Etat etat() const noexcept { return etat_; }
    void pas(const Entrees& in) noexcept;
    std::size_t taille_journal() const noexcept { return n_; }
    const char* journal(std::size_t i) const noexcept;       // i = 0 : le plus ancien encore gardé

private:
    void noter(const char* message) noexcept;

    Etat etat_ = Etat::Repos;
    std::array<const char*, 16> journal_{};
    std::size_t n_ = 0;
    std::size_t debut_ = 0;                                   // indice du plus ancien message
};
