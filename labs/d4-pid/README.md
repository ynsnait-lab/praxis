# Défi d4 · Régulateur PID en virgule fixe

**Contexte.** Une boucle de régulation de température tourne à 100 Hz sur un microcontrôleur **sans unité flottante**. Consigne et mesure arrivent en Q12.4 (1/16 °C), la sortie pilote un PWM de 0 à 1023.

**Objectif.** Un PID entier, borné, sans emballement de l'intégrale, testable sur PC. L'interface est dans `pid.hpp`, écris `pid.cpp` (le `pid.cpp` fourni est une première version naïve qui a plusieurs défauts).

## Les formules

À chaque appel de `calculer(consigne, mesure)` :

- erreur `e = consigne − mesure` (Q12.4), calculée **en 64 bits** ;
- intégrale `I ← I + e` (sauf anti-emballement, voir plus bas), bornée à `±integrale_max` ;
- dérivée `de = e − e_précédente`, **nulle au premier appel** (pas de « coup » de dérivée au démarrage) ;
- sortie `u = (kp·e + ki·I + kd·de) >> 12` (gains en Q8.8 × erreurs en Q12.4 : 12 bits fractionnaires à retirer), puis bornée à `[sortie_min, sortie_max]` ;
- **anti-emballement** : avant d'accumuler, calcule la sortie avec l'intégrale **actuelle** ; si elle atteint déjà `sortie_max` (ou plus) alors que `e > 0`, ou `sortie_min` (ou moins) alors que `e < 0`, n'accumule pas ce pas.

`reinitialiser()` remet l'intégrale et la mémoire de la dérivée à zéro.

## Critères de réussite

- aucun flottant dans `pid.hpp` et `pid.cpp` (la vérification le contrôle) ;
- aucun débordement, même avec des valeurs extrêmes prolongées (les tests tournent sous UBSan) ;
- l'intégrale ne s'emballe pas quand la sortie est saturée : quand l'erreur change de signe, la sortie quitte la saturation en quelques pas ;
- sur un modèle thermique du premier ordre, la température converge vers la consigne à 0,1 °C près, sans dépasser de plus de 1 °C.

```shell
./praxis check d4
```

## Pour aller plus loin

Porte le régulateur sur un vrai microcontrôleur (ESP32 ou Arduino) avec une sonde de température et une résistance chauffante commandée en PWM : le code de `pid.cpp` ne change pas d'une ligne.
