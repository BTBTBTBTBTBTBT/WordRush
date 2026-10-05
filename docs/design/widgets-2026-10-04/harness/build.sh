#!/bin/bash
# Widget options render harness (design night 10-04).
# Compiles the SHIPPING widget source (WordociousWidget.swift, access control relaxed, @main dropped)
# + the shared Core files + the option views in Sources/ into a tiny simulator app with swiftc
# (no xcodebuild, no DerivedData), compiles the widget catalog + Extras.xcassets with actool,
# installs it on the booted simulator, renders every option to PNG @3x, then uninstalls it.
#   BUILD_DIR=/path/to/scratch OUT_DIR=/path/to/renders [ONLY=ring] ./build.sh
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
REPO=$(cd "$HERE/../../../.." && pwd)
B=${BUILD_DIR:?set BUILD_DIR to a scratch folder}
OUT=${OUT_DIR:?set OUT_DIR}
SIM=${SIM:-8E6293D6-C4AE-4F4A-9A8B-50FD7363009D}
APPID=com.wordocious.widgetoptions.harness
mkdir -p "$B/gen"
rm -rf "$B/Harness.app"; mkdir -p "$B/Harness.app"

[ -d "$B/Extras.xcassets" ] || python3 "$HERE/extras.py" "$B"
perl -pe 's/\bprivate //g; s/^\@main\s*$//' "$REPO/apps/ios/WordociousWidget/Sources/WordociousWidget.swift" > "$B/gen/WidgetSource.swift"

SDK=$(xcrun --sdk iphonesimulator --show-sdk-path)
xcrun actool --compile "$B/Harness.app" --platform iphonesimulator --minimum-deployment-target 17.0 \
  --target-device iphone --output-partial-info-plist "$B/partial.plist" \
  "$REPO/apps/ios/WordociousWidget/Assets.xcassets" "$B/Extras.xcassets" > "$B/actool.log"
xcrun -sdk iphonesimulator swiftc -swift-version 5 -parse-as-library -Onone \
  -target arm64-apple-ios17.0-simulator -sdk "$SDK" \
  -o "$B/Harness.app/Harness" \
  "$B/gen/WidgetSource.swift" "$REPO/apps/ios/Sources/Core/HomeBanner.swift" "$REPO/apps/ios/Sources/Core/WidgetStats.swift" \
  "$HERE"/Sources/*.swift
cp "$REPO/apps/ios/Wordocious/Resources/Nunito.ttf" "$B/Harness.app/"
cat > "$B/Harness.app/Info.plist" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleIdentifier</key><string>$APPID</string>
<key>CFBundleExecutable</key><string>Harness</string>
<key>CFBundleName</key><string>Harness</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleShortVersionString</key><string>1.0</string>
<key>CFBundleVersion</key><string>1</string>
<key>MinimumOSVersion</key><string>17.0</string>
<key>UIDeviceFamily</key><array><integer>1</integer></array>
<key>UIAppFonts</key><array><string>Nunito.ttf</string></array>
<key>UILaunchScreen</key><dict/>
<key>UIApplicationSceneManifest</key><dict><key>UIApplicationSupportsMultipleScenes</key><false/></dict>
</dict></plist>
PL
codesign -s - --force "$B/Harness.app" >/dev/null 2>&1
rm -rf "$OUT"; mkdir -p "$OUT"
xcrun simctl install "$SIM" "$B/Harness.app"
SIMCTL_CHILD_OUT_DIR="$OUT" SIMCTL_CHILD_ONLY="${ONLY:-}" xcrun simctl launch --terminate-running-process "$SIM" "$APPID" >/dev/null
for i in $(seq 1 240); do
  [ -f "$OUT/manifest.json" ] && break
  sleep 1
done
xcrun simctl uninstall "$SIM" "$APPID" || true
ls "$OUT"/*.png | wc -l | xargs echo "pngs:"
