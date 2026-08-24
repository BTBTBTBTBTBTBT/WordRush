'use client';

// §223/§232: the Sweep board's nine-dot mode strip + the words-not-codes
// stats line, extracted so the daily board and the Records daily-sweep board
// render identically (founder ask, Aug 24: Records must match).
import { formatScore, modeScoreCeiling } from '@/lib/composite-scoring';
import { formatShortTime } from '@/lib/format';
import type { SweepDetails, SweepEntry } from '@/lib/daily-service';

// Fixed order = the mode grid.
const SWEEP_DOT_MODES: Array<[string, string]> = [
  ['DUEL', 'Classic'], ['QUORDLE', 'Quad'], ['OCTORDLE', 'Octo'],
  ['SEQUENCE', 'Succession'], ['RESCUE', 'Deliverance'], ['DUEL_6', 'Six'],
  ['DUEL_7', 'Seven'], ['GAUNTLET', 'Gauntlet'], ['PROPERNOUNDLE', 'Proper'],
];

/** "28m 16s · 9/9 · 87 guesses · 2 hints" — full words (§227: "2h" read as
 *  hours); the g/h segments appear only once details land. */
export function sweepStatsText(entry: SweepEntry, det: SweepDetails | undefined): string {
  let s = `${formatShortTime(entry.total_time)} · ${entry.modes_won}/9`;
  if (det) {
    s += ` · ${det.guesses} guess${det.guesses === 1 ? '' : 'es'}`;
    if (det.hints > 0) s += ` · ${det.hints} hint${det.hints === 1 ? '' : 's'}`;
  }
  return s;
}

// One dot per mode, graded ABSOLUTELY — intensity is the score as a fraction
// of that mode's theoretical ceiling, never a comparison to the field, so the
// strip reads identically with three players or three thousand (founder call,
// Aug 18: relative "best on board" dies in a crowd). Red = loss, hollow =
// not played. The [0.35, 0.9] remap spreads real-world ratios (~0.4–0.9)
// across the full visual range.
export function SweepModeDots({ details, day }: { details: SweepDetails | undefined; day: string }) {
  if (!details) return null;
  return (
    <div className="flex items-center gap-[3px] mt-1" aria-label="Per-mode results">
      {SWEEP_DOT_MODES.map(([mode, label]) => {
        const d = details.modes[mode];
        if (!d) {
          return (
            <span
              key={mode}
              title={`${label}: not played`}
              className="w-[7px] h-[7px] rounded-full shrink-0"
              style={{ border: '1px solid var(--color-border)' }}
            />
          );
        }
        if (!d.completed) {
          return (
            <span
              key={mode}
              title={`${label}: lost · ${formatScore(d.score)}`}
              className="w-[7px] h-[7px] rounded-full shrink-0"
              style={{ background: '#ef4444' }}
            />
          );
        }
        const ratio = d.score / modeScoreCeiling(mode, day);
        const t = Math.min(1, Math.max(0, (ratio - 0.35) / 0.55));
        return (
          <span
            key={mode}
            title={`${label}: ${formatScore(d.score)}`}
            className="w-[7px] h-[7px] rounded-full shrink-0"
            style={{ background: '#7c3aed', opacity: 0.18 + 0.82 * t }}
          />
        );
      })}
    </div>
  );
}
