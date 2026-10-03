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
# FINISH_SPEC §AV: the cast's Halloween skins (the day host + peeking heads in season).
for pattern in 'mascot-*' 'game-*' 'icon3d-*' 'art-bg-tiles' 'art-badge-icon-*' \
               'art-halloween-w' 'art-halloween-o1' 'art-halloween-r' 'art-halloween-d' 'art-halloween-o2' \
               'art-halloween-c' 'art-halloween-i' 'art-halloween-o3' 'art-halloween-u' 'art-halloween-s' \
               'wordle-grid' 'swords' 'trending-up' 'shield' 'six-hand' 'seven-hand' 'skull' 'crown'; do
  for d in $SRC/${~pattern}.imageset(N); do
    cp -R "$d" "$DST/"
    copied=$((copied + 1))
  done
done
# BI13b: the one peeking cast member's poses (WidgetCast.peekPoses — keep in sync), downscaled
# to 192 px (drawn at <= 46 pt) so the extension stays slim.
for pose in r-wake r-cocoa o1-ready c-telescope d-eureka i-reach o2-ready o3-ready \
            s-trophy s-victory d-cheer o1-cheer o2-cheer i-cheer; do
  d=$SRC/art-pose-$pose.imageset
  cp -R "$d" "$DST/"
  sips -Z 192 "$DST/art-pose-$pose.imageset/art-pose-$pose.png" >/dev/null
  copied=$((copied + 1))
done
echo "widget catalog: $copied image sets, $(du -sh $DST | cut -f1)"
