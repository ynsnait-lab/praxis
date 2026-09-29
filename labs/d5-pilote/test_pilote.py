"""Tests du défi d5. Ne les modifie pas : complète pilote.py."""
import pytest

from pilote import FauxTransport, Instrument, InstrumentError, ReponseInvalide, TimeoutInstrument

REPONSES = {
    "*IDN?": "PRAXIS,REGUL-100,0042,1.3",
    "MEAS:TEMP?": "  20.51 ",
    "SYST:ERR?": '0,"No error"',
}


def test_faux_transport():
    t = FauxTransport({"*IDN?": "X"})
    t.ecrire("*IDN?")
    assert t.lire_ligne(0.1) == "X\n"
    t.ecrire("INCONNUE?")
    assert t.lire_ligne(0.1) == ""
    assert t.envoyees == ["*IDN?", "INCONNUE?"]
    assert not t.ferme
    t.fermer()
    assert t.ferme


def test_identifier_et_temperature():
    t = FauxTransport(REPONSES)
    inst = Instrument(t)
    assert inst.identifier() == "PRAXIS,REGUL-100,0042,1.3"
    assert inst.temperature() == pytest.approx(20.51)
    assert t.envoyees == ["*IDN?", "MEAS:TEMP?"]


def test_timeout_nomme():
    inst = Instrument(FauxTransport({}))
    with pytest.raises(TimeoutInstrument):
        inst.temperature()
    assert issubclass(TimeoutInstrument, InstrumentError)


def test_reponse_invalide():
    inst = Instrument(FauxTransport({"MEAS:TEMP?": "OVERLOAD"}))
    with pytest.raises(ReponseInvalide) as info:
        inst.temperature()
    assert "OVERLOAD" in str(info.value)
    assert isinstance(info.value.__cause__, ValueError), "garde la cause avec raise … from e"
    assert issubclass(ReponseInvalide, InstrumentError)


def test_regler_consigne_ok():
    t = FauxTransport(REPONSES)
    Instrument(t).regler_consigne(300)
    assert t.envoyees == ["SOUR:TEMP 300.000", "SYST:ERR?"]


def test_regler_consigne_erreur_instrument():
    t = FauxTransport({"SYST:ERR?": '-222,"Data out of range"'})
    with pytest.raises(InstrumentError, match="Data out of range"):
        Instrument(t).regler_consigne(5000)


def test_regler_consigne_invalide_n_envoie_rien():
    t = FauxTransport(REPONSES)
    with pytest.raises(ValueError):
        Instrument(t).regler_consigne(-5)
    assert t.envoyees == []


def test_with_ferme_le_transport():
    t = FauxTransport(REPONSES)
    with Instrument(t) as inst:
        inst.identifier()
    assert t.ferme


def test_with_ferme_meme_si_exception():
    t = FauxTransport({})
    with pytest.raises(TimeoutInstrument):
        with Instrument(t) as inst:
            inst.temperature()
    assert t.ferme, "le transport doit être fermé même si le bloc lève"
