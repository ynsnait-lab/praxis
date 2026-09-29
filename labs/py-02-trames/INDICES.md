# Indices py-02

## Décoder avec struct
`struct.unpack("<BBhB", trame)` renvoie les quatre champs d'un coup : `<` pour *little-endian*, `B` pour un octet non signé, `h` pour un entier signé de 2 octets. Vérifie la longueur **avant** d'appeler `unpack`, sinon c'est `struct.error` qui est levée, pas `ValueError`.

## La somme de contrôle
`sum(trame[:4]) % 256` : additionner des `bytes` donne directement des entiers. Compare-la au dernier octet, `trame[4]`.

## Compter les rejets sans s'arrêter
Dans `decoder_flux`, un `try` / `except ValueError` autour de chaque trame : la bonne va dans la liste, la mauvaise incrémente un compteur. Pas de `except` nu !

## Les bons outils
`collections.defaultdict(list)` pour grouper, une différence d'ensembles (`attendus - recus`) pour les canaux muets, et `collections.Counter(codes).most_common(n)` pour le palmarès.
