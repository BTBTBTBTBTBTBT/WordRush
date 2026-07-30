# Audits — findings get committed, not summarised

## The rule

**Every audit writes its findings to a file in this directory, in the same
commit as the fixes.** A line in `WORDOCIOUS_BIBLE.md` is a summary, not a
record. Summaries are for the story; this directory is for the evidence.

One file per audit, named `YYYY-MM-DD-<topic>.md`.

## Why

On 2026-07-30 a 15-surface Android↔iOS parity audit produced 273 raw findings,
258 confirmed, 236 fixed. Only the counts reached the bible. When the first real
tester found bugs hours later and the obvious question came up — *"what did the
audit look at, and what did it decide not to fix?"* — the answer was
unrecoverable. The 22 confirmed-but-unfixed findings and the 15 refuted ones
existed only as numbers. Re-deriving them would have meant re-running the whole
audit.

That is a straightforward loss and it was avoidable.

## What a findings file must contain

- **The scope.** Which surfaces/files were examined, and which were not. A
  reader must be able to tell whether their bug was in scope.
- **The method, verbatim.** If a verifier or filter was used, paste its actual
  instructions. This matters more than it sounds: the 2026-07-30 verifier was
  told to "default to REFUTED when uncertain" and that "a missed one costs
  little" — and one of the false-positive patterns it was told to dismiss,
  *"`.weight`/`.fillMaxWidth` vs fixed frames can produce identical layouts"*,
  was the exact shape of the OctoWord bug that shipped. Nobody could have known
  that without the prompt text.
- **Every finding**, including the ones dismissed, with file:line on both sides.
  Rejected findings are the most valuable part of the file, because a rejection
  is a judgement call that later evidence can overturn.
- **Disposition per finding**: fixed (with commit), deferred (with reason), or
  rejected (with reason).
- **What the method could not see.** State the blind spot explicitly. The
  2026-07-30 audit compared source and never rendered a screen, so clipping,
  contrast and window-inset bugs were structurally invisible to it — no amount
  of diligence inside that method would have caught them.

## Known blind spots, and what covers them

| Blind spot | Why source review misses it | Covered by |
|---|---|---|
| Clipping / overflow | A fixed font size looks correct next to the other platform's | Rendered screenshots at real sizes |
| Contrast in a theme | Both sides "set a colour"; only the pairing fails | Screenshots in every theme, or a computed contrast ratio |
| Window insets | Depends on `targetSdk` + OS version, not on the code | An **API 35+** emulator — API 34 cannot reproduce it |
| Dead-but-plausible code | Reads as the mechanism; nothing dispatches it | Tracing the call site, not just the definition |

`scripts/android-screens.sh` walks the Android app and captures each surface for
the rendered half of this.
