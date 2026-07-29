#!/bin/bash
# Canonical iOS ship pipeline: archive → upload dSYMs to Sentry → export →
# re-sign (stripped entitlements) → validate → upload to App Store Connect →
# poll for VALID. Build number is read from project.yml (bump it + run xcodegen
# first). Run: bash apps/ios/ship.sh
set -e
IOS="$(cd "$(dirname "$0")" && pwd)"
ID=E834629E4D8BE4C07579FAAEDDEFA363F437060B                     # signing identity (cert fingerprint; private key in Keychain)
KEY="--apiKey C8FRS9T697 --apiIssuer 8bdd3f73-0d8b-427d-95c7-8097b77dfb7a"
BUILD="$(grep -m1 'CURRENT_PROJECT_VERSION:' "$IOS/project.yml" | sed -E 's/.*"([0-9]+)".*/\1/')"
echo "== BUILD $BUILD =="
cd "$IOS"
rm -rf build/Wordocious.xcarchive build/export build/resign

echo "== ARCHIVE =="
xcodebuild -scheme Wordocious -destination 'generic/platform=iOS' -archivePath build/Wordocious.xcarchive archive CODE_SIGNING_ALLOWED=NO -quiet

# Upload dSYMs to Sentry so crash reports symbolicate. Non-fatal + auto-skips
# if sentry-cli / the auth token (~/.sentryclirc org token) isn't present.
if command -v sentry-cli >/dev/null 2>&1 && [ -f "$HOME/.sentryclirc" ]; then
  echo "== SENTRY dSYM UPLOAD =="
  sentry-cli debug-files upload --org showloud-llc --project wordocious-ios \
    build/Wordocious.xcarchive/dSYMs 2>&1 | tail -4 || echo "dSYM upload failed (non-fatal, continuing)"
else
  echo "== SENTRY dSYM UPLOAD SKIPPED (no sentry-cli / ~/.sentryclirc) =="
fi

echo "== EXPORT =="
xcodebuild -exportArchive -archivePath build/Wordocious.xcarchive -exportPath build/export \
  -exportOptionsPlist ~/.appstoreconnect/wr_export_manual.plist -allowProvisioningUpdates \
  -authenticationKeyID C8FRS9T697 -authenticationKeyIssuerID 8bdd3f73-0d8b-427d-95c7-8097b77dfb7a \
  -authenticationKeyPath ~/.appstoreconnect/private_keys/AuthKey_C8FRS9T697.p8 > /dev/null

echo "== RESIGN =="
W="$IOS/build/resign"; mkdir -p "$W"; cd "$W"
unzip -q "$IOS/build/export/Wordocious.ipa"
APP=Payload/Wordocious.app
APPEX="$(ls -d $APP/PlugIns/*.appex | head -1)"
codesign -d --entitlements :- --xml "$APP" > app_ent.plist
codesign -d --entitlements :- --xml "$APPEX" > widget_ent.plist
# The archive is built CODE_SIGNING_ALLOWED=NO, so export derives entitlements
# from the profile rather than carrying Wordocious.entitlements through — every
# entitlement the app needs must be re-stated HERE or it silently disappears
# from the shipped binary (build 134/135 lost applinks + push exactly this way).
# Keep this list in sync with Wordocious/Wordocious.entitlements.
for k in "com.apple.developer.applesignin" "com.apple.security.application-groups" \
         "com.apple.developer.associated-domains" "aps-environment"; do
  /usr/libexec/PlistBuddy -c "Delete :$k" app_ent.plist 2>/dev/null || true
done
/usr/libexec/PlistBuddy -c "Add :com.apple.developer.applesignin array" app_ent.plist
/usr/libexec/PlistBuddy -c "Add :com.apple.developer.applesignin:0 string Default" app_ent.plist
/usr/libexec/PlistBuddy -c "Add :com.apple.security.application-groups array" app_ent.plist
/usr/libexec/PlistBuddy -c "Add :com.apple.security.application-groups:0 string group.com.wordocious.app" app_ent.plist
/usr/libexec/PlistBuddy -c "Add :com.apple.developer.associated-domains array" app_ent.plist
/usr/libexec/PlistBuddy -c "Add :com.apple.developer.associated-domains:0 string applinks:wordocious.com" app_ent.plist
/usr/libexec/PlistBuddy -c "Add :aps-environment string production" app_ent.plist
/usr/libexec/PlistBuddy -c "Delete :com.apple.security.application-groups" widget_ent.plist 2>/dev/null || true
/usr/libexec/PlistBuddy -c "Add :com.apple.security.application-groups array" widget_ent.plist
/usr/libexec/PlistBuddy -c "Add :com.apple.security.application-groups:0 string group.com.wordocious.app" widget_ent.plist
if [ -d "$APP/Frameworks" ]; then for f in "$APP"/Frameworks/*; do codesign -f -s "$ID" --timestamp "$f"; done; fi
codesign -f -s "$ID" --timestamp --entitlements widget_ent.plist "$APPEX"
codesign -f -s "$ID" --timestamp --entitlements app_ent.plist "$APP"

# Fail LOUDLY if a required entitlement didn't survive signing. Apple happily
# accepts (and marks VALID) a build whose entitlements were silently dropped —
# the features just die on device. Check the binary, not the intent.
echo "== ENTITLEMENT CHECK =="
SIGNED_ENT="$(codesign -d --entitlements :- --xml "$APP" 2>/dev/null)"
for k in "com.apple.developer.associated-domains" "aps-environment" \
         "com.apple.developer.applesignin" "com.apple.security.application-groups"; do
  if echo "$SIGNED_ENT" | grep -q "$k"; then
    echo "  ok: $k"
  else
    echo "  MISSING: $k — aborting before upload"; exit 1
  fi
done

zip -qr Wordocious-resigned.ipa Payload

echo "== VALIDATE =="
xcrun altool --validate-app -f Wordocious-resigned.ipa -t ios $KEY 2>&1 | tail -2
echo "== UPLOAD =="
xcrun altool --upload-app -f Wordocious-resigned.ipa -t ios $KEY 2>&1 | tail -2

echo "== POLL =="
for i in $(seq 1 30); do
  sleep 60
  OUT=$(ruby ~/.appstoreconnect/asc_builds.rb 2>/dev/null | grep -m1 "$BUILD" || true)
  echo "[$i] $OUT"
  case "$OUT" in *VALID*) echo DONE_VALID; exit 0;; *INVALID*|*FAILED*) echo DONE_BAD; exit 1;; esac
done
echo TIMEOUT; exit 1
