// materiel.hpp : simulation d'un microcontrôleur (ne pas modifier).
#pragma once

namespace materiel {

// Ouvre un port libre et renvoie son numéro (1 à 4), ou -1 s'il n'y en a plus.
int ouvrir_port();

// Ferme le port `id`. Fermer un port déjà fermé (ou inexistant) compte une erreur.
void fermer_port(int id);

int ports_ouverts();
int erreurs();
void reinitialiser();

// Interruptions actives ou masquées (sur une cible : __disable_irq() / __enable_irq()).
extern bool irq_actives;

}  // namespace materiel
