# Indices py-07

## Penser « tableau entier »
Une opération entre un tableau et un nombre s'applique à chaque élément : `brut * vref / (2**bits - 1)` convertit tout le tableau d'un coup. Commence par `np.asarray(brut, dtype=float)` pour accepter aussi des listes.

## Filtrer avec un masque
`masque = np.abs(x - x.mean()) <= k * x.std()` est un tableau de booléens ; `x[masque]` ne garde que les `True`.

## La fenêtre glissante
Deux options : `np.convolve(x, np.ones(n) / n, mode="valid")`, ou la somme cumulée : `c = np.cumsum(np.insert(x, 0, 0.0))` puis `(c[n:] - c[:-n]) / n`.

## Colonnes et broadcasting
`a.mean(axis=0)` donne la moyenne de chaque colonne (forme `(colonnes,)`) ; `a - a.mean(axis=0)` la retire à chaque ligne.

## Le débordement de uint8
`image + delta` reste en `uint8` et reboucle au-delà de 255. Élargis d'abord (`image.astype(np.int16)`), ajoute, borne avec `np.clip(…, 0, 255)`, puis reviens en `uint8`.

## Les fronts sans boucle
Compare le tableau décalé avec lui-même : `(x[:-1] < seuil) & (x[1:] >= seuil)`, puis `np.count_nonzero`. Attention aux parenthèses : `&` passe avant `<`.
