// erreurs.cpp : solution du lab cpp-04.
#include "erreurs.hpp"

#include <algorithm>
#include <cerrno>
#include <cstdlib>
#include <stdexcept>

std::optional<double> parser_mesure(std::string_view texte) {
    if (texte.empty()) return std::nullopt;
    const std::string copie(texte);                 // strtod veut une chaîne terminée par '\0'
    char* fin = nullptr;
    errno = 0;
    const double v = std::strtod(copie.c_str(), &fin);
    if (fin != copie.c_str() + copie.size() || errno == ERANGE) return std::nullopt;
    return v;
}

std::optional<std::size_t> indice_de(const std::vector<int>& v, int x) {
    const auto it = std::find(v.begin(), v.end(), x);
    if (it == v.end()) return std::nullopt;
    return static_cast<std::size_t>(it - v.begin());
}

Resultat decoder(std::span<const std::uint8_t> octets) {
    if (octets.size() != 5) return {Erreur::taille, {}};
    if (octets[0] != 0xAA) return {Erreur::entete, {}};
    const unsigned somme = (octets[0] + octets[1] + octets[2] + octets[3]) % 256u;
    if (somme != octets[4]) return {Erreur::somme, {}};
    Trame t;
    t.canal = octets[1];
    t.brut = static_cast<std::int16_t>(octets[2] | (octets[3] << 8));   // little-endian
    return {Erreur::aucune, t};
}

const char* message(Erreur e) {
    switch (e) {                                    // tous les cas, pas de default : -Wswitch veille
        case Erreur::aucune: return "trame valide";
        case Erreur::taille: return "longueur de trame incorrecte";
        case Erreur::entete: return "entête inattendu";
        case Erreur::somme: return "somme de contrôle fausse";
    }
    return "?";
}

double charger_gain(const std::string& nom) {
    if (nom.empty()) throw std::invalid_argument("nom de voie vide");
    if (nom == "ADC1") return 1.02;
    if (nom == "ADC2") return 0.98;
    throw std::out_of_range("voie inconnue : " + nom);
}
