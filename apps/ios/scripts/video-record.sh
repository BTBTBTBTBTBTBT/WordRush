#!/bin/bash
# JP-plan video harness (docs/design/brand/social/jp45/video): record ONE scripted scene from the iPhone simulator.
#   apps/ios/scripts/video-record.sh <out.mp4> <seconds> <scene args...>
#   e.g.  video-record.sh raw/octo.mp4 30 -videoScene game -videoGame OCTORDLE
# Uses the last Perf build (DerivedData). A fresh install each run (no saved boards), canned signed-in demo world
# (-storeDemo: nothing leaves the device), Unlimited boards only. Never opens Simulator.app; one simulator.
set -euo pipefail
UDID="${VIDEO_UDID:-07729CB2-19F9-4D2B-A8C8-2FAC3EC6E7DC}"
OUT="$1"; SECS="$2"; shift 2
APP="$(ls -d "$HOME"/Library/Developer/Xcode/DerivedData/Wordocious-*/Build/Products/Perf-iphonesimulator/Wordocious.app 2>/dev/null | head -1)"
[ -n "$APP" ] || { echo "no Perf build" >&2; exit 1; }
BUNDLE=$(/usr/libexec/PlistBuddy -c 'Print CFBundleIdentifier' "$APP/Info.plist")
xcrun simctl bootstatus "$UDID" -b >/dev/null 2>&1 || xcrun simctl boot "$UDID"
xcrun simctl status_bar "$UDID" override --time 9:41 --batteryState charged --batteryLevel 100 --cellularBars 4 --wifiBars 3 >/dev/null 2>&1 || true
xcrun simctl terminate "$UDID" "$BUNDLE" >/dev/null 2>&1 || true
xcrun simctl uninstall "$UDID" "$BUNDLE" >/dev/null 2>&1 || true
xcrun simctl install "$UDID" "$APP"
mkdir -p "$(dirname "$OUT")"; rm -f "$OUT"
xcrun simctl io "$UDID" recordVideo --codec h264 --force "$OUT" >/dev/null 2>&1 &
REC=$!
sleep 1.2
RS=$(python3 -c 'import time;print(f"{time.time():.3f}")')
rm -f "$OUT.mark" "$OUT.mark.end" "$OUT.len"
xcrun simctl launch "$UDID" "$BUNDLE" -storeDemo -pref-sound NO -pref-music NO -videoMark "$OUT.mark" "$@" >/dev/null
sleep "$SECS"
kill -INT $REC 2>/dev/null || true
wait $REC 2>/dev/null || true
xcrun simctl terminate "$UDID" "$BUNDLE" >/dev/null 2>&1 || true
# ss = seconds into the clip where the scene's first action starts (the scene writes its wall-clock start; the recorder's
# first frame is ~0.4 s after RS).
python3 - "$OUT" "$RS" <<'PY'
import sys, os
out, rs = sys.argv[1], float(sys.argv[2])
try:
    m = float(open(out + ".mark").read()); open(out + ".ss", "w").write("%.2f" % max(0, m - rs - 0.4))
    if os.path.exists(out + ".mark.end"):   # seconds of play (start mark -> end mark), for the editor's trim
        open(out + ".len", "w").write("%.2f" % (float(open(out + ".mark.end").read()) - m))
except Exception: open(out + ".ss", "w").write("0")
PY
echo "recorded $OUT (ss $(cat "$OUT.ss"))"
