// etats.cpp : noms des états et automate (défi d6). À écrire.
#include "etats.hpp"

const char* nom(Etat e) noexcept {
    (void)e;
    return "?";
}

void Automate::pas(const Entrees& in) noexcept {
    etat_ = suivant(etat_, in);
}

const char* Automate::journal(std::size_t i) const noexcept {
    (void)i;
    return "";
}
