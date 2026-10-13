# Écrire une notion de Praxis (culture ingé et pistes en domaines)

Ce guide sert à toute personne (ou tout agent) qui écrit un domaine de notions : la culture ingé (`content/inge/`) ou une piste perso (`prive/domaines/`). Le format est le même. Lis-le en entier avant d'écrire, puis ouvre un exemple : `content/inge/automatique.yaml` (notion `auto-pid`) et `content/inge/thermique.yaml`.

## 1. La philosophie

Chaque notion part de **zéro** et monte en **crescendo** jusqu'au niveau d'un ingénieur sur le terrain. Le lecteur est un ingénieur mécatronicien en formation (M2, en alternance) : il est à l'aise avec les maths et la physique de base, mais il découvre le sujet. On le tutoie. On ne lui fait jamais lire un mot technique sans l'avoir expliqué avant.

Le but n'est pas de « couvrir » un sujet mais de le rendre **incollable** dessus : comprendre pourquoi, connaître les ordres de grandeur, savoir faire le calcul, connaître les pièges, et savoir quoi faire sur le terrain.

## 2. Un fichier de domaine

```yaml
id: cryo                     # identifiant du domaine = nom du fichier, sans .yaml
title: Basses températures         # titre court
en: Cryogenics                     # titre anglais
desc: Une phrase qui résume le domaine (affichée sous le titre).
intro: |
  Deux ou trois paragraphes : pourquoi ce domaine compte, ce qu'on va y apprendre, dans quel ordre.
notions:
  - id: cryo-fluides          # préfixe imposé du domaine + mot court ; unique dans tout Praxis
    title: …
    …
```

## 3. Une notion

```yaml
  - id: cryo-fluides
    title: Azote et hélium liquides           # 2 à 6 mots
    en: Liquid nitrogen and liquid helium
    goal: Verbe d'action + résultat vérifiable (« Calculer… », « Choisir… », « Expliquer pourquoi… »).
    minutes: 12                                # temps de lecture réaliste, 8 à 16
    lesson:
      steps:                                   # exactement 5 étapes, niveaux 1, 2, 3, 4, 5 dans l'ordre
        - level: 1
          title: …
          body: |
            …
        - level: 2
          title: …
          body: |
            …
          check:                               # mini-question « Vérifie que tu suis » (1 ou 2 par notion)
            q: …
            choices:
              - t: …
                ok: true
              - t: …
                why: pourquoi c'est faux
              - t: …
                why: pourquoi c'est faux
        - level: 3 …
        - level: 4 …
        - level: 5 …
      recap:                                   # 4 à 6 lignes, chacune autonome (elles forment le « formulaire »)
        - "…"
      pieges: [cryo-odh]                  # identifiants de pièges du domaine (facultatif mais attendu)
      sources:                                 # facultatif ; seulement des pages que tu as réellement ouvertes
        - t: Titre de la page
          url: https://…
          note: ce qu'on y trouve, en quelques mots
    vocab:                                     # 4 à 8 paires, « français = anglais »
      - azote liquide = liquid nitrogen (LN2)
    exercises:                                 # 5 exercices (4 à 6)
      - id: cryo-fluides.1                # id de la notion + « . » + numéro
        …
```

### Les cinq niveaux

| Niveau | Nom affiché | Ce qu'on y met |
|---|---|---|
| 1 | L'image | Une analogie concrète ou une situation vécue. Zéro formule, zéro jargon. 3 à 6 phrases. |
| 2 | Le mécanisme | Comment ça marche vraiment, avec le vocabulaire exact (défini au passage). Listes et gras pour les mots clés. Souvent la mini-question ici. |
| 3 | La formule | L'équation, d'où elle vient en une phrase, ses unités, un **calcul détaillé** avec des valeurs réalistes et un ordre de grandeur. Un petit tableau de valeurs si utile. Éventuellement du code Python exécutable (voir §6). |
| 4 | Sous le capot | Les limites, les cas particuliers, le « pourquoi » profond, ce que les débutants ignorent. |
| 5 | Sur le terrain | La pratique : réflexes, réglages, chiffres réels, erreurs courantes, ce qu'on vérifie avant d'y aller, comment on en parle en anglais avec les collègues. |

