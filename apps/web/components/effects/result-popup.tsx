'use client';

import { FINISH_MOTION } from '@/lib/finish-motion';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { LayoutGrid, Target } from 'lucide-react';
import { Confetti } from './confetti';
import { Mascot } from '@/components/ui/mascot';
import { MomentArt } from '@/components/ui/art-title';
import { CandyButton } from '@/components/ui/candy-button';
import { CastButton } from '@/components/ui/cast-button';
import { SoftNum } from '@/components/ui/soft-number';
import { Icon3D } from '@/components/ui/icon3d';
import { ClockGlyph } from '@/components/game/result-line';
import { LetterTile } from '@/components/game/letter-tile';
import { BRAND_BAR } from '@/components/ui/soft-popup';
import { prefersReducedMotion } from '@/lib/motion';
import { feedback, scheduleFeedback } from '@/lib/sound-events';
import type { MascotId } from '@/lib/mascots';
import type { MomentName } from '@/lib/art';
import { SOFT_INK, alphaHex, darken, softMix } from '@/lib/soft-surface';
import { ANSWER_COLUMN_GAP, answerRows, answerTileGap, countUpValue, fitAnswerTile, popupFormatTime } from '@/lib/result-popup';
import { useDecodedEntrance } from '@/hooks/use-decoded-entrance';

// The win / lose popup (docs/FINISH_SPEC.md R1) — ONE component for every
// game (VictoryAnimation and GameOverAnimation both render it), so every
// completed game gets it at once:
// - the card: a soft game-accent gradient (≈10% → 4%) over the warm cream
//   (a deep accent tint in dark mode), the rainbow top bar, radius 28, a soft
//   accent glow;
// - the host on a stage: a radial glow + slow-turning light rays (24 s a
//   turn), a ground shadow, a spring-in with a 1.06 overshoot, then a bob;
//   one confetti burst in the cast colors;
// - the lettering with a single gloss sweep 0.4 s after it lands;
// - the answers on small glossy tiles in a tinted inner tray, one word per
//   row, flipping in left → right 40 ms apart (multi-board: two columns, a
//   check badge per word; a loss: the slate tile + "the answer");
// - stat chips (boards, guesses, time, points counting up with a sparkle),
//   extra chips when they apply (streak, flawless, new record);
// - a candy CONTINUE in the game accent (tap anywhere still works).
// Reduce Motion: no rays, bob, confetti or count-up (globals.css `.rp-*`).

/** How far the host's stage rises above the card (px). */
const HOST_OVERHANG = 74;

/** The cast colors for the one confetti burst. */
const CAST_CONFETTI = ['#7c3aed', '#f97316', '#22c55e', '#2563eb', '#ec4899', '#0ea5e9', '#10b981', '#eab308', '#8b5cf6', '#ef4444'];

export interface ResultPopupProps {
  outcome: 'win' | 'loss';
  /** The game's accent. */
  accent: string;
  /** The host on the stage. */
  host: MascotId;
  moment: MomentName;
  /** Single answer (word games) or the multi-board answers. */
  solution?: string;
  solutions?: string[];
  /** Per-answer solved state (multi-board losses: solved boards stay purple). */
  solvedMask?: boolean[];
  definition?: ReactNode;
  guesses?: number;
  maxGuesses?: number;
  guessLabel?: string;
  timeSeconds?: number;
  boardsSolved?: number;
  totalBoards?: number;
  points?: number;
  /** Extra chips when they apply. */
  streakDay?: number;
  flawless?: boolean;
  newRecord?: boolean;
  onContinue?: () => void;
  /** Unlimited: Play again / Try again on the card. */
  onPlayAgain?: () => void;
  playAgainLabel?: string;
  /** Explicit choices in place of tap-anywhere (Hubbub). */
  actions?: { label: string; onClick: () => void; primary?: boolean }[];
}

