'use client';

import { GauntletStageConfig } from '@wordle-duel/core';
import { useCallback, useEffect, useRef } from 'react';
import { CandyButton } from '@/components/ui/candy-button';
import { SoftNum } from '@/components/ui/soft-number';
import { ART_SIZE, artSrc } from '@/lib/art';
import { GAUNTLET_ACCENT, stageDots, stagePose, stageRuleLine } from '@/lib/gauntlet-look';
import { alphaHex, cardBarStyle, darken, softCard, softPill } from '@/lib/soft-surface';

// The between-stage screen (docs/FINISH_SPEC.md P): a tinted amber card in
// the Gauntlet accent with a big cast pose that changes per upcoming stage
// (lib/gauntlet-look.ts stagePose; it springs in), "STAGE 3 OF 5" in soft
// numbers over a 5-dot progress row (cleared = amber with a W, current
// pulsing), the stage's rule as a tinted pill, the running guess total in
// soft numbers and a large amber candy CONTINUE. Tap anywhere, Enter or
// Space continues, as before; it still auto-continues on its timer.

interface StageTransitionProps {
  completedStage: GauntletStageConfig;
  nextStage: GauntletStageConfig | null;
  /** Stages cleared, counting the one just finished (drives the dots and the pose). */
  cleared?: number;
  /** Stages in the run (5). */
  totalStages?: number;
  /** Guesses used so far, the running score. */
  guessesSoFar?: number;
  /** VS shortens the interstitial: the OPPONENT'S CLOCK DOES NOT PAUSE for it,
   *  so a 2.5s flourish per stage is a real handicap over a 5-stage run. */
  isVersus?: boolean;
  onComplete: () => void;
}

export function StageTransition({ completedStage, nextStage, cleared, totalStages = 5, guessesSoFar, isVersus = false, onComplete }: StageTransitionProps) {
  // onComplete dispatches NEXT_STAGE, so it must fire exactly once however the
  // overlay is dismissed — timer, tap, or key. A second call would skip a stage.
  const fired = useRef(false);
  const finish = useCallback(() => {
    if (fired.current) return;
    fired.current = true;
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    const timer = setTimeout(finish, isVersus ? 1000 : 2500);
    return () => clearTimeout(timer);
  }, [finish, isVersus]);

  // §256 (founder: "when I hit enter on tap to continue, it does nothing").
  // The overlay was click-to-skip only; the game's own key listener ignores
  // every key while the transition shows, so Enter fell on the floor and the
  // player sat out the timer. Enter and Space now dismiss it — same as a tap.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      finish();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [finish]);

  const done = Math.min(totalStages, cleared ?? 1);
  const nextNumber = nextStage ? done + 1 : null;
  const pose = stagePose(nextNumber);
  const [pw, ph] = ART_SIZE[pose];
  const ink = darken(GAUNTLET_ACCENT, 0.35);
  const dots = stageDots(totalStages, nextStage ? done : totalStages);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      style={{ background: 'rgba(30, 15, 60, 0.45)', backdropFilter: 'blur(3px)' }}
      onClick={finish}
      role="dialog"
      aria-label={nextStage ? `Stage complete. Next: ${nextStage.name}` : 'Stage complete'}
    >
      <div className="relative w-full max-w-sm overflow-hidden text-center" style={{ ...softCard(GAUNTLET_ACCENT, { radius: 24 }), ['--color-card-base' as string]: '#ffffff' } as React.CSSProperties}>
        <div aria-hidden="true" style={cardBarStyle(GAUNTLET_ACCENT)} />
        <div className="flex flex-col items-center gap-2.5 px-5 pt-3 pb-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={pose}
            src={artSrc(pose)}
            alt=""
            aria-hidden="true"
            width={pw}
            height={ph}
            className="intro-pop"
            style={{ width: 132, height: 132, filter: `drop-shadow(0 8px 12px ${alphaHex(GAUNTLET_ACCENT, 0.28)})` }}
          />
          <div className="text-[12px] font-black uppercase" style={{ color: ink, letterSpacing: 1.4 }}>
            Stage complete · {completedStage.name}
          </div>
          {nextStage ? (
            <SoftNum size={26} as="div">STAGE {done + 1} OF {totalStages}</SoftNum>
          ) : (
            <SoftNum size={26} as="div">ALL {totalStages} CLEARED</SoftNum>
          )}
          {/* The 5-dot progress row: cleared stages amber with a W, the next one pulsing. */}
          <div className="flex items-center justify-center gap-2" aria-label={`${done} of ${totalStages} stages cleared`}>
            {dots.map((d, i) => (
              <span
                key={i}
                aria-hidden="true"
                className={`flex items-center justify-center font-black text-white ${d === 'current' ? 'motion-safe:animate-pulse' : ''}`}
                style={{
                  width: 22, height: 22, borderRadius: 999, fontSize: 10,
                  background: d === 'done' ? `linear-gradient(#ffc56b, ${GAUNTLET_ACCENT})` : d === 'current' ? alphaHex(GAUNTLET_ACCENT, 0.35) : alphaHex(GAUNTLET_ACCENT, 0.12),
                  boxShadow: d === 'done' ? `0 2px 0 ${ink}` : `inset 0 0 0 1.5px ${alphaHex(GAUNTLET_ACCENT, 0.4)}`,
                }}
              >
                {d === 'done' ? 'W' : ''}
              </span>
            ))}
          </div>
          {nextStage && (
            <>
              <div className="text-[22px] font-black leading-tight" style={{ color: 'var(--color-text, #2a1650)' }}>{nextStage.name}</div>
              <span className="text-[11px] font-black uppercase px-3 py-1" style={{ ...softPill(GAUNTLET_ACCENT), color: ink, letterSpacing: 0.6 }}>
                {stageRuleLine(nextStage)}
              </span>
            </>
          )}
          {guessesSoFar != null && (
            <div className="flex items-baseline gap-1.5">
              <SoftNum size={22}>{guessesSoFar}</SoftNum>
              <span className="text-[10px] font-black uppercase" style={{ color: ink, letterSpacing: 1 }}>guesses so far</span>
            </div>
          )}
          <CandyButton color="amber" size="lg" block icon="arrow" onClick={(e) => { e.stopPropagation(); finish(); }} className="mt-1">
            Continue
          </CandyButton>
        </div>
      </div>
    </div>
  );
}
