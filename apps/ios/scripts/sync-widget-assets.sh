#!/bin/zsh
# FINISH_SPEC §AC: the widget extension bundles ONLY the art it draws. Rebuilds
# WordociousWidget/Assets.xcassets from the app catalog (copies of the image sets the
# widget references). Re-run after adding art the widget uses; keep the list in sync
# with WordociousWidget.swift.
set -e
cd "$(dirname "$0")/.."
SRC=Wordocious/Resources/Assets.xcassets
DST=WordociousWidget/Assets.xcassets
rm -rf "$DST"; mkdir -p "$DST"
cat > "$DST/Contents.json" <<'JSON'
{
  "info" : {
    "author" : "xcode",
    "version" : 1
  }
}
JSON
copied=0
for pattern in 'mascot-*' 'game-*' 'icon3d-*' 'art-bg-tiles' 'art-badge-icon-*' \
               'wordle-grid' 'swords' 'trending-up' 'shield' 'six-hand' 'seven-hand' 'skull' 'crown'; do
  for d in $SRC/${~pattern}.imageset(N); do
    cp -R "$d" "$DST/"
    copied=$((copied + 1))
  done
done
echo "widget catalog: $copied image sets, $(du -sh $DST | cut -f1)"
