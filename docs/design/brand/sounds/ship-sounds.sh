#!/bin/sh
# Ships sounds/out/*.m4a ×3: web public/sounds/<name>.m4a, iOS Resources/Sounds/sfx-<name>.m4a, Android res/raw/sfx_<name>.m4a
set -e
cd "$(dirname "$0")/../../../.."
mkdir -p apps/web/public/sounds apps/ios/Wordocious/Resources/Sounds apps/android/app/src/main/res/raw
for f in docs/design/brand/sounds/out/*.m4a; do
  n=$(basename "$f" .m4a)
  cp "$f" "apps/web/public/sounds/$n.m4a"
  cp "$f" "apps/ios/Wordocious/Resources/Sounds/sfx-$n.m4a"
  cp "$f" "apps/android/app/src/main/res/raw/sfx_$n.m4a"
done
echo shipped $(ls docs/design/brand/sounds/out/*.m4a | wc -l) sounds
