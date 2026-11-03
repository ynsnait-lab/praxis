#!/bin/bash
# Construit « Praxis Rappels.app » (l'agent de barre des menus) et l'installe dans le dossier Applications.
# Usage : ./praxis rappels      (ou : bash launcher/macos/rappels/build.sh [dossier_de_destination])
# Demande les outils en ligne de commande de Xcode (xcode-select --install) : swift, sips, iconutil, codesign.
set -euo pipefail

ICI="$(cd "$(dirname "$0")" && pwd)"
if [ -n "${1:-}" ]; then DEST="$1"; elif [ -w /Applications ]; then DEST=/Applications; else DEST="$HOME/Applications"; fi
ID="io.github.ynsnait-lab.praxis.rappels"
NOM="Praxis Rappels"

TRAVAIL="$(mktemp -d)"
trap 'rm -rf "$TRAVAIL"' EXIT

echo "Compilation de l'agent (Swift, une minute la première fois)…"
if ! swift build -c release --package-path "$ICI" >"$TRAVAIL/compilation.log" 2>&1; then
  grep -E "error:" "$TRAVAIL/compilation.log" | head -20 || tail -20 "$TRAVAIL/compilation.log"
  echo "✗ la compilation a échoué (détails : swift build --package-path \"$ICI\")"
  exit 1
fi
BIN="$(swift build -c release --package-path "$ICI" --show-bin-path)/PraxisRappels"
APP="$TRAVAIL/$NOM.app"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$BIN" "$APP/Contents/MacOS/PraxisRappels"

echo "Icône…"
JEU="$TRAVAIL/AppIcon.iconset"
mkdir "$JEU"
for t in 16 32 128 256 512; do
  sips -z "$t" "$t" "$ICI/../AppIcon-1024.png" --out "$JEU/icon_${t}x${t}.png" >/dev/null
  sips -z $((t * 2)) $((t * 2)) "$ICI/../AppIcon-1024.png" --out "$JEU/icon_${t}x${t}@2x.png" >/dev/null
done
iconutil -c icns "$JEU" -o "$APP/Contents/Resources/AppIcon.icns"

cp "$ICI/Info.plist" "$APP/Contents/Info.plist"
plutil -replace CFBundleVersion -string "$(date +%Y%m%d%H%M)" "$APP/Contents/Info.plist"
codesign --force --sign - --identifier "$ID" "$APP" >/dev/null 2>&1   # signature locale (ad hoc), suffisante sur ce Mac

mkdir -p "$DEST"
if pgrep -xq PraxisRappels; then
  osascript -e "tell application id \"$ID\" to quit" >/dev/null 2>&1 || pkill -x PraxisRappels || true
  sleep 1
fi
ditto "$APP" "$DEST/$NOM.app"
LSREGISTER=/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister
if [ -x "$LSREGISTER" ]; then "$LSREGISTER" -f "$DEST/$NOM.app" >/dev/null 2>&1 || true; fi
open "$DEST/$NOM.app"

echo "✓ $NOM installée dans ${DEST/#$HOME/~} et lancée : un triangle apparaît dans la barre des menus."
echo "  Changer les horaires : clic sur le triangle → Changer les horaires…"
echo "  Elle s'ouvre toute seule au démarrage du Mac (Réglages Système → Général → Ouverture)."
