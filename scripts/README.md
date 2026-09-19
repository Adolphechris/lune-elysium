Installer les hooks LUNE (optionnel)

But : les hooks Git côté client ne sont pas versionnés dans le dépôt. Ce script permet à un contributeur d'installer localement un hook post-commit qui écrira des métadonnées complémentaires dans .lune/meta/<commit>.json (éditeur utilisé, durée approximative, fichiers modifiés).

Usage :
  bash scripts/install-lune-hooks.sh

Précautions :
- Le hook est optionnel et non intrusif. Il écrit dans .lune/meta localement. Il ne modifie pas l'historique Git.
- Pour mesurer une durée de travail, exporter LUNE_DURATION avant le commit (ex: export LUNE_DURATION=3600).
- Les métadonnées sont traitées par LUNE si présentes lors du build du state.
