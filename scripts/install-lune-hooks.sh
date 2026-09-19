#!/usr/bin/env bash
# Installer les hooks LUNE côté client (optionnel)
# Usage: bash scripts/install-lune-hooks.sh
set -euo pipefail
ROOT=$(pwd)
HOOK_DIR="$ROOT/.git/hooks"
META_DIR="$ROOT/.lune/meta"
mkdir -p "$META_DIR"

cat > "$HOOK_DIR/post-commit" <<'HOOK'
#!/usr/bin/env bash
# post-commit hook: collecte métadonnées optionnelles et les écrit dans .lune/meta/<commit>.json
ROOT=$(git rev-parse --show-toplevel)
META_DIR="$ROOT/.lune/meta"
mkdir -p "$META_DIR"
COMMIT_HASH=$(git rev-parse --verify HEAD)
AUTHOR_NAME=$(git show -s --format='%an' $COMMIT_HASH)
AUTHOR_EMAIL=$(git show -s --format='%ae' $COMMIT_HASH)
COMMIT_DATE=$(git show -s --format='%ad' $COMMIT_HASH)

# tenter d'inférer l'éditeur à partir de l'environnement
EDITOR_DETECTED="${GIT_EDITOR:-${VISUAL:-${EDITOR:-}}}"
if [ -z "$EDITOR_DETECTED" ]; then
  # fallback heuristics: TERM_PROGRAM (mac), VSCODE_PID, etc.
  if [ -n "${TERM_PROGRAM:-}" ]; then
    EDITOR_DETECTED="$TERM_PROGRAM"
  elif [ -n "${VSCODE_PID:-}" ]; then
    EDITOR_DETECTED="VS Code"
  else
    EDITOR_DETECTED="inconnu"
  fi
fi

# mesurer durée approximative : si utilisateur exporte LUNE_DURATION env before commit (optional)
DURATION_SECONDS=${LUNE_DURATION:-0}

# fichiers modifiés
FILES=$(git show --pretty="" --name-only $COMMIT_HASH | jq -R -s -c 'split("\n")[:-1]')

cat > "$META_DIR/$COMMIT_HASH.json" <<JSON
{
  "hash": "$COMMIT_HASH",
  "name": "${AUTHOR_NAME}",
  "email": "${AUTHOR_EMAIL}",
  "date": "${COMMIT_DATE}",
  "editor": "${EDITOR_DETECTED}",
  "durationSeconds": ${DURATION_SECONDS},
  "tools": ["${EDITOR_DETECTED}"],
  "files": $FILES
}
JSON

# exit successfully
exit 0
HOOK

chmod +x "$HOOK_DIR/post-commit"
echo "Hooks LUNE installés (post-commit). Les métadonnées seront écrites dans .lune/meta/" 
