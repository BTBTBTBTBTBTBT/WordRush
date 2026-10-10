#!/bin/zsh
# Founder 10-10 (the Large widget can't be added on device): the widget extension has a ~30 MB memory
# ceiling and every catalog bitmap is decoded at its SOURCE size ("CoreUI image data": 7.7 MB peak with the
# 512 px mascots and 256 px game icons, all drawn at <= 60 pt). Shrinks each widget-only image set to its
# largest drawn size x 3 (long side, only ever smaller). Idempotent; run after sync-widget-assets.sh.
set -e
cd "$(dirname "$0")/.."
DST=WordociousWidget/Assets.xcassets
shrink() {  # <max long side px> <imageset glob...>
  local max=$1; shift
  for set in "$@"; do
    for f in $set/*.png(N); do
      local w=$(sips -g pixelWidth "$f" | awk '/pixelWidth/{print $2}')
      local h=$(sips -g pixelHeight "$f" | awk '/pixelHeight/{print $2}')
      if [ $(( w > h ? w : h )) -gt $max ]; then sips -Z $max "$f" >/dev/null; fi
    done
  done
}
cd $DST
shrink 192 mascot-*.imageset art-halloween-*.imageset streak-trophy-*.imageset   # <= 60 pt
shrink 160 game-*.imageset                                                       # <= 45 pt
shrink 128 icon3d-*.imageset                                                     # flame 34 pt
shrink 96 icon3d-badge-*.imageset                                                # W / L badges <= 22 pt
shrink 66 art-badge-icon-clock-sprite.imageset                                   # 11 pt
shrink 96 art-badge-icon-star-sprite.imageset art-badge-icon-zap-sprite.imageset
shrink 600 widget-wordmark-large-*.imageset                                      # 16 pt tall = ~133 pt wide
shrink 480 widget-wordmark-medium-*.imageset
shrink 360 widget-headline-*.imageset                                            # 9 pt tall = ~95 pt wide
echo "widget catalog: $(du -sh . | cut -f1)"