function useCountUp(target: number | undefined, ms = 700, delayMs = FINISH_MOTION.countStartMs): { value: number; done: boolean } {
  const [state, setState] = useState<{ value: number; done: boolean }>({ value: target ?? 0, done: true });
  useEffect(() => {
    if (target == null) return;
    if (prefersReducedMotion() || target <= 0) { setState({ value: target, done: true }); return; }
    let raf = 0;
    // BJ2: the count-up starts once the card has landed and its tiles flipped in.
    let start = 0;
    let shown = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const value = countUpValue(target, t);
      // FINISH_SPEC U: a coin tick as the points count up (throttled to ≤12/s in feedback()).
      if (Math.round(value) !== shown) { shown = Math.round(value); feedback('tick'); }
      setState({ value, done: t >= 1 });
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    setState({ value: 0, done: false });
    const wait = setTimeout(() => { start = performance.now(); raf = requestAnimationFrame(tick); }, delayMs);
    return () => { clearTimeout(wait); cancelAnimationFrame(raf); };
  }, [target, ms, delayMs]);
  return state;
}

/**
 * The points counting up — its own tiny component, so the per-frame count-up
 * re-renders just this number (smoothness pass: the hook used to live in the
 * popup itself, re-rendering the whole card — host, answer tiles, chips — on
 * every frame of its spring-in).
 */
function CountUpPoints({ target }: { target: number }) {
  const pts = useCountUp(target);
  return <>{Math.round(pts.value).toLocaleString()}{pts.done && <span className="rp-sparkle" aria-hidden="true">✦</span>}</>;
}

function Chip({ accent, icon, value, label, className = '' }: { accent: string; icon: ReactNode; value: ReactNode; label: string; className?: string }) {
  return (
    <div
      className={`relative flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 ${className}`}
      style={{ background: alphaHex(accent, 0.1), borderRadius: 14, padding: '7px 4px 6px' }}
    >
      <span className="inline-flex items-center justify-center" style={{ height: 18 }}>{icon}</span>
      <SoftNum size={18} className="soft-num-auto">{value}</SoftNum>
      <span className="text-[9px] font-black uppercase" style={{ letterSpacing: '0.1em', color: SOFT_INK.label }}>{label}</span>
    </div>
  );
}

function StarGlyph() {
  return (
    <svg width={17} height={17} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5L2.6 9.4l6.5-.9z" fill="#f5a524" stroke="#b4690e" strokeWidth={1} strokeLinejoin="round" />
    </svg>
  );
}

