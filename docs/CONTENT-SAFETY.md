# Content safety — how every word list stays clean, automatically

Every answer, required word, rung, accepted word, clue, caption and saying in every game passes through
one shared module and one gate. A new game (or a new batch of puzzles) never needs a manual sweep: register
its files, run `npm run content:check`, fix what it reports.

**Policy:** offensive words are never written in plain text, anywhere in the repo or in a report. Lists store
them base64-encoded and decode them at run time. Reports refer to a flagged item by game + date/index + a
masked form (first letter + asterisks, e.g. `B****`). The gate's own leak scan (G11) enforces this.

## The pieces

| Piece | Path | What it does |
|---|---|---|
| Filters | `packages/core/src/content-safety/safety.mjs` (+ `safety.d.mts` types) | `isOffensive` (exact words, hard roots inside words, leet spellings, phrases in clues — `offensiveWord` / `offensiveText`), `isBritishOnly` (spellings, vocabulary, idioms), `isObscure` (curated list, or wordfreq Zipf below the threshold), `mustAccept` / `isMustAccept` (everyday words), `zipf`, `mask`, `leaks`, and the generator helpers `wordProblems` / `textProblems`. Plain ESM, so the TypeScript tests and the `.mjs` generators share one copy. |
| Data | `packages/core/src/content-safety/data/` | `offensive.json` (base64), `british.json`, `obscure.json`, `must-accept.json`, `frequency.json`, `allow.json` (reasoned exceptions). Built by `scripts/build-content-safety-data.py` from the lists under `scripts/data` and `apps/web/scripts/data` — edit those, then rebuild. |
| Gate rules | `packages/core/src/content-safety/gate.mjs` | Which entries are still unseen, what each bank's words and texts are (`EXTRACT`), the G1/G2/G7 word and text rules (`itemProblems`), and `gateBank(bankId, bank)`, which every generator calls before writing a bank. |
| Registry | `packages/core/src/content-safety/registry.json` | Every bank, answer pool, accept list and clue file: games, kind (`answers`, `accept`, `clues`, `scramble`, `required-words`…), schema, the web path plus every iOS/Android/fixture copy, and `lengths` [min, max]. Also the folders to scan, the generator sources, and `notContent` (JSON files that hold no words, each with a reason). |
| Served snapshot | `packages/core/src/content-safety/served-snapshot.json` (+ `served.mjs`) | A hash of every entry already served (or bundled in a shipped store build) before `CONTENT_RELEASE_DATE`. Those entries are frozen. |
| The gate | `apps/web/scripts/content-check.test.ts` | The guards below, plus a readable report. |
| Sync | `apps/web/scripts/content-sync.mjs` | Copies each web file over its iOS/Android/fixture copies (byte-identical) and regenerates `lib/banks-manifest.json`. |

## Commands

```sh
npm run content:check      # root or apps/web — copies identical? then every guard, with a report (~4 s)
npm run content:sync       # after editing apps/web/data/*: copy to iOS / Android / fixtures + bank manifest
python3 scripts/build-content-safety-data.py   # after editing any word list (needs `pip install wordfreq`)
node apps/web/scripts/content-snapshot.mjs --ref=<live commit>   # ONLY when CONTENT_RELEASE_DATE moves: re-freezes what players saw
```

CI runs `content:check` as its own step (`.github/workflows/ci.yml`, "Content gate"), and the full web vitest
run includes it again. Any PR that adds a bad word, an unregistered bank, or a drifted platform copy goes red.

## The guards

Scope: what a player has **not** seen yet (dailies from `CONTENT_RELEASE_DATE`, the Unlimited pools, holiday
entries not yet served), the answer pools as dealt once every swap batch is live, and the accept lists.

| Guard | Checks |
|---|---|
| G1 | Nothing offensive in answers, required words, rungs, accepted words, accept lists or any text (clues with the blank filled, captions, alt text, sayings, labels, titles). |
| G2 | Nothing British-only in answers, required words, rungs, the Letter Ladder hint list or text. |
| G3 | Kindred: no group repeated word for word anywhere in the bank. |
| G4 | Codebreaker: no saying twice (nor two that end the same four words). |
| G5 | Crosswordocious: no word stem twice in one grid. |
| G6 | ProperNoundle: no unserved holiday answer repeats the daily rotation. |
| G7 | No curated-obscure word as an answer, required word, rung, Kindred or Spyglass word. Words rarer than Zipf 2.5 are reported as a warning only. |
| G8 | Every must-accept everyday word (AUNT, AUNTY, NIECE…) is accepted wherever it fits: the 5/6/7-letter accept lists, the Letter Ladder list, and every unseen Hubbub puzzle whose letters allow it. |
| G9 | Registry complete (an unregistered bank-like JSON in a scanned folder fails), and every copy is byte-identical to the web file. |
| G10 | Already-served entries unchanged (served snapshot). |
| G11 | No offensive word in plain text in the content tooling's own files (code, tests, data, reports, this doc, the batch-4 swap tables). |
| G12 | Every registered list word, answer, required word and rung is A–Z and within the registry's `lengths`. |

Neighbouring suites stay authoritative for their own rules and run in `content:check` too:
`content-american.test.ts` (American English in the banks), `spelling-copy.test.ts` (UI copy) and
`word-list-sync.test.ts` (guess lists are append-only; slurs never accepted).

