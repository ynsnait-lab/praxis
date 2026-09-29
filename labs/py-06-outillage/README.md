# py-06 · Faire taire ruff et mypy --strict

> Cours liés : *Typage & outillage moderne* (py09) et *Tests avec pytest* (py10).

`conversion.py` fonctionne : lance `./praxis check py-06`, les tests pytest passent. Mais le lab reste rouge, parce que la vérification lance aussi deux inspecteurs :

- **ruff**, qui signale un import inutile, un `except` nu et une f-string sans variable ;
- **mypy --strict**, qui exige des annotations partout et refuse qu'une valeur possiblement `None` soit utilisée comme un nombre.

## Ce que tu dois faire

1. Lis les messages de ruff et corrige-les un par un. `ruff check --fix conversion.py` en corrige certains automatiquement : regarde ce qu'il a changé.
2. Annote chaque fonction (paramètres et retour). Le type des seuils est `dict[str, float]` ; une fonction qui peut ne rien trouver renvoie `float | None`.
3. Relance jusqu'à ce que les trois vérifications soient vertes, **sans casser les tests**.

Si ton Python est plus ancien que 3.10, écris `from __future__ import annotations` en tête du fichier pour pouvoir utiliser `float | None`.

## Pour aller plus loin

Dans VS Code, installe les extensions *Ruff* et *Mypy Type Checker* (elles sont dans les recommandations du projet) : les mêmes messages s'affichent pendant que tu tapes.
