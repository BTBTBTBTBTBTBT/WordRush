#!/bin/bash
# Canonical iOS ship pipeline: archive → upload dSYMs to Sentry → export →
# re-sign (stripped entitlements) → validate → upload to App Store Connect →
# poll for VALID. Build number is read from project.yml (bump it + run xcodegen
# first). Run: bash apps/ios/ship.sh
set -e
IOS="$(cd "$(dirname "$0")" && pwd)"
ID=E834629E4D8BE4C07579FAAEDDEFA363F437060B                     # signing identity (cert fingerprint; private key in Keychain)
KEY="--apiKey C8FRS9T697 --apiIssuer 8bdd3f73-0d8b-427d-95c7-8097b77dfb7a"
KEY_ID=C8FRS9T697; ISSUER=8bdd3f73-0d8b-427d-95c7-8097b77dfb7a
P8="$HOME/.appstoreconnect/private_keys/AuthKey_$KEY_ID.p8"
EXPECTED_TEAM_NAME="Showloud, LLC"   # what Apple names team Q32F6GRDYG post-conversion
# The two App Store profiles the export signs with (ExportOptions.plist names
# the same two). Both API-created, both decode to TeamName "Showloud, LLC".
LLC_PROFILES=("Wordocious AppStore w/ groups" "Wordocious Widgets App Store LLC")
[ -f "$P8" ] || { echo "Missing App Store Connect API key: $P8" >&2; exit 1; }
BUILD="$(grep -m1 'CURRENT_PROJECT_VERSION:' "$IOS/project.yml" | sed -E 's/.*"([0-9]+)".*/\1/')"
MARKETING="$(grep -m1 'MARKETING_VERSION:' "$IOS/project.yml" | sed -E 's/.*"([0-9.]+)".*/\1/')"
echo "== BUILD $MARKETING ($BUILD) =="
cd "$IOS"
rm -rf build/Wordocious.xcarchive build/export build/resign

# §256: install the LLC profiles fresh from App Store Connect, by NAME, every
# run. Apple's Individual→Organization conversion kept team Q32F6GRDYG but never
# rewrites existing profiles — TeamName is frozen at generation — and the old
# Xcode-managed widget profile ("Wordocious Widgets AppStore") still embedded
# "BRIAN MAXWELL TERCHIN" in every shipped IPA through 1.25 (170). Deleting the
# cached copies does nothing; Xcode re-fetches them by name. Fetching OUR named
# profiles from the API each run means a cleared cache or a fresh Mac can never
# reintroduce a stale one. Mirrors ShowLoud's ios/scripts/ship.sh step 1b.
echo "== INSTALL LLC PROFILES =="
ruby - "$P8" "$KEY_ID" "$ISSUER" "$HOME/Library/MobileDevice/Provisioning Profiles" "${LLC_PROFILES[@]}" <<'RUBY'
require "jwt"; require "json"; require "net/http"; require "openssl"; require "base64"; require "fileutils"
p8, kid, iss, dest, *names = ARGV
tok = JWT.encode({ iss: iss, exp: Time.now.to_i + 1200, aud: "appstoreconnect-v1" },
                 OpenSSL::PKey::EC.new(File.read(p8)), "ES256", { kid: kid, typ: "JWT" })
FileUtils.mkdir_p(dest)
names.each do |name|
  uri = URI("https://api.appstoreconnect.apple.com/v1/profiles?filter[name]=#{URI.encode_www_form_component(name)}&limit=1")
  r = Net::HTTP::Get.new(uri); r["Authorization"] = "Bearer #{tok}"
  d = JSON.parse(Net::HTTP.start(uri.host, uri.port, use_ssl: true) { |h| h.request(r) }.body)
  p = (d["data"] || []).first or abort("  profile not found on ASC: #{name}")
  a = p["attributes"]
  abort("  profile #{name} is #{a["profileState"]}, not ACTIVE") unless a["profileState"] == "ACTIVE"
  File.binwrite(File.join(dest, "#{a["uuid"]}.mobileprovision"), Base64.decode64(a["profileContent"]))
  puts "  installed #{name} (#{a["uuid"]})"
end
RUBY

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
  -exportOptionsPlist "$IOS/ExportOptions.plist" -allowProvisioningUpdates \
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

# §256 TEAM NAME tripwire — on the payload that actually ships (re-signing
# with codesign leaves embedded.mobileprovision exactly as export wrote it).
# Covers the app AND every embedded extension. A profile's TeamName is frozen
# at generation; refuse to upload anything still carrying the individual name.
echo "== TEAM NAME CHECK (IPA) =="
for bundle in "$APP" "$APP"/PlugIns/*.appex; do
  [ -d "$bundle" ] || continue
  if ! security cms -D -i "$bundle/embedded.mobileprovision" > ipaprof.plist 2>/dev/null; then
    echo "  no embedded profile in $(basename "$bundle") — aborting" >&2; exit 1
  fi
  tn="$(/usr/libexec/PlistBuddy -c 'Print :TeamName' ipaprof.plist 2>/dev/null || true)"
  pn="$(/usr/libexec/PlistBuddy -c 'Print :Name' ipaprof.plist 2>/dev/null || true)"
  echo "  $(basename "$bundle"): $pn  (TeamName: $tn)"
  if [ "$tn" != "$EXPECTED_TEAM_NAME" ]; then
    echo "  WRONG TEAM NAME in $(basename "$bundle") (expected '$EXPECTED_TEAM_NAME') — aborting before upload" >&2
    exit 1
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
  # §249 postmortem: a stale build with the SAME number on an older version
  # train once satisfied a bare-number grep instantly — match version+build.
  OUT=$(ruby ~/.appstoreconnect/asc_builds.rb 2>/dev/null | grep -m1 "v$MARKETING ($BUILD)" || true)
  echo "[$i] $OUT"
  case "$OUT" in *VALID*) echo DONE_VALID; exit 0;; *INVALID*|*FAILED*) echo DONE_BAD; exit 1;; esac
done
echo TIMEOUT; exit 1
