# Les labs Praxis

Des exercices à coder sur ta machine, dans ton éditeur, vérifiés par des tests et par les outils d'un vrai projet : pytest, ruff, mypy, le compilateur avec ses avertissements, AddressSanitizer et UndefinedBehaviorSanitizer.

Chaque dossier contient un énoncé (`README.md`), du code de départ à compléter, des tests à ne pas modifier et des indices (`INDICES.md`, à lire avec `./praxis hint`). Les solutions de référence sont dans `solutions/`.

## Installer les outils (macOS)

```shell
xcode-select --install        # compilateur C++ (clang) et git
brew install cmake ninja      # construction des labs C++
./praxis setup                # .venv avec pytest, ruff, mypy, NumPy
./praxis doctor               # tout doit être vert
```

Python 3.9 suffit, une version récente est conseillée (`brew install python`). Sous Linux : `g++`, `cmake`, `ninja-build` et `python3-venv` via le gestionnaire de paquets.

## Le cycle de travail

```shell
./praxis next                 # le prochain lab conseillé
./praxis check py-01          # vérifie le lab
./praxis hint py-01           # un indice (relance pour le suivant)
./praxis solution py-01       # compare avec la solution, après au moins un essai
./praxis reset py-01          # remet le code de départ (efface tes modifications du lab)
./praxis list                 # l'avancement
```

`./praxis check` sans argument, lancé depuis le dossier d'un lab, vérifie ce lab. Les tests échouent au départ : c'est normal, c'est l'énoncé. Lis les échecs **avant** le code.

## Ce que vérifie `./praxis check`

**Python** : les tests pytest du dossier ; `ruff` (règles de `ruff.toml`) et `mypy --strict` pour les labs qui les demandent ; les règles propres au lab (par exemple « aucune boucle écrite à la main »).

**C++** : configuration CMake en mode Debug avec AddressSanitizer et UndefinedBehaviorSanitizer, recompilation complète avec `-Wall -Wextra -Wpedantic -Wconversion -Wshadow`, puis les tests (60 s au maximum). **Un seul avertissement sur ton code fait échouer le lab**, même si les tests passent : dans l'embarqué, un avertissement ignoré finit toujours par coûter cher.

La progression (essais, indices, date de réussite) est gardée dans `.praxis/progression.json`, qui n'est pas versionné.

## La liste

### Labs guidés

| Lab | Dossier | Durée | Sujet |
|---|---|---|---|
| py-01 | `py-01-aliasing` | 30 min | Cinq pièges d'aliasing |
| py-02 | `py-02-trames` | 45 min | Trames binaires et regroupements |
| py-03 | `py-03-flux` | 45 min | Un pipeline de générateurs |
| py-04 | `py-04-robustesse` | 45 min | Une acquisition qui ne meurt pas |
| py-05 | `py-05-classes` | 45 min | Une série de mesures qui parle Python |
| py-06 | `py-06-outillage` | 40 min | Faire taire ruff et mypy --strict |
| py-07 | `py-07-numpy` | 50 min | Vectoriser avec NumPy |
| py-08 | `py-08-cli` | 60 min | Un outil en ligne de commande |
| cpp-01 | `cpp-01-bits` | 45 min | Registres, bits et virgule fixe |
| cpp-02 | `cpp-02-raii` | 50 min | RAII : des ressources qui se rendent seules |
| cpp-03 | `cpp-03-algorithmes` | 50 min | Zéro boucle écrite à la main |
| cpp-04 | `cpp-04-erreurs` | 45 min | Signaler les erreurs sans les perdre |

### Défis

Plus longs et moins guidés : un contrat, des tests, des critères de réussite.

| Défi | Dossier | Langage | Durée | Sujet |
|---|---|---|---|---|
| d1 | `d1-detrameur` | Python | 2 h | Dé-trameur série |
| d3 | `d3-pipeline` | Python | 3 h | Pipeline d'analyse de mesures |
| d5 | `d5-pilote` | Python | 3 h | Pilote d'instrument testable |
| d2 | `d2-ring` | C++ | 2 h | Buffer circulaire générique |
| d4 | `d4-pid` | C++ | 3 h | Régulateur PID en virgule fixe |
| d6 | `d6-etats` | C++ | 3 h | Machine à états d'acquisition |

## Dans VS Code

Ouvre le dossier du projet (pas un lab isolé) :

- les extensions recommandées (Python, Ruff, Mypy, clangd) sont proposées à l'ouverture ;
- choisis l'interpréteur `.venv` (*Cmd+Maj+P → Python: Select Interpreter*) : les tests apparaissent dans l'onglet Tests ;
- *Terminal → Exécuter la tâche → Praxis : vérifier le lab* vérifie le lab du fichier ouvert ;
- pour le C++, clangd lit `build/compile_commands.json`, créé par le premier `./praxis check` du lab.

## Écrire un lab

Un dossier `labs/<id>-<nom>/` avec `lab.json`, `README.md`, `INDICES.md` (un indice par titre `##`), le code de départ et les tests, plus la solution dans `solutions/<même dossier>/` (seuls les fichiers qui changent). `lab.json` :

```json
{
  "id": "py-09", "ordre": 9, "lang": "python", "genre": "lab", "niveau": "avancé", "minutes": 45,
  "titre": "…", "resume": "…", "modules": ["py10"],
  "outils": ["ruff", "mypy"], "fichiers": ["module.py"],
  "interdits": [{"fichier": "module.py", "motif": "\\bfor\\b", "message": "…"}],
  "requis": [{"fichier": "module.py", "motif": "yield", "message": "…"}]
}
```

`./praxis check --all --solution` doit être vert, et `./praxis check <id>` rouge sur le code de départ. L'app lit ces mêmes fichiers : l'énoncé affiché dans l'onglet Labs est ce `README.md`.
