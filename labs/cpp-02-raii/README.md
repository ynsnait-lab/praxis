# cpp-02 · RAII : des ressources qui se rendent seules

> Cours liés : *Pointeurs & mémoire* (cpp03), *RAII & durée de vie* (cpp04), *Copie, déplacement, règle de 0/3/5* (cpp05).

`materiel.cpp` simule un microcontrôleur : **4 ports** qu'on ouvre et qu'on ferme, et un indicateur d'interruptions. Il compte aussi les **erreurs** (fermer un port déjà fermé, par exemple). Ne le modifie pas.

`ressources.hpp` contient deux gardiens RAII écrits trop vite :

- `Port` : doit ouvrir un port dans son constructeur (et lever `std::runtime_error` s'il n'y en a plus), le fermer dans son destructeur, ne **jamais** être copié, et pouvoir être **déplacé** (la source ne possède alors plus rien) ;
- `SectionCritique` : masque les interruptions pendant sa durée de vie, puis **restaure l'état d'avant** (et pas forcément « actives » : les sections peuvent s'imbriquer).

Les tests vérifient qu'après chaque scénario il ne reste **aucun port ouvert** et **aucune erreur**, y compris quand une exception interrompt tout, et quand un `std::vector<Port>` grandit.

## Vérifier

```shell
./praxis check cpp-02
```

Compilé avec tous les avertissements et sous AddressSanitizer + UBSan.

## Pour aller plus loin

`ouvrir_ports` n'a pas besoin de `try`/`catch` pour refermer les ports déjà ouverts quand l'un échoue : explique pourquoi dans un commentaire. Puis écris la même chose sans RAII (avec des `int` et des appels à `fermer_port`) et compte les lignes.
