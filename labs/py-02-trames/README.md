# py-02 · Trames binaires et regroupements

> Cours liés : *Séquences, slicing, unpacking* (py03) et *Dictionnaires, sets & hachage* (py04).

Un boîtier d'acquisition envoie des trames de **5 octets** :

| Octet | Contenu |
|---|---|
| 0 | entête, toujours `0xAA` |
| 1 | numéro de canal (0 à 255) |
| 2-3 | valeur brute, entier **signé** 16 bits, *little-endian* |
| 4 | somme de contrôle : somme des octets 0 à 3, modulo 256 |

La valeur physique vaut `brut / 16` (en °C).

## À écrire dans `trames.py`

1. `decoder(trame: bytes) -> tuple[int, float]` : renvoie `(canal, temperature)`. Lève `ValueError` avec un message explicite si la longueur n'est pas 5, si l'entête est faux ou si la somme de contrôle ne correspond pas.
2. `decoder_flux(trames: list[bytes]) -> tuple[list[tuple[int, float]], int]` : décode une liste de trames, garde les bonnes, **compte** les mauvaises sans s'arrêter.
3. `grouper(mesures: list[tuple[int, float]]) -> dict[int, list[float]]` : les températures par canal, dans l'ordre d'arrivée.
4. `canaux_muets(attendus: set[int], mesures) -> set[int]` : les canaux attendus qui n'ont rien envoyé.
5. `top_erreurs(codes: list[str], n: int) -> list[tuple[str, int]]` : les `n` codes d'erreur les plus fréquents, avec leur nombre.

Lance `./praxis check py-02` aussi souvent que tu veux.

## Pour aller plus loin

Remplace ton décodage par un `struct.Struct("<BBhB")` créé une seule fois au niveau du module, et mesure la différence de vitesse avec `timeit` sur 100 000 trames.
