#!/bin/bash
# App Store screenshots from the iOS Simulator (README "Simulator pipeline").
#
# Builds the DEBUG app, boots the 6.9" sim headless (never opens Simulator.app),
# sets the clean 9:41 status bar, and for each shot does a FRESH install + launch with
#   -storeDemo -storeShot <name>
# (canned signed-in world, no network: apps/ios/Wordocious/Sources/StoreDemo.swift),
# waits for the screen to settle, and saves store-src/sim-NN-<name>.png (1320x2868).
# Then `python3 store-compose.py` turns them into store-out/67 + store-out/65.
#
#   ./capture-sim.sh                 build + capture every shot + compose
#   SKIP_BUILD=1 ./capture-sim.sh    reuse the last DEBUG build
#   SHOTS="stats leaderboard" ./capture-sim.sh   just those
#   EXTRA_ARGS="-debug-season halloween" ./capture-sim.sh   the Halloween season look (2.8 store set)
#   KEEP_BOOTED=1 ./capture-sim.sh   leave the sim running afterwards
#   APP=/path/Wordocious.app SKIP_BUILD=1 ./capture-sim.sh   capture a prebuilt DEBUG .app
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
IOS="$ROOT/apps/ios"
UDID="${UDID:-9BE11FAF-B046-4550-85DC-3FB35753CD5E}"   # iPhone 17 Pro Max (1320x2868)
BUNDLE="com.wordocious.app"
OUT="$HERE/store-src"
LOG="${TMPDIR:-/tmp}/store-demo-logs"
ALL="home classic octo regions crossword hub friends friendspage stats leaderboard"   # store order (NN in the file name)
SHOTS="${SHOTS:-$ALL}"

# Seconds to wait after launch before the screenshot (the driver plays its moves first).
settle() {
  case "$1" in
    classic) echo 15 ;; finish) echo 22 ;; octo) echo 18 ;;
    friends) echo 11 ;; vs) echo 11 ;; *) echo 9 ;;
  esac
}

mkdir -p "$OUT" "$LOG"

if [ -z "${SKIP_BUILD:-}" ]; then
  while pgrep -x xcodebuild >/dev/null; do echo "waiting for another xcodebuild…"; sleep 15; done
  (cd "$IOS" && xcodegen generate -q)
  xcodebuild -project "$IOS/Wordocious.xcodeproj" -scheme Wordocious -configuration Debug \
    -destination "id=$UDID" build -quiet
fi
APP="${APP:-$(xcodebuild -project "$IOS/Wordocious.xcodeproj" -scheme Wordocious -configuration Debug \
  -destination "id=$UDID" -showBuildSettings 2>/dev/null | awk -F' = ' '/ TARGET_BUILD_DIR /{d=$2} / WRAPPER_NAME /{w=$2} END{print d"/"w}')}"
[ -d "$APP" ] || { echo "no app at $APP"; exit 1; }

xcrun simctl boot "$UDID" 2>/dev/null || true
xcrun simctl bootstatus "$UDID" -b >/dev/null
xcrun simctl ui "$UDID" appearance light
xcrun simctl status_bar "$UDID" override --time 9:41 --dataNetwork wifi --wifiMode active --wifiBars 3 \
  --cellularMode active --cellularBars 4 --operatorName "" --batteryState charged --batteryLevel 100

for shot in $SHOTS; do
  i=$(echo $ALL | tr " " "\n" | grep -nx "$shot" | cut -d: -f1)
  # Fresh container every shot: the demo world is the only state the app sees.
  xcrun simctl terminate "$UDID" "$BUNDLE" 2>/dev/null || true
  xcrun simctl uninstall "$UDID" "$BUNDLE" 2>/dev/null || true
  xcrun simctl install "$UDID" "$APP"
  rm -f "$LOG/$shot.requests"
  xcrun simctl launch --terminate-running-process --stdout="$LOG/$shot.log" --stderr="$LOG/$shot.err" \
    "$UDID" "$BUNDLE" -storeDemo -storeShot "$shot" -storeLog "$LOG/$shot.requests" ${EXTRA_ARGS:-} >/dev/null
  sleep "$(settle "$shot")"
  f="$OUT/sim-$(printf %02d $i)-$shot.png"
  xcrun simctl io "$UDID" screenshot --type=png "$f" >/dev/null 2>&1
  echo "$shot -> $f ($(sips -g pixelWidth -g pixelHeight "$f" | awk '/pixel/{printf $2" "}'))"
done
xcrun simctl terminate "$UDID" "$BUNDLE" 2>/dev/null || true

[ -n "${KEEP_BOOTED:-}" ] || { xcrun simctl status_bar "$UDID" clear; xcrun simctl shutdown "$UDID"; }
[ -n "${NO_COMPOSE:-}" ] || python3 "$HERE/store-compose.py"
