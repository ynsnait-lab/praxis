# Indices py-03

## Un générateur, c'est une fonction avec yield
`def lire_mesures(lignes): for ligne in lignes: ... yield instant, temperature`. Appeler la fonction ne fait rien : le corps s'exécute au fur et à mesure qu'on demande des valeurs. Pour ignorer une ligne, `continue`.

## Lignes illisibles
`ligne.strip()` enlève le `\n` ; `ligne.split(";")` doit donner exactement 2 morceaux ; `float()` lève `ValueError` sur un texte non numérique. Un `try` / `except ValueError` autour de la conversion suffit.

## La fenêtre glissante sans len()
`collections.deque(maxlen=n)` garde automatiquement les `n` derniers éléments. Dès que `len(fenetre) == n` (c'est la longueur de la deque, pas celle du flux), produis `sum(fenetre) / n`.

## Les fronts
Garde la valeur précédente dans une variable (`None` au départ) et parcours avec `enumerate`. Un front, c'est `precedente is not None and precedente < seuil <= valeur`.

## Le compteur
Dans `compteur`, une variable locale `n = 0` et une fonction interne qui fait `nonlocal n`, `n += 1`, `return n`. `compteur` renvoie la fonction interne, **sans** l'appeler.
