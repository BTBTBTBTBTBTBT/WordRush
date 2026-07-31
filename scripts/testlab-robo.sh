#!/bin/bash
# Firebase Test Lab Robo crawl — free-tier device-matrix smoke test.
#
#   ./scripts/testlab-robo.sh                # crawl the current release AAB
#   ./scripts/testlab-robo.sh path/to.aab    # crawl a specific bundle
#
# Robo needs NO test code: it installs the app on real + virtual devices in
# Google's lab, crawls every screen it can reach, and reports crashes, ANRs,
# screenshots, and a video per device. This is the cheap answer to the
# device-specific bug class (OEM skins, API-level differences) — parity bugs
# are caught by fixtures and humans, not this.
#
# Free (Spark) daily quota: 5 physical + 10 virtual device tests per day.
# The matrix below spends 3 physical + 2 virtual, so it can run twice a day.
# List available devices:  gcloud firebase test android models list
#
# One-time setup: gcloud auth login && gcloud config set project spellstrike-490819
# First run may ask to enable cloudtestservice + toolresults APIs — say yes.
#
# Note: Robo plays signed-out ("Play without an account") — it cannot pass
# Google sign-in. That still covers launch, home, boards, menus, and settings.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
AAB="${1:-$REPO/apps/android/app/build/outputs/bundle/release/app-release.aab}"
PROJECT="spellstrike-490819"

if [ ! -f "$AAB" ]; then
  echo "No bundle at $AAB — build one with: cd apps/android && ./gradlew bundleRelease" >&2
  exit 1
fi

# Matrix: real Samsung hardware (One UI — the fork no emulator can run),
# a real Pixel, and virtual devices for API spread. Models drift in and out of
# the catalog; if one is rejected, swap it from `models list`.
exec gcloud firebase test android run \
  --project "$PROJECT" \
  --type robo \
  --app "$AAB" \
  --timeout 8m \
  --device model=e3q,version=34 \
  --device model=a35x,version=34 \
  --device model=shiba,version=34 \
  --device model=MediumPhone.arm,version=33 \
  --device model=SmallPhone.arm,version=30
