# 2026-07-30 — the rendered pass, finally run (Android, API 36)

The step every audit this week was missing. Two source-reading audits and a
findings file all ended with the same standing conclusion — *verify on API 35+,
because API 34 cannot reproduce edge-to-edge enforcement* — and then nobody ran
it. `scripts/android-screens.sh` was written the same afternoon and left
unexecuted; `/tmp/wordocious-screens` was empty until now.

## Setup

| | |
|---|---|
| Device | emulator `Wordocious_A16`, **API 36 / Android 16** |
| Build | `app-debug.apk` at commit `5cfa183` |
| Session | guest (not signed in) |
| Theme | light |
| Command | `ANDROID_SERIAL=emulator-5556 ./scripts/android-screens.sh light` |

10 screens captured: home, the three bottom tabs, five game modes, settings.

## What it confirmed

Every bug the first real tester found is fixed **as rendered**, not just as
reasoned about. This is the first evidence of that; every prior claim rested on
reading the diff.

| Tester's bug | Rendered result |
|---|---|
| Keyboard bottom row under the gesture bar | Fixed — full keyboard clears the bar (`03-mode-classic`) |
| Status bar over the corner Home/? buttons | Fixed — both buttons sit below the clock on every game screen |
| "ENTER" wrapped to "ENTE / R" | Fixed — one line |
| OctoWord letters clipped in half | Fixed — `SPINE` legible in all 8 boards at 13 rows (`03-mode-octoword`) |
| Locked boards "horrendous" (padlock + gray tint) | Fixed — Succession dims inactive boards and rings the active one in amber, no padlock (`03-mode-succession`) |

## What it did NOT cover — read this before trusting it

- **Light theme only.** The contrast bugs (`1.03–2.26:1`) were all *Dark*, and
  the script's dark pass needs the theme switched in-app first. **The dark sweep
  is still unrun** — the single largest remaining gap.
- **Guest session.** Every signed-in surface — profile with real stats, the
  invite panel, Pro badges, records with data — rendered empty. A populated
  account will lay out differently, and long usernames/ranks are exactly where
  the rank-chip clipping bug (`4990bc3`) came from.
- **No VS, no Gauntlet, no ProperNoundle.** VS needs a live opponent; the sweep
  walks single-player modes only. VS is where the status-bar inset was still
  unfixed as of `d0c2b9b`, so it is unverified rendered.
- **Emulator, not a device.** No notch/cutout, no OEM skin. Doug's S23 is the
  real check.
- **Static screenshots.** Nothing here exercises animation, scroll, or the
  keyboard-open state on a short screen.
- **Not compared against iOS.** The script's own closing line asks for that
  comparison and it has not been done — these are Android-only observations,
  so "matches iOS" is still an untested claim.

## Method note

The taps resolve by on-screen TEXT via uiautomator, never by coordinates —
earlier hand-driven attempts with hardcoded pixels repeatedly dropped the app to
the launcher and silently captured the wrong screen. That is why this is a
script and not a session of clicks.

Screenshots are not committed (≈3.5 MB); regenerate with the command above.
