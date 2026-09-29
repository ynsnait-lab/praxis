"""Pilote d'un régulateur de température SCPI (défi d5)."""
from __future__ import annotations


class InstrumentError(Exception):
    """Erreur signalée par l'instrument ou par la communication."""


class TimeoutInstrument(Exception):
    """L'instrument n'a pas répondu à temps."""


class ReponseInvalide(Exception):
    """L'instrument a répondu quelque chose d'illisible."""


class FauxTransport:
    """Transport simulé pour les tests : à écrire."""


class Instrument:
    """Pilote de l'instrument : à écrire."""
