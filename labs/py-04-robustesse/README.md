# py-04 · Une acquisition qui ne meurt pas

> Cours lié : *Erreurs & robustesse* (py07).

Un script d'acquisition doit survivre aux mesures aberrantes, aux instruments capricieux et à ses propres imprévus, tout en disant **précisément** ce qui s'est passé.

## À écrire dans `robuste.py`

1. `class MesureInvalide(ValueError)` : construite avec `MesureInvalide(capteur, valeur, mini, maxi)`, elle garde ces quatre attributs et son message vaut exactement `capteur T3 : -999.0 hors bornes [-200.0, 1500.0]`.
2. `convertir(capteur, brut, mini=-200.0, maxi=1500.0) -> float` : convertit le texte `brut` en nombre. Texte illisible : `ValueError` (celle de `float` suffit). Hors bornes : `MesureInvalide`.
3. `trier_lot(lot) -> tuple[list[float], list[str]]` : `lot` est une liste de `(capteur, brut)`. Renvoie les valeurs valides et la liste des messages de rejet, **sans jamais s'arrêter**. Un rejet pour texte illisible a pour message `capteur T2 : illisible ('abc')`.
4. `chrono(resultat)` : un context manager (avec `contextlib.contextmanager`) qui écrit dans `resultat["secondes"]` la durée du bloc, **même si le bloc lève une exception**, et ne l'étouffe pas.
5. `reessayer(n, exceptions=(TimeoutError,))` : un décorateur paramétré. La fonction décorée est rappelée jusqu'à `n` fois en tout si elle lève une des `exceptions` ; après le n-ième échec, l'exception remonte. Les autres exceptions remontent immédiatement. Le nom et la doc de la fonction décorée sont conservés.

## Pour aller plus loin

Ajoute à `reessayer` une attente croissante entre les tentatives (paramètre `pause`, doublée à chaque échec), et teste-la sans attendre vraiment grâce à `monkeypatch.setattr(time, "sleep", …)`.
