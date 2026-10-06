#!/usr/bin/env bash
# FINISH_SPEC BJ3 — the Android perf tour (docs/PERF_HARNESS.md).
#
# Plays the installed app through the same surfaces as the iOS `-perfTour` (Home
# scroll, tabs, Leaderboard, Friends, Settings, Help, Strategy, Words, Classic /
# QuadWord / OctoWord / Gauntlet typing, Hubbub, Sudocious, Muddle, Crossword) with
# real adb input (swipes, taps resolved by text via uiautomator, hardware-key typing),
# and measures EACH step with `dumpsys gfxinfo` (reset before, read after): frames,
# janky %, p90 / p99 frame time and the frames over 25 / 50 ms from the histogram.
#
#   ./scripts/android-perf-tour.sh                  # whatever build is installed
#   ./scripts/android-perf-tour.sh --label before   # names the report
#   ONLY="home,classic" ./scripts/android-perf-tour.sh
#
# Measure an optimized build: `./gradlew :app:installBenchmarkRelease` (the
# baseline-profile plugin's release-like, debug-signed variant). A debug build's
# Compose runs interpreted and its numbers mean little.
#
# Emulator: AVD "wordo" (android-35):
#   ~/Library/Android/sdk/emulator/emulator -avd wordo -no-window -no-audio -no-boot-anim -gpu host &
# (-gpu host matters: headless defaults to SwiftShader, where every frame takes 200-300 ms.)
# Game rows: <game>.open (the widget deep link) and <game>.close (BACK) are measured too.
# The tour plays as a guest; dailies opened via the widget deep link stay on-device.
# Report: apps/android/build/perf/perf-tour-<label>.md

set -uo pipefail

PKG="com.wordocious.app"
ADB="${ADB:-$HOME/Library/Android/sdk/platform-tools/adb}"
[ -x "$ADB" ] || ADB=adb
SERIAL="${ANDROID_SERIAL:-}"
[ -n "$SERIAL" ] && ADB="$ADB -s $SERIAL"
LABEL="$(date +%Y%m%d-%H%M%S)"
[ "${1:-}" = "--label" ] && LABEL="$2"
ONLY="${ONLY:-}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUTDIR="$ROOT/apps/android/build/perf"
mkdir -p "$OUTDIR"
OUT="$OUTDIR/perf-tour-$LABEL.md"

