"""Tests du défi d1. Ne les modifie pas : complète detrameur.py."""
import random

from detrameur import TAILLE_MAX, Detrameur, Mesure, crc8


def trame(id_: int, valeur: int) -> bytes:
    corps = bytes([id_]) + valeur.to_bytes(2, "little", signed=True)
    return bytes([0x7E]) + corps + bytes([crc8(corps)])


def test_crc8_valeur_de_reference():
    assert crc8(b"123456789") == 0xF4
    assert crc8(b"") == 0


def test_une_trame():
    d = Detrameur()
    assert d.alimenter(trame(3, -1000)) == [Mesure(3, -1000)]
    assert d.rejets == 0


def test_trame_coupee_en_deux():
    t = trame(1, 2048)
    d = Detrameur()
    assert d.alimenter(t[:2]) == []
    assert d.alimenter(t[2:]) == [Mesure(1, 2048)]


def test_octet_parasite_avant():
    d = Detrameur()
    assert d.alimenter(b"\x00\x13" + trame(2, 7)) == [Mesure(2, 7)]


def test_crc_faux():
    t = bytearray(trame(4, 100))
    t[4] ^= 0xFF
    d = Detrameur()
    assert d.alimenter(bytes(t) + trame(5, 200)) == [Mesure(5, 200)]
    assert d.rejets == 1


def test_deux_trames_d_un_coup():
    d = Detrameur()
    assert d.alimenter(trame(1, 10) + trame(2, 20)) == [Mesure(1, 10), Mesure(2, 20)]


def test_7e_dans_une_valeur():
    d = Detrameur()
    valeur = int.from_bytes(bytes([0x7E, 0x7E]), "little", signed=True)
    assert d.alimenter(trame(0x7E, valeur)) == [Mesure(0x7E, valeur)]


def test_flux_corrompu_sans_exception_et_tampon_borne():
    rng = random.Random(42)
    d = Detrameur()
    for _ in range(2000):
        d.alimenter(bytes(rng.randrange(256) for _ in range(rng.randrange(1, 20))))
        assert len(d.tampon) <= TAILLE_MAX


def test_propriete_decoupage_aleatoire():
    rng = random.Random(7)
    attendues = [Mesure(rng.randrange(256), rng.randrange(-32768, 32768)) for _ in range(300)]
    flux = b"".join(trame(m.id, m.valeur) for m in attendues)
    d = Detrameur()
    obtenues = []
    i = 0
    while i < len(flux):
        n = rng.randrange(1, 12)
        obtenues += d.alimenter(flux[i:i + n])
        i += n
    assert obtenues == attendues
    assert d.rejets == 0
