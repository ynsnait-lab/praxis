# Indices py-01

## Par où commencer
Chaque test porte le nom de la fonction qu'il vérifie. Commence par `test_ajouter_independant` : appelle deux fois `ajouter(1)` dans une console Python et regarde ce que contient la seconde liste. Qu'a-t-elle de commun avec la première ?

## La valeur par défaut
Une valeur par défaut est évaluée **une seule fois**, quand Python lit le `def`. Une liste par défaut est donc partagée par tous les appels. Le remède classique : `historique=None`, puis `if historique is None: historique = []` dans le corps.

## La copie qui ne copie pas tout
`dict.copy()` ne copie que le premier niveau : les listes et dicts **à l'intérieur** restent partagés. Le module `copy` a une fonction qui copie tout, récursivement.

## La grille
`[[valeur] * colonnes] * lignes` répète **la même** ligne. Une compréhension crée une ligne neuve à chaque tour : `[[valeur] * colonnes for _ in range(lignes)]`.

## normaliser et est_absente
`normaliser` modifie la liste reçue (affectation `valeurs[i] = …`) : construis une nouvelle liste. Et dans `est_absente`, `not valeur` est vrai pour 0, 0.0, "" et [] : teste l'identité avec `None`.
