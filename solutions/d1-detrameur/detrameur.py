"""Dé-trameur de flux série (défi d1) : solution."""
from __future__ import annotations

from dataclasses import dataclass

TAILLE_MAX = 64
DEBUT = 0x7E
LONGUEUR = 5


def crc8(data: bytes) -> int:
    """CRC-8, polynôme 0x07, valeur initiale 0."""
    crc = 0
    for octet in data:
        crc ^= octet
        for _ in range(8):
            crc = ((crc << 1) ^ 0x07) & 0xFF if crc & 0x80 else (crc << 1) & 0xFF
    return crc


@dataclass(frozen=True)
class Mesure:
    id: int
    valeur: int


class Detrameur:
    def __init__(self) -> None:
        self.tampon = bytearray()
        self.rejets = 0

    def alimenter(self, octets: bytes) -> list[Mesure]:
        self.tampon += octets
        mesures: list[Mesure] = []
        while True:
            debut = self.tampon.find(DEBUT)
            if debut < 0:
                self.tampon.clear()                 # aucun début de trame : rien à garder
                break
            del self.tampon[:debut]                 # octets parasites avant le marqueur
            if len(self.tampon) < LONGUEUR:
                break                               # trame incomplète : attendre la suite
            candidate = bytes(self.tampon[:LONGUEUR])
            if crc8(candidate[1:4]) == candidate[4]:
                valeur = int.from_bytes(candidate[2:4], "little", signed=True)
                mesures.append(Mesure(candidate[1], valeur))
                del self.tampon[:LONGUEUR]
            else:
                self.rejets += 1
                del self.tampon[:1]                 # faux départ : se resynchroniser juste après
        if len(self.tampon) > TAILLE_MAX:
            del self.tampon[:-TAILLE_MAX]
        return mesures
