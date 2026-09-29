# py-08 · Un outil en ligne de commande

> Cours liés : *Modules, packages, environnements* (py11) et *I/O, instrumentation, CLI* (py13).

Écris `acquisition.py`, un outil qui résume des fichiers de mesures :

```shell
python acquisition.py releve_*.csv --capteur T1 --sortie resume.json -v
```

## Les fichiers

CSV séparés par `;`, avec une ligne d'en-tête :

```text
horodatage;capteur;valeur
2026-09-29T10:00:00;T1;20.5
2026-09-29T10:00:01;T2;4.2
```

Une ligne peut être abîmée (valeur illisible, colonne manquante) : elle est **ignorée**, avec un avertissement dans le journal qui cite le fichier et le numéro de ligne (en-tête = ligne 1).

## Le contrat de `main(argv=None) -> int`

- arguments : un ou plusieurs `fichiers` ; `--capteur NOM` (facultatif, ne garde que ce capteur) ; `--sortie CHEMIN` (facultatif, sinon le JSON s'affiche) ; `-v` / `--verbeux` ;
- résumé : pour chaque capteur, `{"n": …, "moyenne": …, "min": …, "max": …}`, valeurs arrondies à 3 décimales, JSON indenté de 2 espaces et trié par clés ;
- journal : le logger s'appelle `"acquisition"` ; son niveau est `DEBUG` avec `-v`, `INFO` sinon ; chaque ligne abîmée donne un `WARNING` contenant le nom du fichier et `ligne N` ;
- codes de retour : `0` si tout va bien, `1` si aucune mesure valide n'a été trouvée, `2` si un fichier est introuvable (avec un `ERROR` dans le journal).

`main` reçoit ses arguments en paramètre (`argv`) : c'est ce qui permet aux tests de l'appeler comme une fonction. En bas du fichier : `if __name__ == "__main__": raise SystemExit(main())`.

## Pour aller plus loin

Ajoute une option `--format csv` qui écrit le résumé en CSV, et un test pour elle.
