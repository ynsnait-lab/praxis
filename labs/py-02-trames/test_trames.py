"""Tests du lab py-02. Ne les modifie pas : complète trames.py."""
import pytest

from trames import canaux_muets, decoder, decoder_flux, grouper, top_erreurs


def fabriquer(canal: int, brut: int) -> bytes:
    """Construit une trame valide (outil de test)."""
    corps = bytes([0xAA, canal]) + brut.to_bytes(2, "little", signed=True)
    return corps + bytes([sum(corps) % 256])


def test_decoder_positif():
    assert decoder(fabriquer(3, 401)) == (3, pytest.approx(25.0625))


def test_decoder_negatif():
    canal, t = decoder(fabriquer(1, -88))
    assert canal == 1
    assert t == pytest.approx(-5.5)


def test_decoder_trame_du_cours():
    assert decoder(bytes([0xAA, 0x01, 0x18, 0xFC, 0xBF])) == (1, pytest.approx(-62.5))


@pytest.mark.parametrize("mauvaise", [
    b"",
    bytes([0xAA, 0x01, 0x10]),                     # trop courte
    bytes([0xAA, 0x01, 0x10, 0x27, 0xE2, 0x00]),   # trop longue
])
def test_decoder_longueur(mauvaise):
    with pytest.raises(ValueError):
        decoder(mauvaise)


def test_decoder_entete():
    t = bytearray(fabriquer(2, 100))
    t[0] = 0x55
    with pytest.raises(ValueError, match="(?i)ent[eê]te"):
        decoder(bytes(t))


def test_decoder_somme():
    t = bytearray(fabriquer(2, 100))
    t[4] ^= 0xFF
    with pytest.raises(ValueError, match="(?i)somme|contr[oô]le|crc"):
        decoder(bytes(t))


def test_decoder_flux():
    flux = [fabriquer(1, 320), b"\x00\x01", fabriquer(2, 336), bytes([0xAA, 1, 2, 3, 4])]
    mesures, rejets = decoder_flux(flux)
    assert mesures == [(1, 20.0), (2, 21.0)]
    assert rejets == 2


def test_grouper():
    m = [(1, 20.0), (2, 21.0), (1, 20.5), (3, 4.2), (2, 21.5)]
    assert grouper(m) == {1: [20.0, 20.5], 2: [21.0, 21.5], 3: [4.2]}
    assert grouper([]) == {}


def test_canaux_muets():
    assert canaux_muets({1, 2, 3, 4}, [(1, 20.0), (3, 4.2)]) == {2, 4}
    assert canaux_muets({1}, [(1, 20.0), (9, 0.0)]) == set()


def test_top_erreurs():
    codes = ["E12", "E04", "E12", "E31", "E12", "E04"]
    assert top_erreurs(codes, 2) == [("E12", 3), ("E04", 2)]
    assert top_erreurs([], 3) == []
