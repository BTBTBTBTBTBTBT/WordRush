# Content-audit guard proposals (NOT wired in)

These files came out of the 2026-10-06 content audit (`REPORT-CONTENT-AUDIT.md`, `content-audit.json` at the repo root). None of them runs in CI, and they change no test, no app code and no bank. Each is meant to be adopted only after the audit's fixes land, because a guard that is turned on today goes red at once.

| File | What it is | Where it would go |
|---|---|---|
| `brit-words-extended.txt` | About 200 always-British words not yet in `BRIT_WORDS` or the spelling list: general vocabulary plus the British words the audit found (TONNE, PENCE, GIRO, NETBALL, ENQUIRY, RUBBISH, WICKET…). Context words (LIFT, FLAT, BOOT, CHIPS, MATE, PINT, TROLLEY) are deliberately left out. | Merge into `BRIT_WORDS` in `apps/web/scripts/content-american.test.ts`. |
| `obscure-words-proposed.txt` | Every word the audit flagged as obscure in the pools, Hubbub required lists, the ladder list, Kindred and Spyglass. | Extend `OBSCURE_WORDS` in the same test, after a human pass. |
| `content-audit-guards.proposal.mjs` | A dependency-free script holding seven guards G1–G7. It prints what each would fail on today. | Move each check into `content-american.test.ts`, inside its `unseen()` scope. |

Run it:

```
node docs/content-audit/proposals/content-audit-guards.proposal.mjs            # summary
node docs/content-audit/proposals/content-audit-guards.proposal.mjs --verbose  # every hit
```

## The guards, and the finding each would have caught

- **G1 – profanity, slurs and explicit terms in every bank.** Today `answer-pool-hygiene.test.ts` checks only the Classic, Six and Seven pools, so Muddle shipped FUCKED and SHITTY. G1 runs the same sources (profanity-exact, offensive-blocklist and the hard roots) plus a short explicit list (BONER, SEMEN, VIBRATOR, HOMO, RETARDED…) over:
  - Muddle words and finals
  - Hubbub required words
  - `ladder-words.json` and ladder paths
  - Kindred words and labels
  - crossword answers and clues (CHINK, COCK)
  - Codebreaker text
  - Spyglass words and titles
  - the pools as dealt
- **G2 – extended British vocabulary,** over the same surfaces plus the pools as dealt once every swap batch is live.
- **G3 – Kindred duplicate groups.** No identical four-word group in two puzzles (WON TOO FORE ATE was in six).
- **G4 – Codebreaker duplicate sayings.** Matches normalized text, or the same last four words, so the long lane / long road variants are caught.
- **G5 – Crossword stem repeated in one grid** (EGG/EGGS, TREE/TREES, HEAVEN/HEAVENLY).
- **G6 – ProperNoundle duplicates.** No answer may sit both in the daily rotation and in `propernoundle-holidays.json` (Sacagawea, Rosa Parks, Lincoln…).
- **G7 – the proposed OBSCURE_WORDS extension.**

## Adopting a guard

1. Land the matching fixes from `REPORT-CONTENT-AUDIT.md`:
   - pools: swap batch 4
   - Spyglass, Hubbub and ladder: their `repair-future.mjs` scripts
   - everything else: in-place edits of future entries
2. Copy the check into `content-american.test.ts`, or into `answer-pool-hygiene.test.ts` for the pool part of G1/G2.
3. Exceptions go in that test's `ALLOW` with a reason. Frozen content (dailies before `CONTENT_RELEASE_DATE`) is already outside `unseen()`.
