# App Store screenshots

Founder-taken iPhone screenshots (1290×2796, iPhone 15 Pro Max) become captioned store frames for the two required slots:
6.7-inch (`APP_IPHONE_67`, 1320×2868) and 6.5-inch (`APP_IPHONE_65`, 1284×2778).

1. Drop the phone PNGs in a `store-src/` folder next to `store-compose.py`; edit the `SHOTS` table (file, name, headline, subline) — the order is the store order.
2. `python3 store-compose.py` → `store-out/67/*.png` and `store-out/65/*.png` (Nunito Black headline in the brand purple→pink, muted subline, phone shot with rounded corners on the app's lavender ground).
3. `VER=2.3 ruby asc-shots-list.rb` shows the version's sets; `VER=2.3 ruby asc-shots-upload.rb` deletes the old shots and uploads + orders the new ones (ASC API key C8FRS9T697, .p8 read from disk).
   A version that already sits in a review submission refuses screenshot edits ("Ready For Review"): `ruby asc-unpark.rb` empties the open submission first; the submit script re-adds it.
4. Submit with the session's `asc-submit-*.rb` (VER/BUILD env; creates the version if missing, attaches the VALID build, sets What's New, submits with automatic release).

First used 2026-09-28 for 2.3 (204); bible §313.

## App Store Connect metadata scripts (same key; .p8 read from disk, never printed)

- `ruby asc-versions.rb` — every App Store version and its state.
- `VER=2.3 BUILD=204 DRY=1 ruby asc-submit.rb` — create the version if missing (AFTER_APPROVAL), wait for the build to be VALID, attach it, set What's New (edit `WHATS_NEW` in the file), add to a review submission; drop `DRY=1` to submit.
- `BUILD=205 ruby asc-swap.rb` — swap a newer build into a pending review (cancel submission → attach → resubmit); may need a ~25 s retry.
- `SUBTITLE="Daily Word Games" ruby asc-subtitle.rb` — set the en-US subtitle. There are two `appInfos`: the live one (locked) and the pending version's (editable even while WAITING_FOR_REVIEW — confirmed 2026-09-28); `DRY=1` reads back. Same `appInfoLocalizations` PATCH works for `privacyPolicyUrl`; description, keywords, promotional text and support URL live on `appStoreVersionLocalizations` of the pending version (PATCH `description`, `keywords`, `promotionalText`, `supportUrl`, `marketingUrl`).

## Listing copy and the Play feature graphic (2026-09-28, bible §316)

- `listing-copy.py` holds the approved text: iOS promotional text (170 max), keywords (100 max), Play short description (80 max), and the shared description body with the Apple or Google billing block (`IOS_DESC`, `PLAY_DESC`). `python3 listing-copy.py` prints each length against its limit. Play's short/full description went live through Play Console on 2026-09-28; the iOS description and keywords ride the next version (2.4), and the iOS promotional text is still to be set (editable on the live version without review).
- `python3 play-feature-graphic.py` → `feature-graphic.png` (1024×500, same lavender ground and purple→pink wordmark as the screenshots). Play screenshots must stay within a 2:1 aspect ratio, so the iPhone frames (≈2.17:1) cannot be reused there as-is.
- Counts in store copy ("Eight daily word games", "ten More Games") are typed by hand: re-audit them whenever `packages/core/modes.json` changes.

## Simulator pipeline + demo mode (2026-10-03)

Store frames can be shot from the iOS Simulator instead of the founder's phone, from the FINAL build right before submission.

- `./capture-sim.sh` builds DEBUG, boots the iPhone 17 Pro Max sim headless (`UDID` env to override; native 1320×2868, Simulator.app never opens), sets the 9:41 / full-battery status bar, then per shot does a fresh uninstall + install + launch with `-storeDemo -storeShot <name>`, waits for it to settle and saves `store-src/sim-NN-<name>.png`. It then runs `store-compose.py` (default `SET=sim`; `SET=phone` for the old founder-shot table) → `store-out/67` + `store-out/65`. Slot 10 reuses `docs/store/screenshots-2.7/10-widgets-*.png`.
  Env: `SKIP_BUILD=1`, `SHOTS="stats leaderboard"`, `KEEP_BOOTED=1`, `NO_COMPOSE=1`. Per-shot app logs land in `$TMPDIR/store-demo-logs/` (each canned request is a `STOREDEMO|` line, handy for spotting an empty screen's missing table).
- Shots: `home classic octo finish stats leaderboard friends vs mascot` (driver: `StoreDemoDriver` in `apps/ios/Wordocious/Sources/StoreDemo.swift`; it reuses the perf harness routes: tab selection, the play-unlimited note, hardware keys, the PerfTourHost sheets).
- **Demo mode** (`-storeDemo`, `#if DEBUG` only, compiled out of Release): the app is signed in as the sample player WordWiz (wizard-hat mascot from the real builder parts, 47-day streak, Pro) through an in-memory auth session (never the keychain). `StoreDemoURLProtocol` answers EVERY request on Net.api / Net.upload / URLSession.shared from canned tables (profiles, leaderboard rows, /api/friends, the Moments feed); writes get a local 204 and never leave the device, and the VS / presence sockets are off. Only plain static GETs (art / content JSON, not Supabase, not /api/) pass through. Nothing is recorded and no real account is touched; every shot starts from a fresh install.
- Edit the cast, numbers and captions in `StoreDemo.swift` (`StoreDemo.people`, `StoreDemoData`) and `store-compose.py` (`SHOTS_SIM`). Never upload until every composed frame has been looked at.
