// Tests du lab cpp-04. Ne les modifie pas : complète erreurs.cpp.
#include <array>
#include <stdexcept>
#include <string>
#include <vector>

#include "erreurs.hpp"
#include "praxis_test.hpp"

TEST("parser_mesure : nombres valides") {
    CHECK(parser_mesure("21.5") == std::optional<double>(21.5));
    CHECK(parser_mesure("-5") == std::optional<double>(-5.0));
    CHECK(parser_mesure("1e3") == std::optional<double>(1000.0));
}

TEST("parser_mesure : textes invalides") {
    CHECK(!parser_mesure("").has_value());
    CHECK(!parser_mesure("abc").has_value());
    CHECK(!parser_mesure("21.5x").has_value());
    CHECK(!parser_mesure("21.5 ").has_value());
}

TEST("parser_mesure sur une vue non terminée par un zéro") {
    const std::string texte = "12.5;13.0";
    CHECK(parser_mesure(std::string_view(texte).substr(0, 4)) == std::optional<double>(12.5));
}

TEST("indice_de") {
    const std::vector<int> v{4, 8, 15, 16, 8};
    CHECK(indice_de(v, 15) == std::optional<std::size_t>(2));
    CHECK(indice_de(v, 8) == std::optional<std::size_t>(1));
    CHECK(!indice_de(v, 42).has_value());
    CHECK(!indice_de({}, 1).has_value());
}

TEST("decoder : trame valide") {
    const std::array<std::uint8_t, 5> t{0xAA, 0x01, 0x18, 0xFC, 0xBF};
    const Resultat r = decoder(t);
    CHECK(r.erreur == Erreur::aucune);
    CHECK_EQ(r.trame.canal, 1);
    CHECK_EQ(r.trame.brut, -1000);
}

TEST("decoder : erreurs typées") {
    const std::array<std::uint8_t, 3> courte{0xAA, 0x01, 0x18};
    const std::array<std::uint8_t, 5> entete{0x55, 0x01, 0x18, 0xFC, 0xBF};
    const std::array<std::uint8_t, 5> somme{0xAA, 0x01, 0x18, 0xFC, 0x00};
    CHECK(decoder(courte).erreur == Erreur::taille);
    CHECK(decoder(entete).erreur == Erreur::entete);
    CHECK(decoder(somme).erreur == Erreur::somme);
}

TEST("message : un texte pour chaque code") {
    const std::string a = message(Erreur::aucune), b = message(Erreur::taille);
    const std::string c = message(Erreur::entete), d = message(Erreur::somme);
    CHECK(!a.empty() && !b.empty() && !c.empty() && !d.empty());
    CHECK(a != b && b != c && c != d && a != d);
}

TEST("charger_gain : voies connues") {
    CHECK_NEAR(charger_gain("ADC1"), 1.02, 1e-12);
    CHECK_NEAR(charger_gain("ADC2"), 0.98, 1e-12);
}

TEST("charger_gain : exceptions standard") {
    bool invalide = false, hors = false;
    std::string texte;
    try { charger_gain(""); } catch (const std::invalid_argument&) { invalide = true; }
    try { charger_gain("ADC9"); } catch (const std::out_of_range& e) { hors = true; texte = e.what(); }
    CHECK(invalide);
    CHECK(hors);
    CHECK(texte.find("ADC9") != std::string::npos);
}
