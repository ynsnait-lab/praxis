# Indices py-05

## La dataclass figée
`@dataclass(frozen=True)` génère `__init__`, `__repr__`, `__eq__` **et** `__hash__`. La validation va dans `def __post_init__(self): if self.unite == "K" and self.valeur <= 0: raise ValueError(...)`.

## La liste propre à chaque série
Crée la liste dans `__init__` (`self._mesures = []`) : jamais comme attribut de classe, ni comme valeur par défaut d'un paramètre.

## Les méthodes spéciales
`__len__` renvoie `len(self._mesures)`, `__iter__` renvoie `iter(self._mesures)`, `__getitem__(self, i)` renvoie `self._mesures[i]`. Pour `in`, `__contains__(self, valeur)` compare avec les **valeurs** des mesures.

## Propriété et constructeur alternatif
`@property def moyenne(self): ...` se lit `s.moyenne`. `@classmethod def depuis_texte(cls, capteur, texte)` crée `serie = cls(capteur)` puis ajoute chaque valeur de `texte.split(";")`.

## La classe abstraite
`from abc import ABC, abstractmethod`, puis `class Instrument(ABC):` avec `@abstractmethod def lire(self) -> float: ...`. Python refuse alors `Instrument()`. Dans `ThermometreSimule`, garde un itérateur sur la liste (`iter(valeurs)`) et utilise `next(it, None)`.
