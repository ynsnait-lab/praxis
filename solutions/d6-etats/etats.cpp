// etats.cpp : solution du défi d6. Aucune allocation : les messages sont des littéraux.
#include "etats.hpp"

namespace {

const char* texte_sortie(Etat e) noexcept {
    switch (e) {
        case Etat::Repos: return "sortie Repos";
        case Etat::Purge: return "sortie Purge";
        case Etat::Stabilisation: return "sortie Stabilisation";
        case Etat::Mesure: return "sortie Mesure";
        case Etat::Erreur: return "sortie Erreur";
    }
    return "sortie ?";
}

const char* texte_entree(Etat e) noexcept {
    switch (e) {
        case Etat::Repos: return "entrée Repos";
        case Etat::Purge: return "entrée Purge";
        case Etat::Stabilisation: return "entrée Stabilisation";
        case Etat::Mesure: return "entrée Mesure";
        case Etat::Erreur: return "entrée Erreur";
    }
    return "entrée ?";
}

}  // namespace

const char* nom(Etat e) noexcept {
    switch (e) {
        case Etat::Repos: return "Repos";
        case Etat::Purge: return "Purge";
        case Etat::Stabilisation: return "Stabilisation";
        case Etat::Mesure: return "Mesure";
        case Etat::Erreur: return "Erreur";
    }
    return "?";
}

void Automate::noter(const char* message) noexcept {
    if (n_ < journal_.size()) {
        journal_[(debut_ + n_) % journal_.size()] = message;
        ++n_;
    } else {                                                  // plein : on écrase le plus ancien
        journal_[debut_] = message;
        debut_ = (debut_ + 1) % journal_.size();
    }
}

void Automate::pas(const Entrees& in) noexcept {
    const Etat nouveau = suivant(etat_, in);
    if (nouveau != etat_) {
        noter(texte_sortie(etat_));
        noter(texte_entree(nouveau));
        etat_ = nouveau;
    }
}

const char* Automate::journal(std::size_t i) const noexcept {
    return i < n_ ? journal_[(debut_ + i) % journal_.size()] : "";
}
