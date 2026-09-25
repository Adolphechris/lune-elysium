#!/usr/bin/env bash
# Script de lancement du Satellite LUNE depuis la grille d'applications Linux

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

# 1. Vérifier si PM2 fait tourner lune-elysium
if ! npx pm2 pid lune-elysium >/dev/null 2>&1 || [ "$(npx pm2 pid lune-elysium)" = "0" ]; then
  npx pm2 start ecosystem.config.js >/dev/null 2>&1
  sleep 2
fi

# 2. Ouvrir dans le navigateur en mode App Chrome si dispo, sinon navigateur par défaut
if command -v google-chrome >/dev/null 2>&1; then
  google-chrome --app="http://localhost:4173" --new-window >/dev/null 2>&1 &
elif command -v firefox >/dev/null 2>&1; then
  firefox --new-window "http://localhost:4173" >/dev/null 2>&1 &
else
  xdg-open "http://localhost:4173" >/dev/null 2>&1 &
fi
