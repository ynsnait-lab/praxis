# Indices py-04

## Une exception qui porte des données
Dans `__init__`, range les quatre attributs, puis appelle `super().__init__(message)` avec le texte formaté : c'est lui que renvoie `str(e)`. Les bornes s'affichent en flottant : `f"[{float(mini)}, {float(maxi)}]"`.

## trier_lot
Deux `except` dans l'ordre : `MesureInvalide` **d'abord** (elle hérite de `ValueError`, sinon elle serait attrapée par le second), puis `ValueError`. `repr(brut)` donne les guillemets simples du message.

## chrono
```python
@contextmanager
def chrono(resultat):
    debut = time.perf_counter()
    try:
        yield
    finally:
        resultat["secondes"] = ...
```
Le `finally` s'exécute même si le bloc lève, et comme on ne rattrape rien, l'exception continue son chemin.

## Un décorateur paramétré
Trois étages : `reessayer(n, exceptions)` renvoie un décorateur, qui reçoit la fonction et renvoie l'enveloppe. N'oublie pas `@functools.wraps(fonction)` sur l'enveloppe. Dans l'enveloppe : une boucle `for tentative in range(n)`, un `try: return fonction(*args, **kwargs)`, un `except exceptions:` qui relance (`raise`) seulement à la dernière tentative.
