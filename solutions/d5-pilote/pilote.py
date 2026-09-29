"""Pilote d'un régulateur de température SCPI (défi d5) : solution."""
from __future__ import annotations

from types import TracebackType
from typing import TYPE_CHECKING, Protocol

if TYPE_CHECKING:
    from typing_extensions import Self            # typing.Self existe à partir de Python 3.11

PAS_D_ERREUR = '0,"No error"'


class InstrumentError(Exception):
    """Erreur signalée par l'instrument ou par la communication."""


class TimeoutInstrument(InstrumentError):
    """L'instrument n'a pas répondu à temps."""


class ReponseInvalide(InstrumentError):
    """L'instrument a répondu quelque chose d'inexploitable."""


class Transport(Protocol):
    def ecrire(self, commande: str) -> None: ...
    def lire_ligne(self, timeout: float) -> str: ...
    def fermer(self) -> None: ...


class FauxTransport:
    """Transport simulé : répond d'après un dictionnaire commande → réponse."""

    def __init__(self, reponses: dict[str, str]) -> None:
        self.reponses = reponses
        self.envoyees: list[str] = []
        self.ferme = False

    def ecrire(self, commande: str) -> None:
        self.envoyees.append(commande)

    def lire_ligne(self, timeout: float) -> str:
        if not self.envoyees or self.envoyees[-1] not in self.reponses:
            return ""                                  # simule un délai dépassé
        return self.reponses[self.envoyees[-1]] + "\n"

    def fermer(self) -> None:
        self.ferme = True


class Instrument:
    """Pilote de l'instrument, indépendant du transport réel."""

    def __init__(self, transport: Transport, timeout: float = 1.0) -> None:
        self.transport = transport
        self.timeout = timeout

    def __enter__(self) -> Self:
        return self

    def __exit__(self, type_exc: type[BaseException] | None, exc: BaseException | None,
                 tb: TracebackType | None) -> None:
        self.transport.fermer()                        # toujours, même si le bloc a levé

    def requete(self, commande: str) -> str:
        self.transport.ecrire(commande)
        reponse = self.transport.lire_ligne(self.timeout)
        if not reponse:
            raise TimeoutInstrument(f"pas de réponse à {commande!r} en {self.timeout} s")
        return reponse.strip()

    def identifier(self) -> str:
        return self.requete("*IDN?")

    def temperature(self) -> float:
        reponse = self.requete("MEAS:TEMP?")
        try:
            return float(reponse)
        except ValueError as e:
            raise ReponseInvalide(f"température illisible : {reponse!r}") from e

    def regler_consigne(self, kelvin: float) -> None:
        if kelvin <= 0:
            raise ValueError(f"consigne {kelvin} K : une température absolue est strictement positive")
        self.transport.ecrire(f"SOUR:TEMP {kelvin:.3f}")
        erreur = self.requete("SYST:ERR?")
        if erreur != PAS_D_ERREUR:
            raise InstrumentError(f"l'instrument signale : {erreur}")
