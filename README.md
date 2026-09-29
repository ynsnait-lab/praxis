# Praxis

Un entraînement pour apprendre **Python**, le **C++** et la **culture d'ingénieur** en montant en crescendo : des cours courts qui partent de zéro, des exercices, des pièges dans lesquels tomber une bonne fois pour toutes, de la révision espacée, et des labs à coder sur sa machine avec les vrais outils.

**L'app : [ynsnait-lab.github.io/praxis](https://ynsnait-lab.github.io/praxis/)**

## Ce qu'il y a dedans

| Parcours | Contenu |
|---|---|
| Python | 12 modules de fondamentaux, puis 14 modules avancés : modèle mental, aliasing, générateurs, exceptions, typage, tests, NumPy, instrumentation, concurrence… |
| C++ | 13 modules de fondamentaux, puis 14 modules avancés : RAII, sémantique de déplacement, templates, bits et registres, virgule fixe, comportement indéfini, embarqué… |
| Culture d'ingé | 20 domaines, de la RDM à l'anglais technique : mécanique, fluides, dynamique, électrotechnique, électronique, automatique, automatismes, informatique… |
| Pièges | 242 pièges classés : le code piégé, ce qui se passe vraiment, la bonne pratique |
| Labs | 12 labs guidés et 6 défis à coder en local, vérifiés par `./praxis check` |

Chaque module suit la même pente : un cours découpé en petites étapes (de « jamais vu » à « niveau ingénieur »), des exemples exécutables dans la page (Python tourne dans le navigateur grâce à Pyodide), puis des exercices : prédire une sortie, trouver le bug, compléter, écrire. Les cartes reviennent au bon moment grâce à la révision espacée (FSRS).

La progression reste dans le navigateur ; *Réglages → Exporter* la sauvegarde dans un fichier JSON.

## L'app sur ton Mac

```shell
./praxis app        # construit l'app et l'ouvre dans ton navigateur (http://localhost:8000)
./praxis launcher   # macOS : installe Praxis.app, à lancer depuis le Launchpad, Spotlight ou le Dock
```

Praxis.app ouvre Praxis dans sa propre fenêtre et s'occupe du serveur local toute seule. Voir [launcher/README.md](launcher/README.md).

## Les labs, sur ta machine

```shell
git clone https://github.com/ynsnait-lab/praxis.git
cd praxis
./praxis doctor     # vérifie Python, le compilateur C++, CMake
./praxis setup      # .venv avec pytest, ruff, mypy, NumPy
./praxis next       # le prochain lab
./praxis check py-01
```

Tout est expliqué dans [labs/README.md](labs/README.md). Sur macOS, le C++ demande `xcode-select --install` puis `brew install cmake ninja`.

## Organisation du dépôt

```text
app/          l'app : JavaScript sans framework, empaqueté par esbuild
content/      tout le contenu, en YAML : cours, exercices, pièges, culture d'ingé
labs/         les labs (énoncé, code de départ, tests, indices)
solutions/    les solutions de référence des labs
launcher/     Praxis.app, le lanceur macOS, et le logo
tools/        construction de l'app et vérification du contenu
praxis        l'outil en ligne de commande des labs (Python 3.9+, aucune dépendance)
```

## Le contenu est vérifié

Aucune sortie n'est écrite à la main sans être contrôlée :

- `tools/validate.py` exécute chaque exemple Python des cours et compile chaque exemple C++ (`-Wall -Wextra`, AddressSanitizer, UndefinedBehaviorSanitizer), puis compare la sortie obtenue à celle affichée ; il vérifie aussi chaque exercice (solutions, bugs, calculs de la culture d'ingé) ;
- `tools/check_pyodide.py` rejoue les exemples Python dans Pyodide, l'interpréteur de l'app ;
- `./praxis check --all --solution` vérifie que chaque solution de référence passe ses tests.

L'intégration continue lance les trois à chaque envoi, et publie l'app sur GitHub Pages.

## Travailler sur Praxis

```shell
npm ci                         # esbuild, Pyodide, Temml
pip install pyyaml             # (ou ./praxis setup)
python3 tools/validate.py      # vérifie tout le contenu
node tools/build.mjs           # construit dist/index.html
./praxis app                   # construit et ouvre l'app en local
```

Un module est un fichier YAML de `content/` : son cours (`lesson`), ses exercices, son vocabulaire. Le validateur signale tout exemple dont la sortie ne correspond pas.

## Licence

[MIT](LICENSE).
