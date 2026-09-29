#!/bin/bash
# Construit Praxis.app (le lanceur macOS) et l'installe dans le dossier Applications.
# Usage : ./praxis launcher      (ou : bash launcher/macos/build.sh [dossier_de_destination])
# Demande les outils en ligne de commande de Xcode (xcode-select --install) : swiftc, sips, iconutil, codesign.
set -euo pipefail

ICI="$(cd "$(dirname "$0")" && pwd)"
RACINE="$(cd "$ICI/../.." && pwd)"
# Le dossier Applications du Mac (celui de la barre latérale du Finder), sinon celui du compte.
if [ -n "${1:-}" ]; then DEST="$1"; elif [ -w /Applications ]; then DEST=/Applications; else DEST="$HOME/Applications"; fi
ID="io.github.ynsnait-lab.praxis"
VERSION="$(/usr/bin/python3 -c 'import json, sys; print(json.load(open(sys.argv[1]))["version"])' "$RACINE/package.json" 2>/dev/null || echo 2.0.0)"

TRAVAIL="$(mktemp -d)"
trap 'rm -rf "$TRAVAIL"' EXIT
APP="$TRAVAIL/Praxis.app"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"

echo "Compilation de l'app (Swift)…"
swiftc -O -swift-version 5 -parse-as-library -target "$(uname -m)-apple-macos13.0" \
  -o "$APP/Contents/MacOS/Praxis" "$ICI/Praxis.swift"

echo "Icône…"
JEU="$TRAVAIL/AppIcon.iconset"
mkdir "$JEU"
for t in 16 32 128 256 512; do
  sips -z "$t" "$t" "$ICI/AppIcon-1024.png" --out "$JEU/icon_${t}x${t}.png" >/dev/null
  sips -z $((t * 2)) $((t * 2)) "$ICI/AppIcon-1024.png" --out "$JEU/icon_${t}x${t}@2x.png" >/dev/null
done
iconutil -c icns "$JEU" -o "$APP/Contents/Resources/AppIcon.icns"

cp "$ICI/Info.plist" "$APP/Contents/Info.plist"
plutil -replace PraxisDossier -string "$RACINE" "$APP/Contents/Info.plist"
plutil -replace CFBundleShortVersionString -string "$VERSION" "$APP/Contents/Info.plist"
plutil -replace CFBundleVersion -string "$(date +%Y%m%d%H%M)" "$APP/Contents/Info.plist"
codesign --force --sign - "$APP" >/dev/null 2>&1       # signature locale (ad hoc), suffisante sur ce Mac

mkdir -p "$DEST"
if [ -d "$DEST/Praxis.app" ]; then
  # une version précédente tourne peut-être : on la quitte (elle enregistre ta progression) avant la mise à jour
  osascript -e "if application id \"$ID\" is running then tell application id \"$ID\" to quit" >/dev/null 2>&1 || true
  sleep 1
fi
ditto "$APP" "$DEST/Praxis.app"             # mise à jour sur place : mêmes fichiers, remplacés
LSREGISTER=/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister
if [ -x "$LSREGISTER" ]; then "$LSREGISTER" -f "$DEST/Praxis.app" >/dev/null 2>&1 || true; fi
touch "$DEST/Praxis.app"

echo "✓ Praxis.app installée dans ${DEST/#$HOME/~}"
if [ "$DEST" != "$HOME/Applications" ] && [ -d "$HOME/Applications/Praxis.app" ]; then
  echo "  (une ancienne copie reste dans ~/Applications : mets-la à la corbeille pour n'en garder qu'une)"
fi
echo "  Lance-la depuis le Launchpad, ou Spotlight : Cmd+Espace puis « Praxis »."
echo "  Pour la garder dans le Dock : pendant qu'elle tourne, clic droit sur son icône → Options → Garder dans le Dock."
