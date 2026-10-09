'use client';

import { emitMascotMoment } from '@/lib/living-mascot';
import { useEffect } from 'react';
import { useWordDefinition } from '@/hooks/use-word-definition';
import { haptic } from '@/lib/haptics';
import { playSuccess } from '@/lib/sounds';
import { victoryHost } from '@/lib/mascots';
import { POPUP_ACCENT } from '@/components/ui/soft-popup';
import { MODE_BY_DBKEY } from '@/lib/modes.generated';
import { ResultPopup } from './result-popup';
import { PopupDefinition } from './popup-definition';

interface VictoryAnimationProps {
  onComplete?: () => void;
  guesses?: number;
  maxGuesses?: number;
  timeSeconds?: number;
  boardsSolved?: number;
  totalBoards?: number;
  solution?: string;
  solutions?: string[];
  /** Composite score of the run — a third stat on the card (founder,
   *  2026-09-22: the points are the number players care about). */
  points?: number;
  /** Label under the guess count: "Guesses" for word modes; mistake-scored
   *  modes pass "Mistakes". */
  guessLabel?: string;
  /** §242: shown as a "Play again" button on the card — pass ONLY on
   *  unlimited (non-daily) games where the caller's restart handler exists. */
  onPlayAgain?: () => void;
  /** Explicit choices in place of tap-anywhere (founder, 2026-09-28: Hubbub's
   *  "Keep playing" / "I'm done"). When supplied, the backdrop no longer
   *  dismisses and the "Tap anywhere" caption is hidden; every other game
   *  keeps the default behavior. */
  actions?: { label: string; onClick: () => void; primary?: boolean }[];
  /** The game's mode db key: its host pops in above VICTORY (docs/MASCOT_SPEC.md §5) and its accent tints the card (R1). */
  mode?: string;
  /** R1 extra chips, when they apply. */
  streakDay?: number;
  flawless?: boolean;
  newRecord?: boolean;
}

export function VictoryAnimation({ onComplete, guesses, maxGuesses, timeSeconds, boardsSolved, totalBoards, solution, solutions, points, guessLabel = 'Guesses', onPlayAgain, actions, mode, streakDay, flawless, newRecord }: VictoryAnimationProps) {
  useEffect(() => { haptic('heavy'); playSuccess(); emitMascotMoment('win'); }, []);
  const { definition } = useWordDefinition(solution || null);
  const accent = (mode && MODE_BY_DBKEY[mode]?.accentHex) || POPUP_ACCENT.brand;
  // FINISH_SPEC R1: the shared win popup (components/effects/result-popup.tsx).
  return (
    <ResultPopup
      outcome="win"
      accent={accent}
      host={victoryHost(mode, new Date().toDateString())}
      moment="victory"
      solution={solution}
      solutions={solution ? undefined : solutions}
      definition={solution && definition?.definition ? <PopupDefinition def={definition} accent={accent} /> : null}
      guesses={guesses}
      maxGuesses={maxGuesses}
      guessLabel={guessLabel}
      timeSeconds={timeSeconds}
      boardsSolved={boardsSolved}
      totalBoards={totalBoards}
      points={points}
      streakDay={streakDay}
      flawless={flawless}
      newRecord={newRecord}
      onContinue={onComplete}
      onPlayAgain={onPlayAgain}
      actions={actions}
    />
  );
}
