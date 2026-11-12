# Praxis Rappels

Un petit agent macOS, dans la barre des menus, qui rappelle de pratiquer sur Praxis aux horaires choisis. Si l'alerte est ignorée, elle monte d'un cran.

```bash
./praxis rappels
```

construit **Praxis Rappels.app**, l'installe dans *Applications* et la lance : un triangle apparaît dans la barre des menus. Elle s'ouvre ensuite toute seule au démarrage du Mac (on peut le désactiver dans ses réglages, ou dans *Réglages Système → Général → Ouverture*). Il faut les outils en ligne de commande de Xcode (`xcode-select --install`).

## Elle reste en route

Un agent arrêté, ce sont des rappels qui ne sonnent plus, et rien ne le signale. Alors :

- **⌘Q ne l'arrête pas.** Tapé par réflexe devant la fenêtre des horaires ou devant une alerte, il ferme la fenêtre et c'est tout. Pour l'arrêter vraiment : clic sur le triangle → *Quitter Praxis Rappels*. Pour ne plus être dérangé quelques jours, mieux vaut *Suspendre les rappels* : ils reprennent tout seuls.
- **Praxis.app la relance** à chaque ouverture si elle ne tourne pas.
- **Rouvrir l'app** (Launchpad, Spotlight) alors qu'elle tourne déjà affiche la fenêtre des horaires.
- Chaque démarrage et chaque arrêt est noté dans le journal, y compris un arrêt sans prévenir (plantage, arrêt forcé).

L'icône de la barre des menus donne l'état du jour : triangle vide (séance à faire), coche (séance faite), triangle plein (alerte en cours ou reportée), lune (rappels suspendus).

## Les trois niveaux

| Niveau | Ce qu'on voit | Son | Report |
|---|---|---|---|
| N1 · Signal | une bannière en haut à droite, qui ne vole pas le clavier | Glass | oui |
| N2 · Alerte | l'écran flouté, une carte au centre ; Entrée lance Praxis, Échap reporte | Submarine | oui, deux fois |
| N3 · Urgence | la même carte, en rouge | Sosumi, répété | non |

Chaque alerte propose **deux façons de dire oui** : la séance du jour, et la **séance express** (six exercices, cinq minutes : les révisions les plus urgentes), qui suffit pour que la journée compte. Après quatre jours sans séance, c'est l'express qui passe devant : « Reprendre · 5 min ».

