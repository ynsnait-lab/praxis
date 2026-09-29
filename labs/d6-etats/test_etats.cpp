// Tests du défi d6. Ne les modifie pas : complète etats.hpp et etats.cpp.
#include <string>

#include "etats.hpp"
#include "praxis_test.hpp"

namespace {
Entrees E() { return Entrees{}; }
}  // namespace

TEST("Repos : attend l'ordre de départ") {
    CHECK(suivant(Etat::Repos, E()) == Etat::Repos);
    Entrees in = E();
    in.demarrer = true;
    CHECK(suivant(Etat::Repos, in) == Etat::Purge);
    in = E();
    in.points = 50;
    in.temps_ms = 1'000'000;
    CHECK(suivant(Etat::Repos, in) == Etat::Repos);          // rien d'autre ne le fait bouger
}

TEST("Purge : 5 secondes") {
    Entrees in = E();
    in.temps_ms = 4'999;
    CHECK(suivant(Etat::Purge, in) == Etat::Purge);
    in.temps_ms = 5'000;
    CHECK(suivant(Etat::Purge, in) == Etat::Stabilisation);
}

TEST("Stabilisation : dérive faible, ou délai dépassé") {
    Entrees in = E();
    in.derive_mk_min = 150;
    in.temps_ms = 10'000;
    CHECK(suivant(Etat::Stabilisation, in) == Etat::Stabilisation);
    in.derive_mk_min = 99;
    CHECK(suivant(Etat::Stabilisation, in) == Etat::Mesure);
    in.derive_mk_min = 100;                                   // strictement inférieure à 0,1 °C/min
    CHECK(suivant(Etat::Stabilisation, in) == Etat::Stabilisation);
    in.temps_ms = 600'001;
    CHECK(suivant(Etat::Stabilisation, in) == Etat::Erreur);
}

TEST("Mesure : 10 points, ou délai dépassé") {
    Entrees in = E();
    in.points = 9;
    CHECK(suivant(Etat::Mesure, in) == Etat::Mesure);
    in.points = 10;
    CHECK(suivant(Etat::Mesure, in) == Etat::Repos);
    in.points = 3;
    in.temps_ms = 60'001;
    CHECK(suivant(Etat::Mesure, in) == Etat::Erreur);
}

TEST("défaut : Erreur depuis chaque étape active, avant tout le reste") {
    Entrees in = E();
    in.defaut = true;
    in.arret_urgence = true;
    in.temps_ms = 5'000;
    in.points = 10;
    in.derive_mk_min = 0;
    CHECK(suivant(Etat::Purge, in) == Etat::Erreur);
    CHECK(suivant(Etat::Stabilisation, in) == Etat::Erreur);
    CHECK(suivant(Etat::Mesure, in) == Etat::Erreur);
}

TEST("arrêt d'urgence : retour au repos") {
    Entrees in = E();
    in.arret_urgence = true;
    in.temps_ms = 5'000;
    CHECK(suivant(Etat::Purge, in) == Etat::Repos);
    CHECK(suivant(Etat::Stabilisation, in) == Etat::Repos);
    CHECK(suivant(Etat::Mesure, in) == Etat::Repos);
}

TEST("Erreur : seul l'acquittement en sort") {
    Entrees in = E();
    in.demarrer = true;
    in.arret_urgence = true;
    CHECK(suivant(Etat::Erreur, in) == Etat::Erreur);
    in = E();
    in.acquitter = true;
    CHECK(suivant(Etat::Erreur, in) == Etat::Repos);
}

TEST("état inattendu : Erreur") {
    CHECK(suivant(static_cast<Etat>(42), E()) == Etat::Erreur);
}

TEST("noms des états") {
    CHECK_EQ(std::string(nom(Etat::Repos)), std::string("Repos"));
    CHECK_EQ(std::string(nom(Etat::Stabilisation)), std::string("Stabilisation"));
    CHECK_EQ(std::string(nom(Etat::Erreur)), std::string("Erreur"));
    CHECK_EQ(std::string(nom(static_cast<Etat>(42))), std::string("?"));
}

TEST("automate : un cycle complet et son journal") {
    Automate a;
    Entrees in = E();
    a.pas(in);
    CHECK(a.etat() == Etat::Repos);
    CHECK_EQ(a.taille_journal(), std::size_t{0});           // pas de changement, pas de message
    in.demarrer = true;
    a.pas(in);
    in = E();
    in.temps_ms = 5'000;
    a.pas(in);
    in = E();
    in.derive_mk_min = 20;
    a.pas(in);
    in = E();
    in.points = 10;
    a.pas(in);
    CHECK(a.etat() == Etat::Repos);
    CHECK_EQ(a.taille_journal(), std::size_t{8});
    CHECK_EQ(std::string(a.journal(0)), std::string("sortie Repos"));
    CHECK_EQ(std::string(a.journal(1)), std::string("entrée Purge"));
    CHECK_EQ(std::string(a.journal(6)), std::string("sortie Mesure"));
    CHECK_EQ(std::string(a.journal(7)), std::string("entrée Repos"));
}

TEST("automate : le journal garde les 16 derniers messages") {
    Automate a;
    Entrees go = E(), stop = E();
    go.demarrer = true;
    stop.arret_urgence = true;
    for (int i = 0; i < 20; ++i) {
        a.pas(go);
        a.pas(stop);
    }
    CHECK_EQ(a.taille_journal(), std::size_t{16});
    CHECK_EQ(std::string(a.journal(15)), std::string("entrée Repos"));
    CHECK_EQ(std::string(a.journal(0)), std::string("sortie Repos"));
}
