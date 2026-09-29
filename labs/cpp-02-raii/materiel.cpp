// materiel.cpp : simulation d'un microcontrôleur (ne pas modifier).
#include "materiel.hpp"

#include <array>

namespace materiel {

namespace {
std::array<bool, 4> ouverts{};
int nb_erreurs = 0;
}  // namespace

bool irq_actives = true;

int ouvrir_port() {
    for (std::size_t i = 0; i < ouverts.size(); ++i) {
        if (!ouverts[i]) {
            ouverts[i] = true;
            return static_cast<int>(i) + 1;
        }
    }
    return -1;
}

void fermer_port(int id) {
    if (id < 1 || id > static_cast<int>(ouverts.size()) || !ouverts[static_cast<std::size_t>(id - 1)]) {
        ++nb_erreurs;
        return;
    }
    ouverts[static_cast<std::size_t>(id - 1)] = false;
}

int ports_ouverts() {
    int n = 0;
    for (bool o : ouverts) n += o;
    return n;
}

int erreurs() { return nb_erreurs; }

void reinitialiser() {
    ouverts.fill(false);
    nb_erreurs = 0;
    irq_actives = true;
}

}  // namespace materiel
