// analyse.cpp : version « boucles à la main », avec deux bugs (lab cpp-03). À réécrire sans for ni while.
#include "analyse.hpp"

#include <algorithm>
#include <functional>
#include <numeric>

double moyenne(std::span<const double> v) {
    if (v.empty()) return 0.0;
    int somme = 0;
    for (double x : v) somme = static_cast<int>(somme + x);
    return somme / static_cast<double>(v.size());
}

bool alarme(std::span<const double> v, double seuil) {
    for (double x : v)
        if (x > seuil) return true;
    return false;
}

std::vector<double> ecarts(std::span<const double> v) {
    std::vector<double> r;
    for (std::size_t i = 0; i < v.size() - 1; ++i) r.push_back(v[i + 1] - v[i]);
    return r;
}

void retirer_hors_bornes(std::vector<double>& v, double lo, double hi) {
    std::vector<double> gardees;
    for (double x : v)
        if (x >= lo && x <= hi) gardees.push_back(x);
    v = gardees;
}

std::map<std::string, int> compter(const std::vector<std::string>& codes) {
    std::map<std::string, int> r;
    for (const auto& c : codes) ++r[c];
    return r;
}

std::vector<double> k_plus_grandes(std::vector<double> v, std::size_t k) {
    std::sort(v.begin(), v.end(), std::greater<>());
    if (k < v.size()) v.resize(k);
    return v;
}

void trier(std::vector<Mesure>& mesures) {
    for (std::size_t i = 0; i < mesures.size(); ++i)
        for (std::size_t j = i + 1; j < mesures.size(); ++j) {
            const Mesure& a = mesures[i];
            const Mesure& b = mesures[j];
            if (b.canal < a.canal || (b.canal == a.canal && b.valeur > a.valeur)) std::swap(mesures[i], mesures[j]);
        }
}
