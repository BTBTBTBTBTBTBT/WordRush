# 2026-07-30 — Inverted-filter sweep (7 agents)

The morning audit's verifier was told to "default to REFUTED when uncertain" and
that "a missed one costs little." This sweep ran the opposite instruction —
**report when uncertain** — across seven areas, four of which had never been
audited at all.

Findings are recorded here whether fixed, deferred or rejected, per
[README.md](README.md). Where two agents found the same defect independently it
is marked **[corroborated]** — that is the signal worth trusting most.

## Fixed and shipped today

| Finding | Where | Ratio / impact | Commit |
|---|---|---|---|
| iOS unrevealed board tiles: fixed `Color.white` under themed ink | `BoardView.swift` | **1.15:1** — typed letters INVISIBLE in Dark, every single-board mode, live in 1.1 | `d0c2b9b` |
| ProperNoundle carries its own keyboard copy; the keyInk fix never reached it | `ProperNoundleView.swift` | **1.08:1** — blank board AND blank keyboard in Dark | `d0c2b9b` |
| Rejection toast: fixed white on themed fill | both natives | **1.06:1** — "Not in word list" was a blank pill | `d0c2b9b` |
| Sweep celebration + Gauntlet "Completed Today": themed text on FIXED pastel | both natives | **~1.05:1** — the full-sweep screen rendered its three headline stats and all nine mode names blank | `d0c2b9b` |
| Help → How to Play: 12 white tiles with themed ink | both natives | 1.09:1 | `d0c2b9b` |
| `GauntletViews` `fontSize = 10f` into 9–10dp rows **[corroborated]** | Android | OctoWord stage letters clipped | `d0c2b9b` |
| Single-board font floor `coerceIn(14f, 28f)` | Android | long ProperNoundle answers (catalog runs to 29 letters) clipped | `d0c2b9b` |
| Sweep celebration label had no `weight` | Android | the win/loss ✓ was measured to ZERO WIDTH and never drawn | `d0c2b9b` |
| VS confetti hardcoded to a 360dp screen | Android | right side of every modern phone bare | `d0c2b9b` |
| VS surfaces never got the status-bar inset | Android | in-match home/title/clock under the system bar — the tester's bug, unfixed in VS | `d0c2b9b` |
| Leaderboard rank chip was `size(20.dp)` — a SQUARE | Android | **wrong data**: rank 425 displayed as "42" | `05e6461`→`b85c3f0` era |
| Four overlays bypass the Scaffold, no top inset | Android | Done/Close/Save under the clock, often untappable — includes the paywall | same |
| Sign-in error: themed ink on fixed `#FEE2E2` | Android | 2.26:1 — a mistyped password gave an unreadable reason | same |
| Web loss screen: fixed `#fef2f2` panel, themed ink | web | **1.05:1** — the word you missed, invisible | `037edd7` |
| Web header shield pill | web | 1.46:1 on every screen | `037edd7` |
| Account deletion never touched Storage | web | avatar stayed public at a guessable URL, contradicting the stated policy | `05e6461` |
| `USE_BIOMETRIC` / `USE_FINGERPRINT` unused, deprecated | Android | listed permissions, review risk | `05e6461` |
| **Stripe claimed the webhook event BEFORE the write** | web | charged, delivered nothing, no retry, silent | `b85c3f0` |
| Colourblind palette INVERTED vs the app's own keyboard | Android | orange meant "present" on the board and "correct" on the keys | `b85c3f0` |
| `Dp.value` emitted as `.sp` (introduced same day) | Android | glyph doubled at 2× text size inside an unscaled tile | `b85c3f0` |

## Open — needs a decision, not a patch

- **Gauntlet VS tug-of-war resets every stage.** Android recomputes "boards
  solved" from `state.boards`, which `NextStage` swaps out; iOS keeps a
  cumulative counter. Your lead collapses each stage you win.
- **No background-grace hook on Android VS.** After 60s away the board looks
  live but the match is resolved, and leaving shows a forfeit warning for a
  match already lost.
- **iOS `Brand.font` ignores Dynamic Type entirely** — no `UIFontMetrics`
  anywhere, ~1,000 call sites. Larger Text does nothing in a shipped App Store
  app. Fixing it will surface ~50 `.lineLimit(1)` sites at once; budget for both.
- **Web multi-board is unplayable with a screen reader** — no `role`, no
  `aria-label` on mini tiles or quadrant keys. Both natives do this correctly;
  the logic is portable.
- **Web has no focus styling at all** (`grep focus globals.css` → nothing) and
  the game keydown handlers are ungated on event target, so typing a username
  into the welcome modal also types onto the board.
- **No username profanity filter at any layer** — length-only on client, web and
  DB — with usernames on every public leaderboard. Play UGC-policy exposure.
- **No ad-consent withdrawal path** (UMP requires a persistent entry point);
  both natives. The in-app policy promises a choice users cannot revisit.
- **Web privacy policy says "Google AdSense" and "browser type."** The Android
  app uses AdMob and the Advertising ID, plus FCM tokens and Sentry — none
  disclosed. A truthful Data safety form will contradict the policy URL.

## Rejected / deliberately not changed

- **Keyboard key WIDTH below the 44pt minimum on all three.** A 10-key QWERTY
  row cannot be 44pt wide on a phone; the system keyboards ship the same
  geometry, and the 48–52 height carries the target. Not a defect.
- **Socket server has no `is_pro` backstop.** Real, but it needs a design
  decision about how the server learns entitlement — not a quick gate.
- **AdMob close-button contrast.** Google renders it; there is no API to restyle
  it. The only lever would be dropping interstitials entirely.

## Method note

Seven agents, disjoint scopes, instructed to report when uncertain and to cite
file:line on both platforms. Contrast ratios were computed, not eyeballed. The
sweep was source review only — nothing here was observed under VoiceOver,
TalkBack, or on a physical device, so screen-reader severities are inferred from
markup. Two agents independently flagging `GauntletViews.kt:370` is the strongest
single signal in the set.
