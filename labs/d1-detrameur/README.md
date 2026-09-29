# Défi d1 · Dé-trameur série

**Contexte.** Un capteur envoie en continu des trames de 5 octets sur une liaison série :

| Octet | Contenu |
|---|---|
| 0 | `0x7E`, marqueur de début |
| 1 | identifiant du capteur |
| 2-3 | valeur, entier signé 16 bits *little-endian* |
| 4 | CRC-8 (polynôme `0x07`, valeur initiale 0) calculé sur les octets 1 à 3 |

Le port série livre les octets **par paquets de taille quelconque** : une trame peut arriver coupée en deux lectures, deux trames peuvent arriver dans la même, et la ligne peut apporter des octets parasites. Et `0x7E` peut très bien apparaître au milieu d'une valeur.

**Objectif.** Écrire, dans `detrameur.py`, un module qui transforme ce flux d'octets arbitraire en une suite de mesures validées.

## Étapes

1. `crc8(data: bytes) -> int` : vérifie-la contre la valeur de référence de cette variante (`crc8(b"123456789") == 0xF4`).
2. `@dataclass(frozen=True) class Mesure` avec `id: int` et `valeur: int`.
3. `class Detrameur` :
   - `alimenter(octets: bytes) -> list[Mesure]` accumule dans un `bytearray` interne et renvoie les trames complètes et valides trouvées ;
   - l'attribut `rejets` compte les trames au CRC faux ;
   - après un rejet ou un octet parasite, il se **resynchronise** sur le `0x7E` suivant ;
   - le tampon interne (`len(d.tampon)`) ne dépasse jamais `TAILLE_MAX` (64 octets) : au-delà, on jette le plus ancien.

## Critères de réussite

- aucune exception ne remonte, même sur un flux complètement corrompu ;
- le tampon ne grandit pas indéfiniment ;
- une trame coupée entre deux appels est correctement reconstituée ;
- les tests fournis passent (trame coupée, octet parasite, CRC faux, deux trames d'un coup, flux aléatoire, `0x7E` dans une valeur).

```shell
./praxis check d1
```

## Pour aller plus loin

Ajoute un test « propriété » : génère 1000 trames aléatoires, découpe le flux à des positions aléatoires, et vérifie que tu retrouves exactement les 1000 mesures.
