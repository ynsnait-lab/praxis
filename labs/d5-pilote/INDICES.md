# Indices d5

## Le protocole
```python
class Transport(Protocol):
    def ecrire(self, commande: str) -> None: ...
    def lire_ligne(self, timeout: float) -> str: ...
    def fermer(self) -> None: ...
```
`FauxTransport` n'hérite de rien : il suffit qu'il ait ces trois méthodes pour que mypy l'accepte comme un `Transport`.

## Le context manager
`def __enter__(self) -> Self: return self` (avec `Self` importé de `typing` en Python 3.11+, ou de `typing_extensions` sous `if TYPE_CHECKING:` pour les versions plus anciennes) et `def __exit__(self, type_exc: type[BaseException] | None, exc: BaseException | None, tb: TracebackType | None) -> None: self.transport.fermer()`. Ne renvoie pas `True` : l'exception doit continuer son chemin.

## Réponse invalide
Dans `temperature`, un `try: return float(reponse)` et `except ValueError as e: raise ReponseInvalide(f"…{reponse!r}") from e` : le `from e` garde la cause.

## mypy --strict
Annote tout, y compris `__init__` (`-> None`) et les attributs (`self.envoyees: list[str] = []`). Avec `from __future__ import annotations`, les annotations ne sont pas évaluées à l'exécution : tu peux y citer des noms qui n'existent que pour mypy.
