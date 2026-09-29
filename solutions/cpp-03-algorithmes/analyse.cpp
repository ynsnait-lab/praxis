// analyse.cpp : solution du lab cpp-03, sans aucune boucle écrite à la main.
#include "analyse.hpp"

#include <algorithm>
#include <functional>
#include <numeric>
#include <tuple>

double moyenne(std::span<const double> v) {
    if (v.empty()) return 0.0;
    return std::accumulate(v.begin(), v.end(), 0.0) / static_cast<double>(v.size());   // 0.0, pas 0
}

bool alarme(std::span<const double> v, double seuil) {
    return std::any_of(v.begin(), v.end(), [seuil](double x) { return x > seuil; });
}

std::vector<double> ecarts(std::span<const double> v) {
    if (v.size() < 2) return {};                                   // jamais v.size() - 1 sur un vide
    std::vector<double> r(v.size());
    std::adjacent_difference(v.begin(), v.end(), r.begin());       // r[0] = v[0], puis les écarts
    r.erase(r.begin());
    return r;
}

void retirer_hors_bornes(std::vector<double>& v, double lo, double hi) {
    std::erase_if(v, [lo, hi](double x) { return x < lo || x > hi; });
}

std::map<std::string, int> compter(const std::vector<std::string>& codes) {
    std::map<std::string, int> r;
    std::for_each(codes.begin(), codes.end(), [&r](const std::string& c) { ++r[c]; });
    return r;
}

std::vector<double> k_plus_grandes(std::vector<double> v, std::size_t k) {
    const std::size_t n = std::min(k, v.size());
    const auto milieu = v.begin() + static_cast<std::ptrdiff_t>(n);
    std::partial_sort(v.begin(), milieu, v.end(), std::greater<>());   // ne trie que le début
    v.resize(n);
    return v;
}

void trier(std::vector<Mesure>& mesures) {
    std::ranges::sort(mesures, [](const Mesure& a, const Mesure& b) {
        return std::tie(a.canal, b.valeur) < std::tie(b.canal, a.valeur);   // canal ↑, valeur ↓
    });
}
