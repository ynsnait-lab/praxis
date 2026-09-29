# Défi d3 · Pipeline d'analyse de mesures

**Contexte.** Une campagne de mesures a produit un dossier de fichiers CSV `horodatage;capteur;valeur;unite` (avec une ligne d'en-tête), dont certaines lignes sont corrompues. Il peut y en avoir des centaines, et chacun peut être gros.

**Objectif.** Produire un rapport par capteur (nombre de mesures, moyenne, écart-type, minimum, maximum) et le taux de lignes rejetées, **sans jamais tout charger en mémoire**.

## Le contrat, dans `pipeline.py`

1. `lire_dossier(dossier) -> Iterator[str]` : **générateur** qui enchaîne les lignes de tous les fichiers `*.csv` du dossier (triés par nom), fichier après fichier, sans les charger entièrement.
2. `parser_ligne(ligne) -> tuple[str, float] | None` : `(capteur, valeur)`, ou `None` pour une ligne invalide (mauvais nombre de colonnes, valeur illisible, capteur vide). La ligne d'en-tête renvoie aussi `None`.
3. `class Statistiques` : un accumulateur **en flux** (il ne garde pas les valeurs) avec `ajouter(valeur)`, et les propriétés `n`, `moyenne`, `ecart_type` (écart-type de population), `mini`, `maxi`.
4. `analyser(lignes, capteur=None) -> tuple[dict[str, Statistiques], int, int]` : les statistiques par capteur (éventuellement filtrées), le nombre de lignes de **données** lues (en-têtes exclus) et le nombre de lignes rejetées.
5. `main(argv=None) -> int` : `--dossier` (obligatoire), `--sortie` (JSON, sinon affichage), `--capteur`, `-v`. Journal avec `logging`, jamais de `print` pour les messages. Code de retour : 0 si tout va bien, 1 si aucune mesure, 2 si le dossier n'existe pas.

Le JSON produit : `{"capteurs": {"T1": {"n": …, "moyenne": …, "ecart_type": …, "min": …, "max": …}, …}, "lignes": …, "rejets": …, "taux_rejet": …}`, valeurs arrondies à 4 décimales, taux en pourcentage.

## Critères de réussite

- la mémoire utilisée ne dépend pas du nombre de fichiers (un test le mesure avec `tracemalloc`) ;
- une ligne corrompue n'arrête jamais le traitement ;
- la CLI est testable (`main(argv)`) et son code de retour est non nul en cas d'erreur ;
- `logging` au lieu de `print` pour les messages.

```shell
./praxis check d3
```

## Pour aller plus loin

Mesure avec `perf_counter` la version générateurs contre une version « tout dans une liste », sur 200 fichiers de 10 000 lignes, et compare aussi la mémoire de pointe avec `tracemalloc`.
