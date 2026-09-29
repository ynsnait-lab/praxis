# py-01 · Cinq pièges d'aliasing

> Cours liés : *Modèle mental de l'exécution* (py01) et *Mutabilité & aliasing* (py02).

Le fichier `mesures.py` a été écrit vite, par quelqu'un qui connaissait Python… presque. Chaque fonction donne le bon résultat quand on l'essaie une fois dans la console. Pourtant, chacune cache un piège de mutabilité, d'identité ou de vérité, et les tests de `test_mesures.py` le révèlent.

## Ce que tu dois faire

1. Lance les tests et lis les échecs **avant** de regarder le code :

   ```shell
   ./praxis check py-01
   ```

2. Pour chaque test rouge, trouve la ligne fautive dans `mesures.py` et corrige-la **sans modifier les tests**.
3. Relance jusqu'au vert.

## Les fonctions

| Fonction | Contrat |
|---|---|
| `ajouter(mesure, historique=None)` | ajoute `mesure` à `historique` (ou à une liste neuve) et la renvoie |
| `copie_config(config)` | renvoie une copie **entièrement indépendante** d'une configuration imbriquée |
| `grille(lignes, colonnes, valeur=0)` | renvoie une grille de lignes **distinctes** |
| `normaliser(valeurs)` | renvoie une **nouvelle** liste divisée par le maximum ; l'entrée n'est pas modifiée |
| `est_absente(valeur)` | `True` seulement pour une valeur manquante (`None`), jamais pour 0 |

## Pour aller plus loin

Pour chaque piège corrigé, écris en une phrase, en commentaire, **pourquoi** l'ancienne version se trompait. Si tu sais l'expliquer, tu ne retomberas plus dedans.
