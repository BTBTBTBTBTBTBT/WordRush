// FINISH_SPEC BI25: a used in-game hint ("Vowel: A", "No vowels left") is information,
// not a button — a soft filled pill with no outline (the founder's no-outlines rule
// overrides A8), on the small candy's footprint (32px + its 3px lip) so nothing moves.
// Parity: iOS UsedHintPill (G5Kit.swift), Android HintCandy's used state.

// Button family (10-05, iOS HelperButtonStyle(used: true)): the spent hint is the HELPER pill in the explicit
// used look (saturation .25, 50%) — the game accent in a game, else purple — keeping the helper's footprint.
// [accent] is kept for callers (the hue no longer marks a state).
export function UsedHintPill({ children }: { children: React.ReactNode; accent?: string }) {
  return (
    <span role="status" className="candy candy-sm candy-dim candy-block" style={{ cursor: 'default' }}>
      <span className="candy-label">{children}</span>
    </span>
  );
}
