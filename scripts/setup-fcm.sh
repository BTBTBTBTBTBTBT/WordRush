#!/bin/bash
# Wire up Android push: mint an FCM service-account key and install it as
# FCM_SERVICE_ACCOUNT in Vercel (production).
#
#   ./scripts/setup-fcm.sh
#
# Prereqs: gcloud authed (`gcloud auth login`) on an account with IAM rights on
# spellstrike-490819, and the Vercel CLI authed with access to the wordocious
# project.
#
# Secret hygiene, deliberately: the key JSON is written ONLY to
# ~/.android-keys/fcm-service-account.json (0600, outside the repo, same home
# as the Play publisher key) and piped straight into Vercel env via stdin.
# It is never printed, never committed, never pasted anywhere.
#
# After this runs, redeploy the web app (any push to main) so the env var takes
# effect — then the admin Messaging page flips FCM to "configured", and Android
# devices running build 44+ start receiving the daily reminder as they register.
set -euo pipefail

GCLOUD=/opt/homebrew/share/google-cloud-sdk/bin/gcloud
PROJECT=spellstrike-490819
KEY_FILE="$HOME/.android-keys/fcm-service-account.json"
REPO="$(cd "$(dirname "$0")/.." && pwd)"

command -v "$GCLOUD" >/dev/null || GCLOUD=gcloud
"$GCLOUD" auth list --filter=status:ACTIVE --format='value(account)' | grep -q . || {
  echo "gcloud is not authenticated. Run: $GCLOUD auth login" >&2; exit 1; }

echo "→ Enabling the FCM API (no-op if already enabled)…"
"$GCLOUD" services enable fcm.googleapis.com --project "$PROJECT"

# The Firebase Admin SDK service account ships with every Firebase project and
# already holds messaging rights — use it rather than minting a new identity.
SA=$("$GCLOUD" iam service-accounts list --project "$PROJECT" \
  --filter='email:firebase-adminsdk' --format='value(email)' | head -1)
if [ -z "$SA" ]; then
  echo "No firebase-adminsdk service account found in $PROJECT." >&2
  echo "Open Firebase console → Project settings → Service accounts once (it is created lazily), then re-run." >&2
  exit 1
fi
echo "→ Using service account: $SA"

if [ -f "$KEY_FILE" ]; then
  echo "→ Key already exists at $KEY_FILE — reusing (delete it to mint a fresh one)."
else
  mkdir -p "$(dirname "$KEY_FILE")"
  "$GCLOUD" iam service-accounts keys create "$KEY_FILE" \
    --iam-account "$SA" --project "$PROJECT"
  chmod 600 "$KEY_FILE"
  echo "→ Key written to $KEY_FILE (0600)."
fi

python3 - "$KEY_FILE" <<'PY'
import json, sys
d = json.load(open(sys.argv[1]))
missing = [k for k in ('client_email', 'private_key', 'project_id') if not d.get(k)]
assert not missing, f"key file missing fields: {missing}"
assert d['project_id'] == 'spellstrike-490819', f"key is for {d['project_id']}, not spellstrike-490819 — FCM tokens will not match"
print(f"→ Key validated: {d['client_email']}")
PY

echo "→ Installing FCM_SERVICE_ACCOUNT into Vercel (production)…"
cd "$REPO/apps/web"
# Replace any stale value, then add from stdin — the secret never hits argv or a terminal.
vercel env rm FCM_SERVICE_ACCOUNT production --yes 2>/dev/null || true
vercel env add FCM_SERVICE_ACCOUNT production < "$KEY_FILE"

echo
echo "Done. Redeploy the web app (push to main) for the env to take effect,"
echo "then check /admin/messaging — FCM should read 'configured'."
