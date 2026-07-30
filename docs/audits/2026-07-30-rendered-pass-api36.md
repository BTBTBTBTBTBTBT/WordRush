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

- ~~Light theme only.~~ **The dark sweep has since been run** — see below.
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


---

## Dark pass (same session, same device)

Theme flipped by writing `theme=dark` straight into `shared_prefs/
wordocious_prefs.xml` via `run-as`, then re-running the sweep — faster and more
repeatable than driving the settings UI.

**The dark keyboard fix holds**: light keys, dark ink, fully readable, and the
board tiles read correctly against the dark background.

**It also found two defects that light theme cannot expose, both outside the
app's own drawing** — which is why no amount of source review or light-theme
screenshotting would have caught them:

| Finding | Cause | Fix |
|---|---|---|
| Status bar clock/wifi/battery near-black on a near-black bar | Nothing ever set `isAppearanceLightStatusBars`. On API 35+ `android:statusBarColor` is deprecated **and ignored**, so icon colour comes only from that flag; unset, it defaults to dark icons | `a7f070a` |
| White strip behind the gesture pill, under a dark keyboard | `navigationBarsPadding()` was on the root `Surface`, so the Surface stopped at the bar and the light `windowBackground` showed through | `a7f070a` |

The second one is worth dwelling on: the code carried a comment claiming the
Surface "keeps painting WTheme.bg behind the bar, so the inset reads as
background rather than a dead strip." It did the exact opposite. A confident
comment asserting the behaviour it prevents is harder to catch by reading than
no comment at all — the same failure shape as the dead `NEXT_BOARD` action.

Both fixes were **verified by re-capture on the emulator**, not by reasoning:
dark icons → white icons, white strip → themed strip.

### Side-by-side against iOS (first one ever done)

Classic captured on both at the same state — Android API 36 emulator vs an
iPhone 17 Pro simulator. **Structurally identical**: circled Home and ? buttons
flanking a gradient title, the same guess/timer subhead, a 5x6 grid, and a
3-row keyboard with backspace left and ENTER right on the bottom row. The
remaining differences are device geometry (aspect ratio, corner radius), not
divergence.

One thing it surfaced, chased down, and **did not** turn out to be a bug: iOS
read `3248:46` where Android read `0:06`. The timer is not running while
backgrounded — `scenePhase` and `onDisappear` both call `pauseTimer()`, and the
game-start interstitial pauses it too. The sim had simply been foregrounded for
54 hours. The only real residue is cosmetic: the formatter is
`"\(s / 60):\(s % 60)"` with no roll into hours (`GameScreen.swift:387` and
four sibling copies), so an extremely long single session reads as minutes.
Low severity, logged rather than fixed.

Recording the non-finding deliberately: an audit file that lists only
confirmed bugs teaches the next reader nothing about what was checked and
cleared.

### Still open after the dark pass

- **Guest session only.** Every populated surface still unrendered.
- **No VS / Gauntlet / ProperNoundle** — VS needs a live opponent.
- **Emulator and simulator, not devices.** No notch, no OEM skin.
- **Only Classic compared side-by-side.** Home, the tabs, and the multi-board
  modes have Android captures but no iOS counterpart yet.
