# cpp-04 · Signaler les erreurs sans les perdre

> Cours liés : *Comportement indéfini & pièges* (cpp09) et *Gestion d'erreurs* (cpp10).

Les signatures sont imposées dans `erreurs.hpp` : chacune utilise l'outil adapté à la situation. Complète `erreurs.cpp`.

| Fonction | Situation | Outil |
|---|---|---|
| `parser_mesure(texte)` | un texte qui n'est pas un nombre complet (vide, `"abc"`, `"21.5x"`) est un cas **normal** | `std::optional<double>` |
| `indice_de(v, x)` | la valeur peut ne pas être présente | `std::optional<std::size_t>` |
| `decoder(octets)` | une trame abîmée est **attendue** sur une liaison série, et la cible n'a pas d'exceptions | `Resultat` avec un `enum class Erreur`, marqué `[[nodiscard]]` |
| `message(erreur)` | un texte lisible pour chaque code | `switch` qui couvre **tous** les cas, sans `default` |
| `charger_gain(nom)` | une configuration fausse au démarrage est **rare** et ne se traite pas sur place | exceptions standard |

Format des trames : `0xAA`, canal (1 octet), valeur brute `int16` *little-endian*, somme de contrôle (somme des 4 premiers octets modulo 256). Même format que le lab Python py-02.

`charger_gain` connaît deux voies : `"ADC1"` (gain 1.02) et `"ADC2"` (gain 0.98). Nom vide : `std::invalid_argument`. Nom inconnu : `std::out_of_range`, avec le nom dans le message.

## Vérifier

```shell
./praxis check cpp-04
```

## Pour aller plus loin

Si ton compilateur le permet (`-std=c++23`), écris une version `decoder_expected` qui renvoie `std::expected<Trame, Erreur>` et compare la lisibilité des deux appels.
