#!/usr/bin/env bash
# Petit démon de surveillance LUNE : reconstruit l'état LUNE régulièrement.
# Usage (local): bash scripts/run-lune-watch.sh &
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG="/tmp/lune-watch.log"
INTERVAL=30

echo "LUNE watch starting at $(date)" >> "$LOG"
while true; do
  echo "[${PWD}] Running build $(date)" >> "$LOG"
  cd "$ROOT_DIR" || exit 1
  node src/build-lune-state.js >> "$LOG" 2>&1 || echo "build failed $(date)" >> "$LOG"
  sleep $INTERVAL
done
