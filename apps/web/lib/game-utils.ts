/**
 * Game-flow helpers shared across every solo and VS mode.
 *
 * hasDuplicateGuess: returns true if the player has already submitted
 * this exact word earlier in the current game. Multi-board modes feed
 * the same guess to every board, so checking the union of all boards'
 * guess arrays correctly rejects "I already typed this" across the
 * whole match. Gauntlet calls it with the current stage's boards only
 * (state.boards is rebuilt per stage, so prior stages don't pollute).
 *
 * Used both in the ENTER handler (show "Already guessed" and return
 * without dispatching) and in the isInvalidWord flag passed to the
 * board renderers (red-flash the row so the player sees the rejection
 * before committing).
 */
export function hasDuplicateGuess(
  boards: ReadonlyArray<{ guesses: readonly string[] }>,
  candidate: string,
): boolean {
  if (!candidate) return false;
  const normalized = candidate.toUpperCase();
  for (const b of boards) {
    if (b.guesses.includes(normalized)) return true;
  }
  return false;
}
