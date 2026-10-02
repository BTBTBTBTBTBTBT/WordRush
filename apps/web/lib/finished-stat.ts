import { formatGuessStat } from './format';

// The one-screen finished screen's result strip (docs/FINISH_SPEC.md R2)
// splits a mode's guess stat into the chip's soft number + its small label.
// Pure.

/**
 * A mode's guess_count as the strip chip's value + label, in the mode's own
 * words (lib/format.ts formatGuessStat): "3 mistakes" → 3 / "mistakes",
 * "Par" → Par / "", "+2" → +2 / "over par", "Hubbub" → Hubbub / "rank".
 */
export function guessStatParts(semantics: string, guessBase: number, guessCount: number): { value: string; label: string } {
  const stat = formatGuessStat(semantics, guessBase, guessCount);
  const m = /^(\d+) (.+)$/.exec(stat);
  if (m) return { value: m[1], label: m[2] };
  if (semantics === 'overPar') return { value: stat, label: stat === 'Par' ? '' : 'over par' };
  if (semantics === 'rank') return { value: stat, label: 'rank' };
  return { value: stat, label: '' };
}
