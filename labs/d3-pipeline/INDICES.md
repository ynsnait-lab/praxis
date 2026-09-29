# Indices d3

## Enchaîner les fichiers paresseusement
```python
def lire_dossier(dossier):
    for chemin in sorted(Path(dossier).glob("*.csv")):
        with open(chemin, encoding="utf-8") as f:
            yield from f
```
`yield from f` produit les lignes une à une : un seul fichier est ouvert à la fois, et jamais chargé en entier.

## Moyenne et écart-type sans garder les valeurs
L'algorithme de Welford met à jour trois nombres à chaque valeur : `n += 1`, `delta = x - moyenne`, `moyenne += delta / n`, `m2 += delta * (x - moyenne)`. L'écart-type de population vaut `sqrt(m2 / n)`. Il est stable numériquement, contrairement à la formule « moyenne des carrés moins carré de la moyenne ».

## Reconnaître l'en-tête
Une ligne dont la valeur n'est pas un nombre est rejetée par `parser_ligne`… y compris l'en-tête. Pour ne pas le compter comme un rejet, `analyser` peut ignorer les lignes qui commencent par `horodatage;`.

## Le rapport
Dans `main`, construis un dict simple à partir des `Statistiques` (`round(…, 4)`), puis `json.dumps(…, indent=2, sort_keys=True)`.
