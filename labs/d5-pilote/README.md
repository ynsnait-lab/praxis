# Défi d5 · Pilote d'instrument testable

**Contexte.** Un régulateur de température répond à des commandes texte de type SCPI sur un port série : `MEAS:TEMP?` renvoie `20.51`, `*IDN?` renvoie l'identifiant, `SOUR:TEMP 300.000` règle la consigne, `SYST:ERR?` renvoie la dernière erreur (`0,"No error"` si tout va bien).

**Objectif.** Un pilote dont **tous** les tests tournent sans matériel, en moins d'une seconde.

## Le contrat, dans `pilote.py`

1. Exceptions : `InstrumentError(Exception)`, et deux cas particuliers `TimeoutInstrument(InstrumentError)` et `ReponseInvalide(InstrumentError)`.
2. `Transport` : un `typing.Protocol` avec `ecrire(commande: str) -> None`, `lire_ligne(timeout: float) -> str` (renvoie `""` si rien n'arrive à temps) et `fermer() -> None`.
3. `FauxTransport(reponses: dict[str, str])` : garde la liste des commandes reçues dans `envoyees`, répond à la dernière commande d'après le dictionnaire (avec `"\n"` final), renvoie `""` pour une commande inconnue, et passe `ferme` à `True` quand on le ferme.
4. `Instrument(transport, timeout=1.0)`, utilisable avec `with` (le transport est fermé à la sortie, **même si le bloc lève**) :
   - `requete(commande) -> str` : envoie, lit, renvoie la réponse sans espaces autour ; lève `TimeoutInstrument` si la réponse est vide ;
   - `identifier() -> str` (commande `*IDN?`) ;
   - `temperature() -> float` (commande `MEAS:TEMP?`) ; une réponse non numérique lève `ReponseInvalide` ;
   - `regler_consigne(kelvin)` envoie `SOUR:TEMP 300.000` (3 décimales) sans attendre de réponse, puis interroge `SYST:ERR?` : tout autre texte que `0,"No error"` lève `InstrumentError` avec ce texte dans le message. Une consigne ≤ 0 K lève `ValueError` sans rien envoyer.

## Critères de réussite

- la suite de tests tourne sans matériel, en moins d'une seconde ;
- `mypy --strict` et `ruff` n'ont rien à signaler sur `pilote.py` (la vérification les lance) ;
- un délai dépassé lève une exception nommée, jamais un `None` silencieux ;
- le transport est fermé même si le bloc `with` lève.

```shell
./praxis check d5
```

## Pour aller plus loin

Écris `SerialTransport` avec pyserial (`serial.Serial(port, 115200, timeout=…)`, `readline()`, `decode("ascii")`). Il n'est pas testé ici : c'est justement tout l'intérêt de l'avoir isolé derrière `Transport`.
