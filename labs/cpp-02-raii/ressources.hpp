// ressources.hpp : deux gardiens RAII écrits trop vite (lab cpp-02). À corriger.
#pragma once

#include <vector>

#include "materiel.hpp"

class Port {
public:
    Port() : id_(materiel::ouvrir_port()) {}
    ~Port() {}

    Port(const Port&) = delete;
    Port& operator=(const Port&) = delete;

    Port(Port&& autre) noexcept : id_(autre.id_) {}
    Port& operator=(Port&& autre) noexcept {
        id_ = autre.id_;
        return *this;
    }

    int id() const { return id_; }
    bool valide() const { return id_ > 0; }

private:
    int id_;
};

class SectionCritique {
public:
    SectionCritique() { materiel::irq_actives = false; }
    ~SectionCritique() { materiel::irq_actives = true; }

    SectionCritique(const SectionCritique&) = delete;
    SectionCritique& operator=(const SectionCritique&) = delete;
};

// Ouvre n ports ; si l'un échoue, l'exception remonte et aucun port ne reste ouvert.
std::vector<Port> ouvrir_ports(int n);
