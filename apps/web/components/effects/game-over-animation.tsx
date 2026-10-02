'use client';

import { useEffect } from 'react';
import { haptic } from '@/lib/haptics';
import { playGameOver } from '@/lib/sounds';
import { useWordDefinition } from '@/hooks/use-word-definition';
import { useWordDefinitions } from '@/hooks/use-word-definitions';
import { PAGE_HOSTS } from '@/lib/mascots';
import { MODE_BY_DBKEY } from '@/lib/modes.generated';
import { ResultPopup } from './result-popup';
import { PopupDefinition } from './popup-definition';

/** "So close" wears a soft rose (G5: tinted, never plain white). */
const ROSE = '#f43f5e';

interface GameOverAnimationProps {
  onComplete?: () => void;
  guesses?: number;
  maxGuesses?: number;
  timeSeconds?: number;
  boardsSolved?: number;
  totalBoards?: number;
  solution?: string;
  solutions?: string[];
  /** Composite score of the run — a third stat on the card (founder, 2026-09-22). */
  points?: number;
  /** Label under the guess count: "Guesses" for word modes; mistake-scored modes pass "Mistakes". */
  guessLabel?: string;
  /** §242: "Try again" button on the card — unlimited games only. */
  onPlayAgain?: () => void;
  /** The game's mode db key: its accent tints the card (R1); the rose stays the fallback. */
  mode?: string;
  /** Per-answer solved state for multi-board losses (solved boards stay purple). */
  solvedMask?: boolean[];
}

export function GameOverAnimation({ onComplete, guesses, maxGuesses, timeSeconds, boardsSolved, totalBoards, solution, solutions, points, guessLabel = 'Guesses', onPlayAgain, mode, solvedMask }: GameOverAnimationProps) {
  useEffect(() => { haptic('medium'); playGameOver(); }, []);
  const { definition: singleDef } = useWordDefinition(solution || null);
  const multiDefs = useWordDefinitions(solutions || []);
  const accent = (mode && MODE_BY_DBKEY[mode]?.accentHex) || ROSE;
  const multiDefLines = !solution && solutions && solutions.length > 0 && solutions.length <= 4
    ? solutions.map((w) => ({ w, def: multiDefs.get(w.toLowerCase()) })).filter((x) => x.def)
    : [];
  // FINISH_SPEC R1: the shared popup in its loss form — R (sleepy) on the
  // stage, SO CLOSE!, the answers on slate tiles under "the answer".
  return (
    <ResultPopup
      outcome="loss"
      accent={accent}
      host={PAGE_HOSTS.loss}
      moment="soclose"
      solution={solution}
      solutions={solution ? undefined : solutions}
      solvedMask={solvedMask}
      definition={
        solution && singleDef?.definition ? <PopupDefinition def={singleDef} accent={accent} />
          : multiDefLines.length > 0 ? (
            <div className="mt-2 text-left space-y-1">
              {multiDefLines.map(({ w, def }) => (
                <p key={w} className="m-0 text-[11px] font-medium leading-snug" style={{ color: 'var(--color-text-secondary)' }}>
                  <span className="font-black" style={{ color: 'var(--color-text)' }}>{w.toUpperCase()}</span>
                  {def!.partOfSpeech && <span className="italic"> {def!.partOfSpeech}.</span>} {def!.definition}
                </p>
              ))}
            </div>
          ) : null
      }
      guesses={guesses}
      maxGuesses={maxGuesses}
      guessLabel={guessLabel}
      timeSeconds={timeSeconds}
      boardsSolved={boardsSolved}
      totalBoards={totalBoards}
      points={points}
      onContinue={onComplete}
      onPlayAgain={onPlayAgain}
      playAgainLabel="Try again"
    />
  );
}
