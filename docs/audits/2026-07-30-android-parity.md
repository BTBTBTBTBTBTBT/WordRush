# 2026-07-30 — Android↔iOS parity

Two passes on the same day, with opposite methods and opposite results. Worth
reading together, because the second one only exists because the first one
missed things.

---

## Pass 1 — source-reading audit (morning)

**Scope.** 15 surfaces, one agent each: daily/solo game, multi-board modes,
Gauntlet, ProperNoundle, VS match + bot opponents, leaderboards, records,
profile (own + public + edit), settings, Pro/paywall/ads, help/guides/legal,
modals + onboarding + share, invites, app shell (header, nav, deep links).

**Method.** Each agent read Kotlin against Swift/TSX. Every finding was then
re-checked by an adversarial verifier.

**Verifier instructions, verbatim** (this is the part that matters):

> Mark REFUTED when:
> - the cited line does not say what the finding claims
> - the cited file/line does not exist
> - the difference is cosmetically invisible; SwiftUI Capsule and Compose
>   CircleShape on a wide box are the same stadium shape; **`.weight`/
>   `.fillMaxWidth` vs fixed frames can produce identical layouts**
> - the claim is about the platform's own conventions rather than the app
>
> Mark CONFIRMED only when you personally read both sides and the divergence is
> real and user-visible. **Default to REFUTED when uncertain. A false finding
> wastes the owner's time on a sim; a missed one costs little** because he is
> about to test it himself.

**Results.** 273 raw → 258 confirmed → 236 fixed. 52 high / 123 medium / 83 low;
121 behavioural, 137 visual+copy.

**The individual findings were not persisted.** This file exists so that never
happens again; the 22 confirmed-but-unfixed and the 15 refuted are lost as
detail and survive only as counts. See README.md.

**What this pass could not see, by construction.** It compared source and never
rendered a screen. Three bug classes were therefore structurally invisible to
it, and all three shipped:

1. **Geometry under real constraints.** `fontSize = 10f` on a mini tile matches
   web's `text-[10px]` and reads as correct. It is wrong only once OctoWord
   squeezes 13 rows into a small card and the cell becomes shorter than the
   glyph. iOS derives `min(width, height) * 0.5`
   (`BoardView.swift:72-85`) — a different approach with the same intent, which
   a reader comparing intent waves through.
2. **Colour pairings per theme.** Both platforms "set a text colour". The
   failure is the pairing: a hardcoded `#E8E5F0` key under themed near-white
   ink is 1.08:1 in Dark, against WCAG AA's 4.5.
3. **OS-version behaviour.** `targetSdk 35` forces edge-to-edge on Android 15+.
   Invisible in source, and invisible on the API 34 emulator every check ran on.

Note the collision: the verifier was explicitly told that fixed-vs-derived
sizing was a false-positive pattern. That is exactly bug class 1.

---

## Pass 2 — what a real tester found (afternoon)

First non-team install, a Galaxy S23 on Android 16. Found in about an hour:

| Symptom | Cause | Commit |
|---|---|---|
| Keyboard bottom row under the gesture bar; unusable | No `navigationBarsPadding`; ~20 screens shared it | `7538cc4` |
| Status bar over the corner Home/? buttons | Four game surfaces hand-rolled 48/52/56dp top padding | `059faf8` |
| OctoWord letters clipped in half | Fixed tile font vs iOS-derived | `596ec62` |
| Dark keyboard unreadable (all 3 platforms) | Fixed surface, themed ink — 1.08:1 | `059faf8`, `74ea817` |
| "ENTER" wrapped to "ENTE / R" | No `maxLines`/`softWrap`; key narrower than label | `059faf8` |
| **Succession unplayable past word one** | See below | `a27f026` |
| Locked boards "horrendous" | Padlock overlay + gray tint from web; iOS has neither | `a27f026` |

### The Succession bug is worth its own note

`state.currentBoardIndex` **is never advanced on any platform.** All three
reducers carried a `NEXT_BOARD` / `.nextBoard` / `NextBoard` action and *nothing
dispatched it* — not web, not iOS, not Android.

iOS never noticed because it derives the active board instead:

```swift
var sequenceActiveIndex: Int { state.boards.firstIndex { $0.status == .playing } ?? -1 }
```

Android's ViewModel derived it correctly for guess **routing** — `activeBoard()`,
whose own comment reads *"currentBoardIndex is never advanced"* — and then handed
the raw, permanently-zero field to the **UI**. So the guess landed on the right
board while the UI locked every board after index 0. Solve board 1 and it stops
accepting input; board 2 never unlocks; the mode ends after one word.

The dead action has been removed from all three reducers. A convincing dead
action is worse than no action: it looks like the mechanism, so the field it
writes gets trusted.

---

## Standing conclusions

- **Verify Android on API 35+.** API 34 cannot reproduce edge-to-edge
  enforcement, so every check on it is blind to a whole class.
- **A fixed background demands a fixed foreground**, and vice versa. Mixing a
  hardcoded surface with a themed ink is the contrast bug generator.
- **Where one platform derives a dimension and the other hardcodes it, treat it
  as a finding**, not a stylistic difference — even when the constant looks
  right. It is right until the container shrinks.
- **Trace call sites, not definitions.** `NEXT_BOARD` existed in three languages
  and ran in none.
- **A precision-tuned verifier trades away recall.** That trade is defensible
  when the author is about to eyeball the result himself, and wrong once builds
  reach a real tester. State the trade in the findings file so a later reader
  knows which way the filter leaned.
