# Indices py-08

## Le squelette
```python
log = logging.getLogger("acquisition")

def construire_parseur() -> argparse.ArgumentParser: ...

def main(argv=None) -> int:
    args = construire_parseur().parse_args(argv)
    logging.basicConfig(format="%(levelname)s %(name)s: %(message)s")
    log.setLevel(logging.DEBUG if args.verbeux else logging.INFO)
    ...
    return 0
```

## Lire un CSV avec les numéros de ligne
`with open(chemin, newline="", encoding="utf-8") as f:` puis `lecteur = csv.DictReader(f, delimiter=";")` et `for numero, ligne in enumerate(lecteur, start=2):` (la ligne 1 est l'en-tête). Une colonne manquante donne `None` dans le dict ; `float(None)` lève `TypeError`, `float("abc")` lève `ValueError` : attrape les deux.

## Fichier introuvable
Vérifie `Path(chemin).is_file()` avant d'ouvrir, ou attrape `FileNotFoundError` : `log.error("fichier introuvable : %s", chemin)` puis `return 2`.

## Le résumé
Accumule les valeurs dans un `defaultdict(list)` par capteur, puis construis le dict final avec `round(…, 3)`. `json.dumps(resume, indent=2, sort_keys=True)`.
