# Indices d1

## Le CRC-8, bit par bit
```python
crc = 0
for octet in data:
    crc ^= octet
    for _ in range(8):
        crc = ((crc << 1) ^ 0x07) & 0xFF if crc & 0x80 else (crc << 1) & 0xFF
```

## La boucle de décodage
Dans `alimenter` : ajoute les octets au tampon, puis tant que c'est possible : cherche `0x7E` (`self.tampon.find(0x7E)`) ; s'il n'y en a pas, vide le tampon ; sinon jette tout ce qui précède ; s'il reste moins de 5 octets, attends la suite (sors de la boucle) ; sinon examine les 5 octets.

## Resynchronisation
CRC valide : garde la mesure et retire les 5 octets. CRC faux : compte un rejet et retire **un seul** octet (le faux `0x7E`) : la vraie trame commence peut-être juste après.

## Décoder la valeur
`int.from_bytes(trame[2:4], "little", signed=True)`.

## La borne du tampon
À la fin d'`alimenter`, si `len(self.tampon) > TAILLE_MAX`, garde seulement les `TAILLE_MAX` derniers octets : `del self.tampon[:-TAILLE_MAX]`.