export function ResultPopup(p: ResultPopupProps) {
  const { outcome, accent, host, moment } = p;
  const win = outcome === 'win';
  const hasActions = !!p.actions && p.actions.length > 0;
  // FINISH_SPEC U: the popup opens with a `whoosh`, then `win` (success haptic)
  // or `lose` (soft); a streak chip adds `streak` once the chip pops. Runs
  // before the wrappers' legacy calls, which then collapse into these.
  useEffect(() => {
    feedback('whoosh');
    feedback(win ? 'win' : 'lose');
    return p.streakDay != null ? scheduleFeedback('streak', 900) : undefined;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // AZ: the host + lettering are decoded before the spring-in starts.
  const { ref: entranceRef, waiting } = useDecodedEntrance<HTMLDivElement>();
  const words = p.solution ? [p.solution] : p.solutions ?? [];
  const multi = words.length > 1;
  const cols = words.length > 8 ? 3 : multi ? 2 : 1;
  // Founder 10-02: the tiles fit the tray's measured width (one row per word
  // of a phrase answer, per column on the multi-board layouts).
  const answersRef = useRef<HTMLDivElement>(null);
  const [answersWidth, setAnswersWidth] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = answersRef.current;
    if (!el) return;
    const measure = () => setAnswersWidth((prev) => (prev === el.clientWidth ? prev : el.clientWidth));
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const tile = fitAnswerTile(words, answersWidth, cols, multi);
  const tileGap = answerTileGap(tile);
  const time = p.timeSeconds != null ? popupFormatTime(p.timeSeconds) : null;
  const deep = darken(accent, 0.35);
  // CONTINUE in the game accent (A8 recipe recolored).
  const candyAccent = { ['--candy-1' as string]: softMix(accent, 0.62), ['--candy-2' as string]: accent, ['--candy-lip' as string]: deep } as React.CSSProperties;

  return (
    <div
      ref={entranceRef}
      className={`fixed inset-0 z-50 flex items-center justify-center px-5 animate-fade-in${waiting ? ' motion-wait' : ''}`}
      // AU1: centered in the SAFE AREA, vertically too.
      style={{ backgroundColor: 'rgba(30, 15, 60, 0.55)', paddingTop: 'max(12px, env(safe-area-inset-top))', paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
      onClick={hasActions ? undefined : p.onContinue}
      role="dialog"
      aria-modal="true"
      aria-label={win ? 'You won' : 'Game over'}
    >
      {win && <Confetti colors={CAST_CONFETTI} />}

      {/* AU1: the host's stage overhangs the card by HOST_OVERHANG; that room is
          reserved above the card so host + card center as ONE group. */}
      <div className="relative max-w-sm w-full animate-fade-in-scale" style={{ marginTop: HOST_OVERHANG }}>
        {/* The host's stage: glow, slow rays, ground shadow; spring-in, then a bob. */}
        <div className="absolute left-0 right-0 flex justify-center pointer-events-none" style={{ top: -HOST_OVERHANG, zIndex: 2 }} aria-hidden="true">
          <div className="relative" style={{ width: 150, height: 104 }}>
            <span className="absolute rp-rays" style={{ left: '50%', top: '46%', width: 190, height: 190, marginLeft: -95, marginTop: -95, borderRadius: '50%', background: `repeating-conic-gradient(${alphaHex(accent, 0.12)} 0deg 10deg, transparent 10deg 24deg)`, maskImage: 'radial-gradient(circle, #000 30%, transparent 70%)', WebkitMaskImage: 'radial-gradient(circle, #000 30%, transparent 70%)' }} />
            <span className="absolute" style={{ left: '50%', top: '46%', width: 120, height: 120, marginLeft: -60, marginTop: -60, borderRadius: '50%', background: `radial-gradient(circle, ${alphaHex(accent, 0.3)}, transparent 68%)` }} />
            <span className="absolute" style={{ left: '50%', bottom: 2, width: 70, height: 10, marginLeft: -35, borderRadius: '50%', background: alphaHex(deep, 0.22), filter: 'blur(3px)' }} />
            <div className="absolute rp-spring" style={{ left: '50%', bottom: 4, marginLeft: -45 }}>
              <div className={win ? 'rp-bob' : ''}>
                <Mascot id={host} size={90} priority />
              </div>
            </div>
          </div>
        </div>

        <div
          className="relative text-center overflow-hidden result-pop flex flex-col"
          style={{
            background: `linear-gradient(${alphaHex(accent, 0.1)}, ${alphaHex(accent, 0.04)}), var(--popup-cream)`,
            borderRadius: 28,
            boxShadow: `0 24px 60px rgba(40, 15, 80, 0.3), 0 0 0 1.5px ${alphaHex(accent, 0.22)}, 0 0 36px ${alphaHex(accent, 0.28)}`,
            // Taller than the room: it scrolls inside (the body below is overflow-y-auto).
            maxHeight: `calc(100dvh - ${HOST_OVERHANG}px - max(12px, env(safe-area-inset-top)) - max(12px, env(safe-area-inset-bottom)))`,
          }}
        >
          <div aria-hidden="true" style={{ height: 10, background: BRAND_BAR, flex: 'none' }} />

          <div className="px-5 pt-7 pb-4 overflow-y-auto">
            {/* The lettering, with one gloss sweep after it lands. */}
            <div className="relative rp-gloss mx-auto" style={{ width: 'fit-content', maxWidth: '100%' }}>
              <MomentArt moment={moment} />
            </div>

            {/* The answers on glossy tiles in a tinted inner tray. */}
            {words.length > 0 && (
              <div className="mt-3 px-3 py-2.5" style={{ background: alphaHex(accent, 0.08), borderRadius: 16 }}>
                {!win && (
                  <div className="text-[10px] font-black uppercase mb-1.5" style={{ letterSpacing: '0.12em', color: SOFT_INK.label }}>
                    {words.length === 1 ? 'The answer' : 'The answers'}
                  </div>
                )}
                <div ref={answersRef} className="grid justify-center" style={{ gridTemplateColumns: `repeat(${cols}, auto)`, columnGap: ANSWER_COLUMN_GAP, rowGap: 6 }} role="list" aria-label={words.map((w) => w.toUpperCase()).join(', ')}>
                  {words.map((w, wi) => {
                    const solved = win || !!p.solvedMask?.[wi];
                    // One row per word (no space tiles); the flip runs on across the rows.
                    let at = 0;
                    return (
                      <div key={wi} className="flex items-center justify-center gap-1" role="listitem" aria-label={w.toUpperCase()}>
                        <div className="flex flex-col items-center" style={{ rowGap: tileGap, ['--gt-font' as string]: `${Math.round(tile * 0.56)}px` } as React.CSSProperties} aria-hidden="true">
                          {answerRows(w).map((row, ri) => (
                            <div key={ri} className="flex" style={{ gap: tileGap }}>
                              {row.split('').map((ch) => {
                                const i = at++;
                                return (
                                  <LetterTile
                                    key={i}
                                    letter={ch}
                                    look={solved ? 'correct' : 'absent'}
                                    flipIndex={0}
                                    flipSound={false}
                                    pop={false}
                                    style={{ width: tile, height: tile, flex: 'none', ['--gt-d' as string]: `${FINISH_MOTION.tilesStartMs + wi * 120 + i * 40}ms` } as React.CSSProperties}
                                  />
                                );
                              })}
                            </div>
                          ))}
                        </div>
                        {multi && solved && <Icon3D name="badge-check" size={Math.max(12, Math.round(tile * 0.6))} />}
                      </div>
                    );
                  })}
                </div>
                {p.definition}
              </div>
            )}

            {/* Stat chips (R1): boards, guesses, time, points (gold, counting up). */}
            {(p.guesses != null || time != null || p.boardsSolved != null || p.points != null) && (
              <div className="flex justify-center gap-1.5 mt-3">
                {p.boardsSolved != null && p.totalBoards != null && (
                  <Chip accent={accent} icon={<LayoutGrid style={{ width: 16, height: 16, color: deep }} strokeWidth={2.6} />} value={`${p.boardsSolved}/${p.totalBoards}`} label="Boards" />
                )}
                {p.guesses != null && (
                  <Chip accent={accent} icon={<Target style={{ width: 16, height: 16, color: deep }} strokeWidth={2.6} />} value={`${p.guesses}${p.maxGuesses ? `/${p.maxGuesses}` : ''}`} label={p.guessLabel ?? 'Guesses'} />
                )}
                {time != null && <Chip accent={accent} icon={<ClockGlyph size={16} />} value={time} label="Time" />}
                {p.points != null && (
                  <Chip
                    accent="#f5a524"
                    icon={<StarGlyph />}
                    value={<CountUpPoints target={p.points} />}
                    label="Points"
                  />
                )}
              </div>
            )}
            {(p.streakDay != null || p.flawless || p.newRecord) && (
              <div className="flex justify-center items-center gap-1.5 mt-2 flex-wrap">
                {p.streakDay != null && (
                  <span className="inline-flex items-center gap-1 rp-pop px-2.5 py-1 rounded-full" style={{ background: alphaHex('#f97316', 0.14) }}>
                    <Icon3D name="flame" size={16} />
                    <SoftNum size={13} className="soft-num-auto">Day {p.streakDay}</SoftNum>
                  </span>
                )}
                {p.flawless && (
                  <span className="text-[11px] font-black uppercase px-2.5 py-1 rounded-full text-white" style={{ background: 'linear-gradient(#f472b6, #db2777)', letterSpacing: '0.08em' }}>Flawless</span>
                )}
                {p.newRecord && <span className="inline-block" style={{ width: 120 }}><MomentArt moment="newrecord" maxHeight={20} widthPct={100} as="div" /></span>}
              </div>
            )}

            {/* Actions: Play again (Unlimited), explicit choices, or CONTINUE in the game accent. */}
            <div className="mt-4 flex flex-col items-center gap-2">
              {p.onPlayAgain && !hasActions && (
                <CastButton size="md" color={win ? 'purple' : 'amber'} icon="replay" onClick={(e) => { e.stopPropagation(); p.onPlayAgain!(); }}>
                  {p.playAgainLabel ?? (win ? 'Play again' : 'Try again')}
                </CastButton>
              )}
              {hasActions ? (
                <div className="flex justify-center gap-2 flex-wrap">
                  {p.actions!.map((a) => (
                    <CastButton key={a.label} size="md" color={a.primary ? 'purple' : 'peach'} onClick={(e) => { e.stopPropagation(); a.onClick(); }}>
                      {a.label}
                    </CastButton>
                  ))}
                </div>
              ) : (
                <CastButton size="md" style={candyAccent} icon="arrow" onClick={(e) => { e.stopPropagation(); p.onContinue?.(); }}>
                  Continue
                </CastButton>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