wanted() {
  [ -z "$ONLY" ] && return 0
  local p; for p in ${ONLY//,/ }; do [[ "$1" == "$p"* ]] && return 0; done
  return 1
}

dump() { $ADB shell uiautomator dump /sdcard/_ui.xml >/dev/null 2>&1; $ADB shell cat /sdcard/_ui.xml 2>/dev/null; }

# "x y" of the first node whose text or content-desc contains $1 (empty if absent).
find_xy() {
  local b; b=$(dump | tr '<' '\n' | grep -i -- "$1" | grep -o 'bounds="\[[0-9]*,[0-9]*\]\[[0-9]*,[0-9]*\]"' | head -1)
  [ -z "$b" ] && return 1
  local x1 y1 x2 y2; read -r x1 y1 x2 y2 <<< "$(echo "$b" | grep -o '[0-9]\+' | tr '\n' ' ')"
  echo "$(( (x1 + x2) / 2 )) $(( (y1 + y2) / 2 ))"
}

SIZE=$($ADB shell wm size | grep -o '[0-9]*x[0-9]*' | tail -1)
W=${SIZE%x*}; H=${SIZE#*x}
CX=$(( W / 2 ))

swipe_up()   { $ADB shell input swipe "$CX" $(( H * 3 / 4 )) "$CX" $(( H / 4 )) "${1:-220}"; }
swipe_down() { $ADB shell input swipe "$CX" $(( H / 4 )) "$CX" $(( H * 3 / 4 )) "${1:-220}"; }
type_word()  { local w="$1" i; for (( i=0; i<${#w}; i++ )); do $ADB shell input text "${w:$i:1}"; done; }
key()        { $ADB shell input keyevent "$@"; }

echo "| step | frames | janky % | p90 ms | p99 ms | >25ms | >50ms |" > "$OUT.rows"

# Measure: reset the counters, run the action, wait, read gfxinfo.
measure() {
  local name="$1" hold="$2"; shift 2
  wanted "$name" || return 0
  $ADB shell dumpsys gfxinfo "$PKG" reset >/dev/null
  "$@"
  sleep "$hold"
  local g; g=$($ADB shell dumpsys gfxinfo "$PKG")
  local frames janky p90 p99 o25 o50
  frames=$(echo "$g" | grep -m1 "Total frames rendered" | grep -o '[0-9]\+' | head -1)
  janky=$(echo "$g" | grep -m1 "Janky frames:" | grep -o '([0-9.]*%)' | tr -d '()%')
  p90=$(echo "$g" | grep -m1 "90th percentile" | grep -o '[0-9]\+ms' | tr -d ms)
  p99=$(echo "$g" | grep -m1 "99th percentile" | grep -o '[0-9]\+ms' | tr -d ms)
  local hist; hist=$(echo "$g" | grep -m1 "HISTOGRAM:" | sed 's/HISTOGRAM://')
  o25=0; o50=0
  for kv in $hist; do
    local ms=${kv%%ms=*} n=${kv##*=}
    [ "$ms" -gt 25 ] && o25=$(( o25 + n ))
    [ "$ms" -gt 50 ] && o50=$(( o50 + n ))
  done
  printf "| %s | %s | %s | %s | %s | %s | %s |\n" "$name" "${frames:-0}" "${janky:-0}" "${p90:-0}" "${p99:-0}" "$o25" "$o50" | tee -a "$OUT.rows"
}

tap_xy() { $ADB shell input tap "$1" "$2"; }

# Tap by text, measured (the uiautomator lookup happens before the counters reset).
measure_tap() {
  local name="$1" needle="$2" hold="$3"
  wanted "$name" || return 0
  local xy; xy=$(find_xy "$needle") || { echo "  !! $name: '$needle' not on screen"; return 0; }
  measure "$name" "$hold" tap_xy $xy
}

scroll_page() { swipe_up; sleep 0.4; swipe_up; sleep 0.4; swipe_up; sleep 0.6; swipe_down; sleep 0.4; swipe_down; sleep 0.4; swipe_down; }

open_daily() { $ADB shell am start -n "$PKG/.MainActivity" -d "wordocious://daily/$1" >/dev/null 2>&1; }
back() { key KEYCODE_BACK; }

echo "Wordocious Android perf tour -> $OUT"

# Cold start.
$ADB shell am force-stop "$PKG"
sleep 1
# PERF_EXTRAS: launch extras for an A/B run (e.g. PERF_EXTRAS="--ez noPuppets true": the static cast header).
measure "launch" 6 sh -c "$ADB shell am start -W -n $PKG/.MainActivity ${PERF_EXTRAS:-} | grep -E 'TotalTime' | sed 's/^/  /'"
if xy=$(find_xy "Play without an account"); then tap_xy $xy; sleep 3; fi

# Home.
measure "home.idle" 2 true
measure "home.scroll" 1 scroll_page

# Tabs.
measure_tap "tabs.toLeaderboard" "Leaderboard" 1.5
measure "leaderboard.scroll" 1 scroll_page
measure_tap "tabs.toFriends" "Friends" 1.5
measure "friends.scroll" 1 scroll_page
measure_tap "tabs.toHome" "Home" 1.5

# Sheets / pages.
measure_tap "settings.open" "Settings" 1.5
measure "settings.scroll" 1 scroll_page
measure "settings.close" 1.2 back
measure_tap "help.open" "Help" 1.5
if wanted strategy; then
  measure_tap "strategy.open" "Strategy" 1.5
  measure "strategy.scroll" 1 scroll_page
  back; sleep 1
fi
measure "help.close" 1.2 back
if wanted wotd; then
  if xy=$(find_xy "Help"); then tap_xy $xy; sleep 1.5; fi
  measure_tap "wotd.open" "Words" 1.5
  measure "wotd.scroll" 1 scroll_page
  back; sleep 1; back; sleep 1
fi

# Word games (today's dailies through the widget route; a guest never records).
word_game() {
  local p="$1" key="$2"
  wanted "$p" || return 0
  measure "$p.open" 3 open_daily "$key"
  measure "$p.type" 0.4 type_word CRANE
  measure "$p.submit" 2.2 key KEYCODE_ENTER
  measure "$p.type2" 0.4 type_word SLOTH
  measure "$p.submit2" 2.2 key KEYCODE_ENTER
  measure "$p.close" 1.5 back
}
word_game classic DUEL
word_game quad QUORDLE
word_game octo OCTORDLE
word_game gauntlet GAUNTLET

# Puzzles.
if wanted hubbub; then
  measure "hubbub.open" 3 open_daily HUB
  measure "hubbub.taps" 1 sh -c "for c in E T A O I N S R H L; do $ADB shell input text \$c; done; $ADB shell input keyevent KEYCODE_ENTER; $ADB shell input keyevent KEYCODE_SPACE"
  measure "hubbub.close" 1.5 back
fi
if wanted sudocious; then
  measure "sudocious.open" 3 open_daily SUDOKU
  measure "sudocious.taps" 1 sh -c "for i in 1 2 3 4 5 6 7 8 9; do $ADB shell input keyevent KEYCODE_DPAD_RIGHT; $ADB shell input text \$i; done"
  measure "sudocious.close" 1.5 back
fi
if wanted muddle; then
  measure "muddle.open" 3 open_daily SCRAMBLE
  measure "muddle.type" 1 sh -c "$ADB shell input text S; $ADB shell input text T; $ADB shell input text A; $ADB shell input text R; $ADB shell input text E; $ADB shell input keyevent KEYCODE_ENTER"
  measure "muddle.close" 1.5 back
fi
if wanted crossword; then
  measure "crossword.open" 3 open_daily CROSSWORD
  measure "crossword.type" 1 type_word STARELINE
  measure "crossword.close" 1.5 back
fi

{
  echo "# Android perf tour $LABEL"
  echo
  echo "$($ADB shell getprop ro.product.model) · API $($ADB shell getprop ro.build.version.sdk) · $($ADB shell dumpsys package $PKG | grep -m1 versionName | xargs)"
  echo
  cat "$OUT.rows" | sed '1a\
|---|---:|---:|---:|---:|---:|---:|'
} > "$OUT"
rm -f "$OUT.rows"
echo "report: $OUT"
