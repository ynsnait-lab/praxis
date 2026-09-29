"""Décodage de trames capteur et regroupement des mesures (lab py-02) : solution."""
import struct
from collections import Counter, defaultdict

TRAME = struct.Struct("<BBhB")          # entête, canal, valeur int16 LE, somme
ENTETE = 0xAA


def decoder(trame: bytes) -> tuple[int, float]:
    """Renvoie (canal, température en °C). Lève ValueError si la trame est invalide."""
    if len(trame) != TRAME.size:
        raise ValueError(f"trame de {len(trame)} octets, {TRAME.size} attendus")
    entete, canal, brut, somme = TRAME.unpack(trame)
    if entete != ENTETE:
        raise ValueError(f"entête 0x{entete:02X} au lieu de 0x{ENTETE:02X}")
    attendue = sum(trame[:4]) % 256
    if somme != attendue:
        raise ValueError(f"somme de contrôle 0x{somme:02X}, attendue 0x{attendue:02X}")
    return canal, brut / 16


def decoder_flux(trames: list[bytes]) -> tuple[list[tuple[int, float]], int]:
    """Décode toutes les trames valides ; renvoie (mesures, nombre de trames rejetées)."""
    mesures: list[tuple[int, float]] = []
    rejets = 0
    for t in trames:
        try:
            mesures.append(decoder(t))
        except ValueError:
            rejets += 1
    return mesures, rejets


def grouper(mesures: list[tuple[int, float]]) -> dict[int, list[float]]:
    """Températures par canal, dans l'ordre d'arrivée."""
    groupes: defaultdict[int, list[float]] = defaultdict(list)
    for canal, t in mesures:
        groupes[canal].append(t)
    return dict(groupes)


def canaux_muets(attendus: set[int], mesures: list[tuple[int, float]]) -> set[int]:
    """Canaux attendus qui n'apparaissent dans aucune mesure."""
    return attendus - {canal for canal, _ in mesures}


def top_erreurs(codes: list[str], n: int) -> list[tuple[str, int]]:
    """Les n codes les plus fréquents, avec leur nombre d'occurrences."""
    return Counter(codes).most_common(n)