Sans réaction pendant la fenêtre d'escalade (15 min par défaut), l'alerte passe au niveau suivant, sans jamais dépasser le niveau **« Au plus »** du rappel (N1 pour un rappel qui ne doit jamais bloquer l'écran). « Pas aujourd'hui » demande d'écrire pourquoi (six caractères au moins) : les raisons sont gardées dans le journal des réglages. La bannière N1 se ferme d'un clic.

- **Une seule alerte à la fois** : si plusieurs rappels sont dus en même temps (Mac rouvert après une veille), seul le plus récent s'affiche.
- **Rien quand personne ne regarde** : Mac en veille, capot fermé, écran éteint ou session verrouillée, aucune alerte ne se déclenche ni ne monte de niveau. Un rappel manqué s'affiche au retour s'il date de moins de trois heures, à son niveau de départ. Une alerte restée en attente toute la nuit est abandonnée : elle ne revient pas le lendemain matin.
- **Tard le soir, plus d'écran bloqué** : passé 22 h 30 (réglable, ou sans limite), un rappel en retard n'est qu'une bannière qui propose la séance express, et une alerte déjà affichée ne monte plus de niveau.
- **« Lancer » ne vaut pas séance** : si la séance lancée n'est pas terminée une demi-heure plus tard (réglable), une bannière le rappelle, une seule fois.
- **Suspendre** : clic sur le triangle → *Suspendre les rappels* (jusqu'à demain, 3 jours, une semaine). Ils reprennent tout seuls.
- Si une séance est déjà faite dans la journée, les rappels suivants se taisent.

## Changer les horaires

Clic sur le triangle de la barre des menus → **Changer les horaires…** (ou ⌘, quand le menu est ouvert). Pour chaque rappel : l'heure, le nom, l'interrupteur, les jours (clic sur les lettres), le niveau de départ et le niveau « Au plus ». Le menu du triangle liste les rappels actifs.

Rappels proposés au départ : 18 h 30 en semaine (séance principale, N2 puis N3), samedi 18 h (séance du week-end, N2 puis N3), et 7 h 45 en semaine (révision flash, N1 au plus), fourni éteint.

Ce qui s'est passé est noté dans `~/Library/Logs/Praxis/rappels.log` (menu du triangle → *Journal des rappels*).

## Avec Praxis.app

Praxis Rappels travaille avec le lanceur (`./praxis launcher`) :

- **Lancer Praxis** ouvre Praxis.app directement sur la séance du jour, par l'adresse `praxis://seance` ; **Express** l'ouvre sur la séance courte, par `praxis://seance/express`. Les deux sont aussi dans le menu du triangle.
- **La séance du jour** affichée dans l'alerte vient de Praxis : la page l'écrit, par Praxis.app, dans `~/Library/Application Support/Praxis/next_session.json`, avec la durée de la séance express et les journées déjà pratiquées (une séance terminée, express comprise, ou au moins 10 réponses dans la journée). La série et la semaine de l'alerte en viennent.
- **Une séance terminée** (arrivée au bilan) est annoncée par Praxis.app avec la notification distribuée `io.github.ynsnait-lab.praxis.seanceTerminee` : l'alerte en cours se ferme et les rappels du jour se taisent.

Hors de Praxis.app (navigateur, page Claude), la page n'envoie rien : on peut cocher *J'ai pratiqué aujourd'hui* dans le menu du triangle.

## Pour le développement

```bash
cd launcher/macos/rappels
swift build                                   # compile (Swift 5.9+, macOS 14+)
.build/debug/PraxisRappels --verifier         # rejoue les règles de déclenchement sur des cas datés
.build/debug/PraxisRappels --apercu /tmp/ap   # dessine chaque alerte en PNG, sans rien afficher
.build/debug/PraxisRappels --tester 2         # affiche tout de suite une alerte N2
.build/debug/PraxisRappels --reglages         # ouvre la fenêtre des horaires
"/Applications/Praxis Rappels.app/Contents/MacOS/PraxisRappels" --essai-cmdq   # l'agent en route reçoit la même demande que ⌘Q : il doit rester en route
```

`maquette.html` est la maquette de référence des alertes (à ouvrir dans Safari) : couleurs, hiérarchie, animations.

| Fichier | Rôle |
|---|---|
| `App.swift` | point d'entrée, menu du triangle, fenêtre des horaires, ouverture au démarrage, instance unique, arrêt |
| `Models.swift` | rappels, niveaux, réglages, suspension, journal de pratique (série, semaine, journées sautées) |
| `Regles.swift` | les règles de décision, sans horloge ni écran, et leur vérification (`--verifier`) |
| `Scheduler.swift` | minuterie (15 s), déclenchement d'un seul rappel à la fois, report, escalade, relance après « Lancer » |
| `Presence.swift` | qui est devant l'écran (veille, écran, verrouillage), et le journal `rappels.log` |
| `AlertPanelController.swift` | panneau sans bordure au-dessus de tout, y compris les apps en plein écran |
| `AlertView.swift` | les vues SwiftUI des alertes |
| `PraxisBridge.swift` | le seul point de contact avec Praxis (adresse, fichier, notification) |
| `Apercu.swift` | le rendu en PNG de `--apercu` |

Note : `@State` est devenu une macro dans le SDK de macOS 27, et ces macros manquent aux seuls outils en ligne de commande. Les vues utilisent donc `@StateObject` pour leurs petits états d'animation.

## Idées pour la suite

- Ne pas se déclencher pendant un appel ou un partage d'écran.
- Un bilan du dimanche qui relit les raisons des journées sautées.
- Couvrir tous les écrans au niveau 3.
- Se relancer tout seul après un plantage (agent `launchd`).
