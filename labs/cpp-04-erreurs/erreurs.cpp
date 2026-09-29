// erreurs.cpp : à compléter (lab cpp-04). Les contrats sont dans erreurs.hpp.
#include "erreurs.hpp"

std::optional<double> parser_mesure(std::string_view texte) {
    (void)texte;
    return 0.0;  // à écrire
}

std::optional<std::size_t> indice_de(const std::vector<int>& v, int x) {
    (void)v;
    (void)x;
    return 0;  // à écrire
}

Resultat decoder(std::span<const std::uint8_t> octets) {
    (void)octets;
    return {Erreur::aucune, {}};  // à écrire
}

const char* message(Erreur e) {
    (void)e;
    return "";  // à écrire
}

double charger_gain(const std::string& nom) {
    (void)nom;
    return 1.0;  // à écrire
}
