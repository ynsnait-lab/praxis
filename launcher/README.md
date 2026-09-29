# Le lanceur macOS

`./praxis launcher` construit **Praxis.app** et l'installe dans `~/Applications`. Praxis s'ouvre alors comme une vraie app : depuis le Launchpad, Spotlight ou le Dock, dans sa propre fenêtre.

Il faut les outils en ligne de commande de Xcode (`xcode-select --install`), Node.js pour construire l'app web (`brew install node`) et l'environnement Python du projet (`./praxis setup`).

## Ce que fait l'app

- Au lancement, elle démarre le serveur local du projet (`./praxis app --no-open --port 47821`). Il ne reconstruit l'app web que si le contenu a changé, par exemple après un `git pull`.
- Elle affiche Praxis dans une fenêtre native (WebKit), avec les menus habituels : *Édition* (copier-coller), *Aller* (⌘1 à ⌘6, ⌘J pour la séance du jour, ⌘, pour les réglages), *Présentation* (recharger, zoom, plein écran).
- Les exports de progression arrivent dans *Téléchargements*, et les liens externes s'ouvrent dans ton navigateur.
- Fermer la fenêtre ou quitter (⌘Q) arrête le serveur.

L'app garde ta progression d'un lancement à l'autre. Elle est séparée de celle de ton navigateur et de ta page Claude : pour passer de l'une à l'autre, *Réglages → Exporter*, puis *Importer* de l'autre côté.

## Si le projet change de place

L'app retient le dossier du projet au moment où elle est construite. S'il est déplacé, elle te demande où il est (ou menu *Praxis → Choisir le dossier du projet…*). Tu peux aussi relancer `./praxis launcher` depuis le nouveau dossier.

## En cas de souci

Le journal du lanceur est dans `~/Library/Logs/Praxis/lanceur.log`, lisible aussi dans l'app Console. Pour désinstaller Praxis.app, mets-la à la corbeille depuis `~/Applications`.

## Le logo

`launcher/logo.svg` est dessiné par `tools/logo.py`, qui produit aussi les icônes du site (`app/icons/`) : un signal échantillonné qui monte en escalier, bleu (Python), violet (C++) puis orange (culture d'ingé), jusqu'au losange doré de Praxis, sur du papier millimétré.
