// erreurs.hpp : contrats du lab cpp-04 (ne pas modifier).
#pragma once

#include <cstddef>
#include <cstdint>
#include <optional>
#include <span>
#include <string>
#include <string_view>
#include <vector>

std::optional<double> parser_mesure(std::string_view texte);

std::optional<std::size_t> indice_de(const std::vector<int>& v, int x);

enum class Erreur { aucune, taille, entete, somme };

struct Trame {
    std::uint8_t canal = 0;
    std::int16_t brut = 0;
};

struct Resultat {
    Erreur erreur;
    Trame trame;
};

[[nodiscard]] Resultat decoder(std::span<const std::uint8_t> octets);

const char* message(Erreur e);

double charger_gain(const std::string& nom);
