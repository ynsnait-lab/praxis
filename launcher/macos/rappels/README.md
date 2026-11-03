# Praxis Rappels

Un petit agent macOS, dans la barre des menus, qui rappelle de pratiquer sur Praxis aux horaires choisis. Si l'alerte est ignorée, elle monte d'un cran.

```bash
./praxis rappels
```

construit **Praxis Rappels.app**, l'installe dans *Applications* et la lance : un triangle apparaît dans la barre des menus. Elle s'ouvre ensuite toute seule au démarrage du Mac (on peut le désactiver dans ses réglages, ou dans *Réglages Système → Général → Ouverture*). Il faut les outils en ligne de commande de Xcode (`xcode-select --install`).

## Les trois niveaux

| Niveau | Ce qu'on voit | Son | Report |
|---|---|---|---|
| N1 · Signal | une bannière en haut à droite, qui ne vole pas le clavier | Glass | oui |
| N2 · Alerte | l'écran flouté, une carte au centre ; Entrée lance Praxis, Échap reporte | Submarine | oui, deux fois |
| N3 · Urgence | la même carte, en rouge | Sosumi, répété | non |

Sans réaction pendant la fenêtre d'escalade (15 min par défaut), l'alerte passe au niveau suivant, sans jamais dépasser le niveau **« Au plus »** du rappel (N1 pour un rappel qui ne doit jamais bloquer l'écran). « Pas aujourd'hui » demande d'écrire pourquoi (six caractères au moins) : les raisons sont gardées dans le journal des réglages. La bannière N1 se ferme d'un clic.

- **Une seule alerte à la fois** : si plusieurs rappels sont dus en même temps (Mac rouvert après une veille), seul le plus récent s'affiche.
- **Rien quand personne ne regarde** : Mac en veille, capot fermé, écran éteint ou session verrouillée, aucune alerte ne se déclenche ni ne monte de niveau. Un rappel manqué s'affiche au retour s'il date de moins de trois heures, à son niveau de départ.
- Si une séance est déjà faite dans la journée, les rappels suivants se taisent.

## Changer les horaires

Clic sur le triangle de la barre des menus → **Changer les horaires…** (ou ⌘, quand le menu est ouvert). Pour chaque rappel : l'heure, le nom, l'interrupteur, les jours (clic sur les lettres), le niveau de départ et le niveau « Au plus ». Le menu du triangle liste les rappels actifs.

Rappels proposés au départ : 18 h 30 en semaine (séance principale, N2 puis N3), samedi 18 h (séance du week-end, N2 puis N3), et 7 h 45 en semaine (révision flash, N1 au plus), fourni éteint.

Ce qui s'est passé est noté dans `~/Library/Logs/Praxis/rappels.log` (menu du triangle → *Journal des rappels*).

## Avec Praxis.app

Praxis Rappels travaille avec le lanceur (`./praxis launcher`) :

- **Lancer Praxis** ouvre Praxis.app directement sur la séance du jour, par l'adresse `praxis://seance`.
- **La séance du jour** affichée dans l'alerte vient de Praxis : la page l'écrit, par Praxis.app, dans `~/Library/Application Support/Praxis/next_session.json`, avec les journées déjà pratiquées (une séance terminée, ou au moins 10 réponses dans la journée). La série et la semaine de l'alerte en viennent.
- **Une séance terminée** (arrivée au bilan) est annoncée par Praxis.app avec la notification distribuée `io.github.ynsnait-lab.praxis.seanceTerminee` : l'alerte en cours se ferme et les rappels du jour se taisent.

Hors de Praxis.app (navigateur, page Claude), la page n'envoie rien : on peut cocher *J'ai pratiqué aujourd'hui* dans le menu du triangle.

## Pour le développement

```bash
cd launcher/macos/rappels
swift build                                   # compile (Swift 5.9+, macOS 14+)
.build/debug/PraxisRappels --apercu /tmp/ap   # dessine chaque alerte en PNG, sans rien afficher
.build/debug/PraxisRappels --tester 2         # affiche tout de suite une alerte N2
.build/debug/PraxisRappels --reglages         # ouvre la fenêtre des horaires
```

`maquette.html` est la maquette de référence des alertes (à ouvrir dans Safari) : couleurs, hiérarchie, animations.

| Fichier | Rôle |
|---|---|
| `App.swift` | point d'entrée, menu du triangle, fenêtre des horaires, ouverture au démarrage, instance unique |
| `Models.swift` | rappels, niveaux, règles, journal de pratique (série, semaine, journées sautées) |
| `Scheduler.swift` | minuterie (15 s), déclenchement d'un seul rappel à la fois, report, escalade plafonnée |
| `Presence.swift` | qui est devant l'écran (veille, écran, verrouillage), et le journal `rappels.log` |
| `AlertPanelController.swift` | panneau sans bordure au-dessus de tout, y compris les apps en plein écran |
| `AlertView.swift` | les vues SwiftUI des alertes |
| `PraxisBridge.swift` | le seul point de contact avec Praxis (adresse, fichier, notification) |
| `Apercu.swift` | le rendu en PNG de `--apercu` |

Note : `@State` est devenu une macro dans le SDK de macOS 27, et ces macros manquent aux seuls outils en ligne de commande. Les vues utilisent donc `@StateObject` pour leurs petits états d'animation.

## Idées pour la suite

- Ne pas se déclencher pendant un appel ou un partage d'écran.
- Un rappel du dimanche qui relit les raisons des journées sautées.
- Couvrir tous les écrans au niveau 3.
