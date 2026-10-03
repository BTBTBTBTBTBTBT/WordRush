#!/bin/bash
# FINISH_SPEC BJ3 — run the iOS perf tour (docs/PERF_HARNESS.md).
#
#   apps/ios/scripts/perf-tour.sh [--build] [--only home,games] [--loops N] [--label before]
#
# --build    xcodegen + an optimized `Perf` simulator build first (shared DerivedData;
#            the Perf configuration keeps its own intermediates, so Debug / Release
#            builds are never invalidated). Without it, the last Perf build is used.
# --only     comma-separated step-name prefixes (home, tabs, leaderboard, friends,
#            settings, help, popup, wotd, strategy, classic, quad, octo, gauntlet,
#            hubbub, sudocious, muddle, crossword, vs, pocket, launch)
# --loops    run the tour N times in one launch (one table per loop)
# --label    suffix for the copied report (default: a timestamp)
# --flag X   pass `-perfFlag X` (a DEBUG A/B switch a measurement reads; repeatable)
#
# Headless on the booted dev simulator (PERF_UDID picks one); never opens Simulator.app
# and never creates a device. The app exits itself cleanly after the report (no crash
# dialog). A signed-out install plays as a guest; a signed-in one stays signed in
# (games open as fresh Unlimited boards, so no daily is touched).
# Report: apps/ios/build/perf/perf-tour-<label>.md (+ the app's Documents/perf/).
set -euo pipefail
cd "$(dirname "$0")/.."

BUILD=0; ONLY=""; LOOPS=1; FLAGS=(); LABEL="$(date +%Y%m%d-%H%M%S)"
while [ $# -gt 0 ]; do
  case "$1" in
    --build) BUILD=1 ;;
    --only) ONLY="$2"; shift ;;
    --loops) LOOPS="$2"; shift ;;
    --label) LABEL="$2"; shift ;;
    --flag) FLAGS+=(-perfFlag "$2"); shift ;;
    *) echo "unknown option $1" >&2; exit 2 ;;
  esac
  shift
done

# One shared headless simulator (never create one, never open Simulator.app):
# PERF_UDID, else the first booted iPhone.
UDID="${PERF_UDID:-$(xcrun simctl list devices booted | grep -E 'iPhone' | head -1 | sed -E 's/.*\(([0-9A-F-]{36})\).*/\1/')}"
[ -n "$UDID" ] || { echo "no booted simulator — boot one headless: xcrun simctl boot <udid>" >&2; exit 1; }

if [ "$BUILD" = 1 ]; then
  xcodegen generate >/dev/null
  xcodebuild -project Wordocious.xcodeproj -scheme Wordocious -configuration Perf \
    -destination "id=$UDID" build -quiet
fi

APP="$(ls -d "$HOME"/Library/Developer/Xcode/DerivedData/Wordocious-*/Build/Products/Perf-iphonesimulator/Wordocious.app 2>/dev/null | head -1)"
[ -n "$APP" ] || { echo "no Perf build — run with --build" >&2; exit 1; }

xcrun simctl install "$UDID" "$APP"
ARGS=(-perfTour -perfTourLoops "$LOOPS")
[ -n "$ONLY" ] && ARGS+=(-perfTourOnly "$ONLY")
[ ${#FLAGS[@]} -gt 0 ] && ARGS+=("${FLAGS[@]}")

mkdir -p build/perf
LOG="build/perf/perf-tour-$LABEL.log"
# "AttributeGraph: cycle detected" lines while the tour runs (each forces extra
# layout passes; the count goes under the table).
AGLOG="build/perf/perf-tour-$LABEL.ag.log"
xcrun simctl spawn "$UDID" log stream --style compact --process Wordocious \
  --predicate 'eventMessage CONTAINS "cycle detected"' > "$AGLOG" 2>&1 &
AGPID=$!
# The app exits itself after writing the report, which it also writes straight to
# this host path (`-perfTourOut`): the simulator is shared, and another session may
# relaunch or reinstall the app (wiping its container) right after. Re-run the tour
# if it was cut off.
OUT="$PWD/build/perf/perf-tour-$LABEL.md"
ARGS+=(-perfTourOut "$OUT")
for attempt in 1 2 3; do
  rm -f "$OUT"
  xcrun simctl launch --terminate-running-process "$UDID" com.wordocious.app "${ARGS[@]}" > "$LOG" 2>&1 || true
  for t in $(seq 1 900); do
    [ -f "$OUT" ] && break
    if [ "$t" -gt 10 ]; then
      RUNNING="$(xcrun simctl spawn "$UDID" launchctl list 2>/dev/null || true)"
      case "$RUNNING" in *"UIKitApplication:com.wordocious.app"*) ;; *) break ;; esac
    fi
    sleep 1
  done
  [ -f "$OUT" ] && break
  echo "tour interrupted (attempt $attempt) — retrying" >&2
  [ "$attempt" = 3 ] && { echo "tour never finished; see $LOG" >&2; kill "$AGPID" 2>/dev/null; exit 1; }
done
sleep 1
kill "$AGPID" 2>/dev/null || true
printf '\nAttributeGraph cycles logged during the run: %s\n' "$(grep -c 'cycle detected' "$AGLOG" || true)" >> "build/perf/perf-tour-$LABEL.md"
cat "build/perf/perf-tour-$LABEL.md"
echo
echo "report: apps/ios/build/perf/perf-tour-$LABEL.md"
