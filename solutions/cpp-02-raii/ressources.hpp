// ressources.hpp : solution du lab cpp-02.
#pragma once

#include <stdexcept>
#include <utility>
#include <vector>

#include "materiel.hpp"

class Port {
public:
    Port() : id_(materiel::ouvrir_port()) {
        if (id_ < 0) {
            id_ = 0;                                   // ne possède rien
            throw std::runtime_error("aucun port libre");
        }
    }
    ~Port() {
        if (id_ != 0) materiel::fermer_port(id_);      // seulement si on possède encore un port
    }

    Port(const Port&) = delete;                        // un port physique ne se copie pas
    Port& operator=(const Port&) = delete;

    Port(Port&& autre) noexcept : id_(std::exchange(autre.id_, 0)) {}   // la source ne possède plus rien
    Port& operator=(Port&& autre) noexcept {
        if (this != &autre) {
            if (id_ != 0) materiel::fermer_port(id_);  // rendre d'abord ce qu'on possède
            id_ = std::exchange(autre.id_, 0);
        }
        return *this;
    }

    int id() const { return id_; }
    bool valide() const { return id_ > 0; }

private:
    int id_;                                           // 0 = ne possède rien
};

class SectionCritique {
public:
    SectionCritique() : etat_avant_(materiel::irq_actives) { materiel::irq_actives = false; }
    ~SectionCritique() { materiel::irq_actives = etat_avant_; }   // restaurer, pas forcer

    SectionCritique(const SectionCritique&) = delete;
    SectionCritique& operator=(const SectionCritique&) = delete;

private:
    bool etat_avant_;
};

// Ouvre n ports ; si l'un échoue, l'exception remonte et aucun port ne reste ouvert.
// Pas besoin de try/catch : les Port déjà construits (dans le vector) sont détruits pendant la remontée.
std::vector<Port> ouvrir_ports(int n);
