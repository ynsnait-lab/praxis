// Tests du lab cpp-02. Ne les modifie pas : corrige ressources.hpp.
#include <stdexcept>
#include <utility>
#include <vector>

#include "praxis_test.hpp"
#include "ressources.hpp"

using namespace materiel;

TEST("un port se ferme à la sortie de son bloc") {
    reinitialiser();
    {
        Port p;
        CHECK(p.valide());
        CHECK_EQ(ports_ouverts(), 1);
    }
    CHECK_EQ(ports_ouverts(), 0);
    CHECK_EQ(erreurs(), 0);
}

TEST("plus de port libre : exception, et rien d'ouvert en trop") {
    reinitialiser();
    {
        Port a, b, c, d;
        CHECK_EQ(ports_ouverts(), 4);
        bool leve = false;
        try {
            Port e;
        } catch (const std::runtime_error&) {
            leve = true;
        }
        CHECK(leve);
        CHECK_EQ(ports_ouverts(), 4);
    }
    CHECK_EQ(ports_ouverts(), 0);
    CHECK_EQ(erreurs(), 0);
}

TEST("déplacement : un seul propriétaire") {
    reinitialiser();
    {
        Port a;
        const int id = a.id();
        Port b = std::move(a);
        CHECK_EQ(b.id(), id);
        CHECK(!a.valide());
        CHECK_EQ(ports_ouverts(), 1);
    }
    CHECK_EQ(ports_ouverts(), 0);
    CHECK_EQ(erreurs(), 0);
}

TEST("affectation par déplacement : l'ancien port est fermé") {
    reinitialiser();
    {
        Port a, b;
        CHECK_EQ(ports_ouverts(), 2);
        a = std::move(b);
        CHECK_EQ(ports_ouverts(), 1);
        CHECK(a.valide());
        CHECK(!b.valide());
    }
    CHECK_EQ(ports_ouverts(), 0);
    CHECK_EQ(erreurs(), 0);
}

TEST("auto-affectation par déplacement : rien ne se casse") {
    reinitialiser();
    {
        Port a;
        Port& alias = a;
        a = std::move(alias);
        CHECK(a.valide());
        CHECK_EQ(ports_ouverts(), 1);
    }
    CHECK_EQ(ports_ouverts(), 0);
    CHECK_EQ(erreurs(), 0);
}

TEST("un vector<Port> qui grandit ne ferme rien deux fois") {
    reinitialiser();
    {
        std::vector<Port> v;
        for (int i = 0; i < 4; ++i) v.emplace_back();
        CHECK_EQ(ports_ouverts(), 4);
    }
    CHECK_EQ(ports_ouverts(), 0);
    CHECK_EQ(erreurs(), 0);
}

TEST("ouvrir_ports : échec au milieu, tout est refermé") {
    reinitialiser();
    bool leve = false;
    try {
        auto ports = ouvrir_ports(6);
    } catch (const std::runtime_error&) {
        leve = true;
    }
    CHECK(leve);
    CHECK_EQ(ports_ouverts(), 0);
    CHECK_EQ(erreurs(), 0);
}

TEST("section critique simple") {
    reinitialiser();
    {
        SectionCritique sc;
        CHECK(!irq_actives);
    }
    CHECK(irq_actives);
}

TEST("sections critiques imbriquées : l'état d'avant est restauré") {
    reinitialiser();
    {
        SectionCritique externe;
        {
            SectionCritique interne;
            CHECK(!irq_actives);
        }
        CHECK(!irq_actives);    // toujours dans la section externe
    }
    CHECK(irq_actives);
}