Longueur d'une notion : environ 500 à 900 mots de cours. Dense, pas bavard. Des phrases courtes.

### Mise en forme du texte

- Markdown : `**gras**`, listes, tableaux, `code`, titres internes interdits (les étapes ont déjà un titre).
- Formules : LaTeX entre `$…$` (en ligne) ou `$$…$$` (bloc). Dans les formules, la virgule décimale s'écrit `{,}` : `$12{,}4$`.
- Dans le texte, nombres à la française : `12,4 keV`, `6 GeV`, espace avant l'unité, `%` précédé d'une espace.
- Encadrés : une ligne `> [!piege] Titre` puis `> texte` ; aussi `[!note]`, `[!astuce]`, `[!attention]`.
- Schémas SVG facultatifs dans un bloc ` ```svg caption="…" `, avec les classes du thème uniquement (aucune couleur en dur) : traits `s`, `s2`, `as` (accent), `ws` (avertissement), `rs` (rouge), `dash` ; surfaces `soft`, `hl`, `bd`, `gd` ; remplissages `a`, `ink` ; textes `t`, `tb`, `tm`, `ta`, `tw`, `tr` ; `grid`. Un `viewBox`, une `width` ≤ 460, un `role="img"` et un `aria-label`. Les identifiants de `marker` doivent être uniques dans le fichier (préfixe-les avec l'id de la notion). Ne fais un schéma que s'il apporte vraiment quelque chose et que tu es sûr de sa géométrie.

## 4. Les exercices

Trois types suffisent pour une notion de culture : `qcm`, `numeric`, `flash` (et `parsons` pour remettre des étapes dans l'ordre). Mélange : au moins 2 `qcm`, au moins 1 `numeric` quand le sujet s'y prête, au moins 1 `flash`. Niveaux : `1` (bases), `2` (solide), `3` (pointu). Chaque exercice a une explication `e` qui apprend quelque chose, pas une simple confirmation.

```yaml
      - id: cryo-fluides.1
        type: qcm
        level: 1
        q: …
        choices:                       # 3 ou 4 choix, une seule bonne réponse (sinon multi: true)
          - t: …
            ok: true
          - t: …
            why: pourquoi un débutant le choisit, et pourquoi c'est faux
        e: …
        piege: cryo-odh           # facultatif : relie l'exercice à un piège
      - id: cryo-fluides.2
        type: numeric
        level: 2
        q: "Énoncé complet avec toutes les données et l'unité attendue ?"
        answer: 694                    # nombre
        tol: 0.02                      # tolérance relative (2 % par défaut)
        unit: "L"
        calc: 1 * 808 / 1.165          # expression Python (fonctions de math : sqrt, log, pi, exp…) qui redonne answer
        trap_values:                   # erreurs classiques, avec l'explication affichée si on tombe dessus
          - v: 808
            why: …
        e: Le calcul détaillé.
      - id: cryo-fluides.3
        type: flash
        level: 1
        q: Question à se poser de tête.
        back: |
          La réponse attendue, courte et complète.
        e: Un moyen de s'en souvenir (facultatif).
      - id: gpp-cycle.4
        type: parsons
        level: 1
        lang: text                     # étapes en français, pas du code
        q: Remets les phases dans l'ordre.
        lines: [première étape, deuxième étape, troisième étape, quatrième étape]
        extra: [une étape intruse]
        e: …
