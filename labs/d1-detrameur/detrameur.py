"""Dé-trameur de flux série (défi d1)."""
from __future__ import annotations

TAILLE_MAX = 64
DEBUT = 0x7E


def crc8(data: bytes) -> int:
    """CRC-8, polynôme 0x07, valeur initiale 0."""
    raise NotImplementedError("à écrire")


class Mesure:
    """À transformer en dataclass figée (id: int, valeur: int)."""


class Detrameur:
    def __init__(self) -> None:
        self.tampon = bytearray()
        self.rejets = 0

    def alimenter(self, octets: bytes) -> list[Mesure]:
        raise NotImplementedError("à écrire")
