#!/usr/bin/env bash
# Walk the Android app and screenshot every surface, for eyeballing against iOS.
#
# WHY THIS EXISTS
# ---------------
# The 2026-07-30 parity audit read source and compared it. It found 258 real
# issues, and it was structurally blind to the ones a tester found in an hour:
# OctoWord letters clipped (a fixed font in a tile that shrinks), the dark
# keyboard unreadable (fixed key surface, themed ink), the system bars sitting
# on top of the UI (targetSdk 35 edge-to-edge on Android 15+). None of those are
# visible in a diff. All three are obvious in a screenshot.
#
# It also has to be REPEATABLE, or it happens once and rots. Hence a script
# rather than a session of hand-typed taps.
#
# Taps resolve by on-screen TEXT via uiautomator, never by pixel coordinates —
# hardcoded coordinates break on every layout change and silently tap the wrong
# thing (which, while writing this, repeatedly dropped the app to the launcher).
#
#   ./scripts/android-screens.sh                 # light theme
#   ./scripts/android-screens.sh dark            # after switching theme in-app
#   ./scripts/android-screens.sh light out-dir
#
# Verify on API 35+. On API 34 the edge-to-edge enforcement does not exist and
# a whole class of bug is invisible — that is exactly how it was missed.

set -uo pipefail

THEME="${1:-light}"
OUT="${2:-/tmp/wordocious-screens/$THEME}"
PKG="com.wordocious.app"
ADB="${ADB:-adb}"
SERIAL="${ANDROID_SERIAL:-}"
[ -n "$SERIAL" ] && ADB="$ADB -s $SERIAL"

mkdir -p "$OUT"
shot() { $ADB exec-out screencap -p > "$OUT/$1.png"; echo "  captured $1"; }

dump() { $ADB shell uiautomator dump /sdcard/_ui.xml >/dev/null 2>&1; $ADB shell cat /sdcard/_ui.xml 2>/dev/null; }

# Tap the centre of the first node whose text or content-desc contains $1.
# Returns non-zero when it isn't on screen, so a caller can skip rather than
# tap blindly into whatever happens to be at those pixels.
tap_text() {
  local needle="$1"
  local bounds
  bounds=$(dump | tr '<' '\n' | grep -i -- "$needle" | grep -o 'bounds="\[[0-9]*,[0-9]*\]\[[0-9]*,[0-9]*\]"' | head -1)
  [ -z "$bounds" ] && { echo "  !! '$needle' not on screen"; return 1; }
  local n; n=$(echo "$bounds" | grep -o '[0-9]\+')
  local x1 y1 x2 y2; read -r x1 y1 x2 y2 <<< "$(echo "$n" | tr '\n' ' ')"
  $ADB shell input tap $(( (x1 + x2) / 2 )) $(( (y1 + y2) / 2 ))
  sleep 3
  return 0
}

wait_for_app() {
  for _ in $(seq 1 20); do
    $ADB shell dumpsys window 2>/dev/null | grep -q "mCurrentFocus.*$PKG" && { sleep 2; return 0; }
    sleep 1
  done
  echo "!! app never took focus"; return 1
}

echo "Wordocious screen sweep — theme=$THEME -> $OUT"
$ADB shell am force-stop "$PKG"
$ADB shell am start -n "$PKG/.MainActivity" >/dev/null 2>&1
wait_for_app || exit 1
sleep 4

# Guest, if the auth screen is up. A signed-in device skips straight past.
tap_text "Play without an account" && sleep 3

shot "01-home"

# Bottom tabs.
for tab in Leaderboard Profile Records; do
  tap_text "$tab" && shot "02-tab-$(echo "$tab" | tr '[:upper:]' '[:lower:]')"
done
tap_text "Home" && sleep 2

# Game modes. Each opens, gets shot, then backs out.
for mode in Classic QuadWord OctoWord Succession Deliverance; do
  if tap_text "$mode"; then
    sleep 4
    shot "03-mode-$(echo "$mode" | tr '[:upper:]' '[:lower:]')"
    $ADB shell input keyevent KEYCODE_BACK; sleep 3
  fi
done

# Chrome that hangs off the header.
tap_text "Settings" && shot "04-settings" && $ADB shell input keyevent KEYCODE_BACK && sleep 2

echo
echo "Done. $(ls "$OUT" | wc -l | tr -d ' ') screenshots in $OUT"
echo "Compare against the same screens on the iOS simulator — that comparison is"
echo "the point, and it is the step the source-reading audit could not do."