```

Règles :
- Les **mauvaises réponses** d'un QCM sont des erreurs **plausibles** (les confusions réelles des débutants), jamais des absurdités. Toutes à peu près de la même longueur que la bonne.
- L'ordre des choix n'a pas d'importance (l'app les mélange) : écris la bonne où tu veux.
- `numeric` : la question donne **toutes** les données ; `calc` doit redonner `answer` à la tolérance près (le validateur le vérifie). Choisis une tolérance qui accepte les arrondis raisonnables (0,02 à 0,05). Les `trap_values` sont les résultats des erreurs classiques (oublier un facteur 2, une conversion d'unité, prendre le rayon pour le diamètre…).
- Pas d'exercice qui dépend d'un détail anecdotique ou d'une valeur qu'on ne peut pas raisonnablement connaître ; on teste la compréhension et les ordres de grandeur utiles.

## 5. Les pièges

Un fichier de pièges par domaine (`content/pieges/<domaine>.yaml` ou `prive/pieges/<domaine>.yaml`), une liste :

```yaml
- id: cryo-odh                  # préfixe du domaine
  title: L'azote qui s'évapore dans une pièce fermée   # le piège, dit comme une situation
  en: Nitrogen boil-off in a closed room                # titre anglais (facultatif)
  why_short: Un litre d'azote liquide donne environ 700 litres de gaz, qui chasse l'oxygène sans odeur ni alerte.   # obligatoire : UNE phrase, 140 caractères max, affichée sur la carte du piège
  symptom: Ce qu'on voit, ou ce qu'on croit (une à trois phrases).
  why: |
    Pourquoi ça arrive, le mécanisme, avec un chiffre si possible.
  fix: |
    Le réflexe à prendre, concret.
  bad: |                             # facultatif : le raisonnement ou le calcul piégé (texte simple)
    …
  good: |                            # facultatif : le bon raisonnement
    …
  modules: [cryo-fluides]       # les notions où il est expliqué
```

Trois à six pièges par domaine : les erreurs réelles, coûteuses ou dangereuses du métier.

## 6. Du code Python dans un cours (facultatif)

Une étape peut contenir un petit programme exécutable dans la page :

```yaml
          code: |
            …
          run: true
          out: |
            sortie exacte
```

La sortie `out` doit être **exactement** celle du programme (le validateur l'exécute et compare). Python standard seulement (pas de NumPy), déterministe, moins de 25 lignes, avec des `print(f"…")` formatés. Utilise-le pour un calcul qu'on a envie de faire varier (une simulation de régulation, une table de valeurs), pas pour décorer.

## 7. Le YAML de Praxis

Les clés de texte (`q`, `t`, `why`, `e`, `title`, `goal`, `back`, `symptom`, `fix`, `desc`, `en`, `unit`…) sont protégées automatiquement : on peut écrire des « : » et des « # » dedans sans guillemets. Mais :
- `body`, `intro`, `back` sur plusieurs lignes, `why`/`fix` sur plusieurs lignes : toujours un bloc `|` ;
- les listes `recap`, `vocab` : une chaîne par ligne (les guillemets sont permis) ;
- `calc` n'est pas protégé : s'il contient « : », mets-le entre guillemets ;
- indentation à 2 espaces, jamais de tabulation.

## 8. Les faits

- **Vérifie** chaque chiffre précis et chaque affirmation spécifique (valeurs d'une installation, d'un appareil, d'une norme) dans une source fiable (site officiel, publication, documentation constructeur). Les sources que tu as réellement ouvertes peuvent aller dans `sources`.
- Si tu n'as pas pu vérifier un détail, ne l'invente pas : reste général (« typiquement », « de l'ordre de », « par exemple ») ou supprime-le.
- Distingue ce qui est une loi physique (stable), une valeur typique (ordre de grandeur) et une spécificité d'une installation (à dater : « depuis 2020… »).
- Pas de références à des personnes réelles nommées, pas d'informations internes ou confidentielles.

## 9. Vérifier

```shell
python3 tools/validate.py                                   # tout
PRAXIS_DOMAINES=cryo PRAXIS_TOLERANT=1 \
  python3 tools/validate.py --only cryo --filtre cryo   # un seul domaine, pendant l'écriture à plusieurs
```

Zéro erreur et zéro avertissement sur ton domaine avant de rendre. `--only` limite les exécutions (calculs, code) aux notions dont l'id commence par ce préfixe ; `--filtre` n'affiche que les messages qui contiennent ce texte ; `PRAXIS_DOMAINES` ne charge, dans `prive/` et `content/pieges/`, que les fichiers de ce nom (les autres auteurs écrivent en même temps que toi).
