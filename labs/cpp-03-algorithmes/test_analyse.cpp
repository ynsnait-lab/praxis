// Tests du lab cpp-03. Ne les modifie pas : réécris analyse.cpp.
#include <array>
#include <vector>

#include "analyse.hpp"
#include "praxis_test.hpp"

TEST("moyenne") {
    std::vector<double> v{0.6, 0.7, 0.8};
    CHECK_NEAR(moyenne(v), 0.7, 1e-12);
    CHECK_EQ(moyenne(std::vector<double>{}), 0.0);
    std::array<double, 2> a{20.5, 21.5};
    CHECK_NEAR(moyenne(a), 21.0, 1e-12);
}

TEST("alarme") {
    std::vector<double> v{21.5, 22.0, 35.2, 20.8};
    CHECK(alarme(v, 30.0));
    CHECK(!alarme(v, 35.2));
    CHECK(!alarme(std::vector<double>{}, 0.0));
}

TEST("ecarts") {
    std::vector<double> v{1.0, 4.0, 9.0, 16.0};
    CHECK(ecarts(v) == (std::vector<double>{3.0, 5.0, 7.0}));
    CHECK(ecarts(std::vector<double>{5.0}).empty());
}

TEST("ecarts d'un vecteur vide") {
    CHECK(ecarts(std::vector<double>{}).empty());
}

TEST("retirer_hors_bornes") {
    std::vector<double> v{-300.0, 20.0, 150.0, 151.0, -50.0};
    retirer_hors_bornes(v, -50.0, 150.0);
    CHECK(v == (std::vector<double>{20.0, 150.0, -50.0}));
}

TEST("compter") {
    auto r = compter({"E12", "E04", "E12", "E31", "E12"});
    CHECK_EQ(r.size(), std::size_t{3});
    CHECK_EQ(r["E12"], 3);
    CHECK_EQ(r["E04"], 1);
    CHECK(compter({}).empty());
}

TEST("k_plus_grandes") {
    CHECK(k_plus_grandes({3.0, 9.0, 1.0, 7.0, 5.0}, 3) == (std::vector<double>{9.0, 7.0, 5.0}));
    CHECK(k_plus_grandes({2.0, 1.0}, 5) == (std::vector<double>{2.0, 1.0}));
    CHECK(k_plus_grandes({}, 2).empty());
}

TEST("trier : canal croissant, puis valeur décroissante") {
    std::vector<Mesure> m{{2, 21.5}, {1, 22.0}, {2, 23.1}, {1, 20.9}, {1, 22.0}};
    trier(m);
    const std::vector<std::pair<int, double>> attendu{{1, 22.0}, {1, 22.0}, {1, 20.9}, {2, 23.1}, {2, 21.5}};
    bool egal = m.size() == attendu.size();
    for (std::size_t i = 0; egal && i < m.size(); ++i)
        egal = m[i].canal == attendu[i].first && m[i].valeur == attendu[i].second;
    CHECK(egal);
}