## Adding a new game (checklist)

1. **Put the bank under `apps/web/data/`** (canonical copy) and add the iOS/Android/fixture copies the apps load.
2. **Register every file** in `registry.json`: `id`, `games`, `kind`, `schema` (`epoch-bank` for dated puzzles,
   `pool`, `accept-list`…), `web`, `copies`, and `lengths` for anything word-shaped. Skipping this is not an
   option: G9 fails on any unregistered bank-like JSON in the scanned folders.
3. **Teach the gate the bank's shape.** Add an extractor to `EXTRACT` in `gate.mjs`: which strings are
   answers or required `words`, which are only `accepted`, which are `sized` (length rule), and which are
   `texts` a player reads. Then add the id to the list in `content-check.test.ts`. An id with no extractor
   makes `gateBank` throw, so you can't forget.
4. **Make the generator use the module.** Filter candidates through `neverAnswer()` (from
   `apps/web/scripts/more-games/lib.mjs`, which asks the safety module on every `has()`), or call
   `wordProblems` / `textProblems` directly. Check scrambles and grid rows with `readsOffensive`. Then
   `await gateBank('<id>', bank)` immediately before writing the file.
5. **Run `npm run content:sync`, then `npm run content:check`**, and fix every flag. A fair exception goes in
   `data/allow.json` with its reason (see below). Don't loosen a guard.
6. Run the game's own tests (core + web, Swift/Kotlin where it has native parity tests).

## Allow and block lists

- **Block an offensive word.** Add it to `scripts/data/offensive-blocklist.txt`, or base64-encoded to the
  `explicit` / `roots` lists in `scripts/build-content-safety-data.py`, then rebuild the data. Never write
  it in plain text anywhere else.
- **An innocent word containing a hard root** (SHIITAKE, COCKTAIL…) goes in `root_exempt`. An ordinary word
  that a username blocklist catches goes in `allow` (both in the build script).
- **British vocabulary** goes in `apps/web/scripts/data/brit-words-extended.txt` (word + American
  equivalent). British spellings live in `spelling-copy.test.ts`; idioms are the `phrases` in the build script.
- **Obscure words** go in `apps/web/scripts/data/obscure-words.txt`. The Zipf threshold is in `obscure.json`
  (2.5 = warning).
- **Must-accept words** are the `BASE` vocabulary in the build script. Common inflections are added
  automatically; British and offensive words are excluded.
- **A reasoned exception to one guard** goes in `data/allow.json`, keyed `GUARD:bankId:puzzleId:WORD`
  (`:text` for a line of text; an offensive word is keyed masked). Every entry carries its reason.

## Live games: swap batches and cutover dates

Already-served content never changes. Players compare results, and finished games replay from stored seeds.

- **Classic-family answer pools** (`solutions*.json`) are order-locked, because a day's answer is
  `pool[hash(seed) % n]`. A word is replaced **in place** by a dated swap batch in
  `packages/core/src/solution-swaps.ts`, mirrored in `SolutionSwaps.swift` and `SolutionSwaps.kt` (tests
  pin the same deals on all three). From the batch's cutover date, that slot deals the replacement.
  Earlier dates keep the old word, and the old word stays a valid guess.

  | Batch | Cutover | Contents |
  |---|---|---|
  | 1 | 2026-10-05 | 23 proper-noun answers |
  | 2 | 2026-11-16 | 13 profanity answers |
  | 3 | 2026-11-16 | 46 more (its own table, because builds with batches 1–2 had already shipped) |
  | 4 | 2026-10-13 | 283 from the 2026-10-06 content audit (offensive, British, obscure, proper-noun; offensive keys base64) |

  `solutionSwapBatchesFor(date)` returns a bitmask of the live batches (1, 2, 4, 8), and dictionary caches
  are keyed by it. A shipped table must never grow: an app without the entry would deal the old word. So
  each audit adds a NEW batch with its own cutover, and app versions older than the batch keep dealing the
  old words (list that exposure in the release notes). Pick a cutover that is after today and no earlier than the day the coordinated web/iOS/Android
  release carrying the new table goes live. VS gets its words from the server, so it follows the server at once.
- **Guess lists** (`allowed*.json`) are append-only. Removing a guess would rewrite finished games
  (`word-list-sync.test.ts`).
- **Epoch banks** (Muddle, Hubbub, Crosswordocious, Letter Ladder, Kindred, Spyglass, Codebreaker) serve
  `daily[i]` on epoch + i days. Repairs edit only dailies from `CONTENT_RELEASE_DATE`
  (`apps/web/scripts/content-release-date.mjs`), the Unlimited pool, and holiday entries never served
  (entry k of a holiday serves its outings ≡ k mod n). Move `CONTENT_RELEASE_DATE` to the go-live date of
  the next coordinated release, then refresh the served snapshot.
- **ProperNoundle** rotates by category forever from 2024-01-01. `served.mjs` replays the rotation, so only
  never-served entries change.

## Credits

Word frequencies: [wordfreq](https://github.com/rspeer/wordfreq) 3.1.1 by Robyn Speer, CC BY-SA 4.0. They're
bucketed to one decimal of Zipf in `data/frequency.json`, which is shared under the same license.
