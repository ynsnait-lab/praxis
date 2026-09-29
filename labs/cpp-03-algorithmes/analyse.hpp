// analyse.hpp : contrats du lab cpp-03 (ne pas modifier).
#pragma once

#include <cstddef>
#include <map>
#include <span>
#include <string>
#include <vector>

struct Mesure {
    int canal;
    double valeur;
};

double moyenne(std::span<const double> v);
bool alarme(std::span<const double> v, double seuil);
std::vector<double> ecarts(std::span<const double> v);
void retirer_hors_bornes(std::vector<double>& v, double lo, double hi);
std::map<std::string, int> compter(const std::vector<std::string>& codes);
std::vector<double> k_plus_grandes(std::vector<double> v, std::size_t k);
void trier(std::vector<Mesure>& mesures);
