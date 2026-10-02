'use client';

import { LiveHeadline } from '@/components/ui/live-headline';
import Image from 'next/image';
import Link from 'next/link';
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Icon3D } from '@/components/ui/icon3d';
import { SoftNum } from '@/components/ui/soft-number';
import { CandyButton, CandyLink } from '@/components/ui/candy-button';
import { useAuth } from '@/lib/auth-context';
import { useDailyCompletions } from '@/lib/daily-completions-context';
import { PROFILE_MODES } from '@/components/profile/mode-picker';
import { SWEEP_MODES } from '@/lib/modes.generated';
import { dailyHref, MODE_ROUTES } from '@/lib/mode-routes';
import { ART_SIZE, artSrc } from '@/lib/art';
import { SOFT_INK, darken, softBackground, softBorder, softPill, softShadow } from '@/lib/soft-surface';
import { ClockGlyph, ShareGlyph } from './result-line';
import { fitScale, unlimitedHref } from '@/lib/finished-layout';
import { openGoProPopup } from '@/lib/payment/go-pro-popup';

// The one-screen finished screen (docs/FINISH_SPEC.md R2) and the Unlimited
// card (R3). Every game's finished screen reads, top → bottom: its header, a
// compact one-line ResultStrip (badge · guesses · time · points), the board(s)
// in a FitBox that scales them to whatever height is left, then the
// FinishedDock pinned above the tab bar — the 3D share icon + the primary
// candy (Next daily / Leaderboard) + the Unlimited card for Pro. Extras
// (definitions, score breakdowns) go in a MoreDisclosure, never above the
// buttons. Measured, not guessed: the FitBox gets the height the dock leaves.

/** The peach of the Unlimited card (A8 quiet peach). */
export const UNLIMITED_PEACH = '#fb923c';

const LOOP = 'art-scene-unlimited-loop' as const;

// ── R2: the compact result strip ──────────────────────────────────────────

function StripChip({ accent, icon, value, label }: { accent: string; icon: ReactNode; value: ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 shrink-0" style={{ ...softPill(accent), padding: '3px 9px 3px 4px' }}>
      <span className="inline-flex items-center justify-center" style={{ width: 20, height: 20 }}>{icon}</span>
      <SoftNum size={15}>{value}</SoftNum>
      <small className="font-extrabold" style={{ fontSize: 10, color: SOFT_INK.label }}>{label}</small>
    </span>
  );
}

/**
 * R2: ONE line — the W / L badge · guesses · time · points — compact pills
 * with soft numbers. `srText` keeps the old result sentence for screen readers.
 */
export function ResultStrip({ won, guesses, guessLabel = 'guesses', time, points, srText, headline, className = '' }: {
  won: boolean;
  /** FINISH_SPEC AR: the strip's headline in live lettering (default SOLVED! / NOT TODAY); null = none (OctoWord gives the room to its boards). */
  headline?: string | null;
  guesses?: ReactNode;
  guessLabel?: string;
  /** Already formatted (0:48). */
  time?: string;
  points?: number | null;
  srText: string;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center gap-0.5 ${className}`}>
    {/* One-screen audit: on short phones (< 740 tall, the SE) the headline yields its ~29 px to the board. */}
    {headline !== null && (
      <div className="w-full [@media(max-height:739.98px)]:hidden">
        <LiveHeadline text={headline ?? (won ? 'SOLVED!' : 'NOT TODAY')} palette={won ? 'celebrate' : 'menu'} size={20} level={2} />
      </div>
    )}
    <div className="w-full flex items-center justify-center gap-1.5 flex-nowrap overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
      <span className="sr-only">{srText}</span>
      <Icon3D name={won ? 'badge-w' : 'badge-l'} size={24} label={won ? 'Won' : 'Lost'} />
      {guesses != null && <StripChip accent="#7c3aed" icon={<Icon3D name="badge-check" size={18} />} value={guesses} label={guessLabel} />}
      {time && <StripChip accent="#2563eb" icon={<ClockGlyph size={17} />} value={time} label="time" />}
      {points != null && <StripChip accent="#f5a524" icon={<Icon3D name="trophy" size={17} />} value={Math.round(points).toLocaleString()} label="pts" />}
    </div>
    </div>
  );
}

// ── R2: the board scaled to fit the height that is left ───────────────────

/**
 * Scales its content down (never up) so it fits the box's measured height and
 * width — finished boards may shrink below the playing size. The box itself
 * is `flex-1 min-h-0` inside the finished screen's flex column, so it gets
 * exactly what the header, strip and dock leave.
 */
export function FitBox({ children, className = '', style, minScale = 0.4 }: { children: ReactNode; className?: string; style?: React.CSSProperties; minScale?: number }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const box = boxRef.current;
    const inner = innerRef.current;
    if (!box || !inner || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      // The natural size: scrollWidth/Height are unaffected by the transform.
      setScale(fitScale({ width: box.clientWidth, height: box.clientHeight }, { width: inner.scrollWidth, height: inner.scrollHeight }, minScale));
    };
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    ro.observe(inner);
    measure();
    return () => ro.disconnect();
  }, [minScale]);
  return (
    <div ref={boxRef} className={`relative flex-1 min-h-0 w-full flex justify-center overflow-hidden ${className}`} style={style}>
      <div ref={innerRef} style={{ transform: scale < 1 ? `scale(${scale})` : undefined, transformOrigin: 'top center', width: '100%' }}>
        {children}
      </div>
    </div>
  );
}

/** R2: extras (definitions, score breakdowns) behind a tinted "More" disclosure. */
export function MoreDisclosure({ label = 'More', children, accent = '#7c3aed' }: { label?: string; children: ReactNode; accent?: string }) {
  return (
    <details className="w-full max-w-[400px] mx-auto group">
      <summary
        className="list-none cursor-pointer select-none flex items-center justify-center gap-1.5 text-[11px] font-black uppercase py-2 [&::-webkit-details-marker]:hidden"
        style={{ letterSpacing: '0.12em', color: SOFT_INK.label }}
      >
        <span className="inline-flex items-center justify-center rounded-full px-3 py-1" style={softPill(accent, { bar: false })}>{label}</span>
      </summary>
      <div className="pb-2">{children}</div>
    </details>
  );
}

// ── R3: the Unlimited card ────────────────────────────────────────────────

/** The U loop art, slowly wobbling (off with Reduce Motion, globals.css `.loop-wobble`). */
export function UnlimitedLoopArt({ size = 64 }: { size?: number }) {
  const [w, h] = ART_SIZE[LOOP];
  return (
    <Image
      src={artSrc(LOOP)}
      alt=""
      aria-hidden
      width={w}
      height={h}
      sizes={`${size}px`}
      draggable={false}
      className="loop-wobble shrink-0 select-none pointer-events-none"
      style={{ width: size, height: 'auto', aspectRatio: `${w} / ${h}`, filter: 'drop-shadow(0 4px 6px rgba(194, 65, 12, 0.22))' }}
    />
  );
}

/** The small gold PRO pill on a free player's Unlimited button (R3). */
export function ProPill() {
  return (
    <span
      className="inline-flex items-center rounded-full px-1.5 font-black"
      style={{ fontSize: 9, lineHeight: '14px', letterSpacing: '0.08em', color: '#7a3d00', background: 'linear-gradient(#ffe08a, #f5c542)', boxShadow: '0 1px 0 #b4690e', textShadow: 'none' }}
    >
      PRO
    </span>
  );
}

/**
 * R3: the peach "KEEP PLAYING" card — the U loop art left, "Unlimited <Game>"
 * + "Fresh puzzles, no waiting", and a peach candy (no infinity glyph, FINISH_SPEC Y).
 * Pro: a full document load into the same route without ?daily (a fresh
 * puzzle); after an UNLIMITED game (`onNewPuzzle`) it becomes the primary
 * action — a big NEW PUZZLE candy + a small "Other games" link. Free players
 * and guests (founder 10-02) see the same card with a gold PRO pill on the
 * button; tapping it opens the redesigned Go Pro popup, whose checkout lands
 * straight in that Unlimited game.
 */
export function UnlimitedCard({ currentMode, onNewPuzzle, className = '', compact = false }: { currentMode: string; onNewPuzzle?: () => void; className?: string; /** One-screen audit: always the 48 px row (OctoWord). */ compact?: boolean }) {
  const { isProActive, loading } = useAuth();
  const mode = PROFILE_MODES.find((m) => m.dbKey === currentMode);
  const href = unlimitedHref(currentMode, MODE_ROUTES);
  if (loading || !mode || !href) return null;
  const ink = darken(UNLIMITED_PEACH, 0.45);
  const newPuzzle = isProActive ? onNewPuzzle : undefined;
  const action = (size: 'sm' | 'md') => newPuzzle ? (
    <CandyButton color="peach" size={size} icon="replay" onClick={newPuzzle} className="shrink-0">New puzzle</CandyButton>
  ) : isProActive ? (
    <CandyLink href={href} native color="peach" size="sm" icon="play" className="shrink-0" aria-label={`Play Unlimited ${mode.title}`}>Play</CandyLink>
  ) : (
    <CandyButton
      color="peach"
      size="sm"
      icon="play"
      trailing={<ProPill />}
      className="shrink-0"
      aria-label={`Play Unlimited ${mode.title} with Pro`}
      onClick={() => openGoProPopup({ afterPurchaseHref: href, reason: `Unlimited ${mode.title}` })}
    >
      Play
    </CandyButton>
  );
  const surface: React.CSSProperties = { background: softBackground(UNLIMITED_PEACH, 0.14), border: softBorder(UNLIMITED_PEACH, 0.14), boxShadow: `inset 0 4px 0 ${UNLIMITED_PEACH}, ${softShadow(UNLIMITED_PEACH, 0.14)}` };
  const otherGames = newPuzzle && (
    <Link href="/" className="text-[11px] font-black underline shrink-0" style={{ color: 'var(--color-text-muted)' }}>Other games</Link>
  );
  return (
    <>
      {/* The full card (viewports ≥ 740 px tall). */}
      <div
        className={`w-full max-w-[400px] mx-auto ${compact ? 'hidden' : 'flex'} items-center gap-2.5 overflow-hidden [@media(max-height:739.98px)]:hidden ${className}`}
        style={{ ...surface, borderRadius: 18, padding: '10px 10px 8px' }}
        role="group"
        aria-label={`Keep playing: Unlimited ${mode.title}`}
      >
        <UnlimitedLoopArt size={64} />
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-black uppercase soft-ink" style={{ letterSpacing: '0.12em', ['--ink-l' as string]: ink, ['--ink-d' as string]: '#fdba74' } as React.CSSProperties}>
            {newPuzzle ? 'Keep going' : 'Keep playing'}
          </div>
          <div className="text-[14px] font-black leading-tight truncate" style={{ color: 'var(--color-text)' }}>Unlimited {mode.title}</div>
          <div className="text-[11px] font-bold leading-tight" style={{ color: 'var(--color-text-muted)' }}>Fresh puzzles, no waiting</div>
          {otherGames && <div className="mt-0.5">{otherGames}</div>}
        </div>
        {action('md')}
      </div>
      {/* BA1: under 700 px tall the card is gone — UnlimitedChip on its own line instead. */}
      {/* R2 on short phones (700–740 px tall): one 48 px row — the small U art,
          "Unlimited <Game>", "Other games" after an unlimited game, the button —
          so the finished board keeps ~30 px more. */}
      <div
        className={`w-full max-w-[400px] mx-auto ${compact ? 'flex' : 'hidden'} [@media(max-height:739.98px)]:flex [@media(max-height:699.98px)]:!hidden items-center gap-2 overflow-hidden ${className}`}
        style={{ ...surface, borderRadius: 16, height: 48, padding: '4px 8px 0 6px' }}
        role="group"
        aria-label={`Keep playing: Unlimited ${mode.title}`}
      >
        <UnlimitedLoopArt size={36} />
        <div className="flex-1 min-w-0 text-[13px] font-black leading-tight truncate" style={{ color: 'var(--color-text)' }}>Unlimited {mode.title}</div>
        {otherGames}
        {action('sm')}
      </div>
    </>
  );
}

/**
 * BA1 (founder 10-02, phones under 700 px tall): the Unlimited card collapses
 * to ONE small (~38 px) peach candy — the mini U loop + "Unlimited" — on its
 * own slim line right under the action row (Android parity), doing exactly
 * what the card's button does; free + guest players keep the PRO pill and
 * Go Pro. FinishedDock shows that line only under 700 px tall (CSS).
 */
export function UnlimitedChip({ currentMode, onNewPuzzle }: { currentMode: string; onNewPuzzle?: () => void }) {
  const { isProActive, loading } = useAuth();
  const mode = PROFILE_MODES.find((m) => m.dbKey === currentMode);
  const href = unlimitedHref(currentMode, MODE_ROUTES);
  if (loading || !mode || !href) return null;
  const [w, h] = ART_SIZE[LOOP];
  const icon = (
    <Image src={artSrc(LOOP)} alt="" aria-hidden width={w} height={h} sizes="22px" draggable={false}
      className="shrink-0 select-none pointer-events-none" style={{ width: 22, height: 'auto', aspectRatio: `${w} / ${h}` }} />
  );
  // ~38 px tall: the small candy at a 34 px face + its 4 px lip.
  const look = { ['--candy-h' as string]: '34px', ['--candy-lip-h' as string]: '4px' } as React.CSSProperties;
  if (isProActive && onNewPuzzle) {
    return <CandyButton color="peach" size="sm" icon={icon} onClick={onNewPuzzle} style={look} aria-label={`New ${mode.title} puzzle`}>Unlimited</CandyButton>;
  }
  if (isProActive) {
    return <CandyLink href={href} native color="peach" size="sm" icon={icon} style={look} aria-label={`Play Unlimited ${mode.title}`}>Unlimited</CandyLink>;
  }
  // Free + guest: the PRO pill, and the tap opens Go Pro (as the card did).
  return (
    <CandyButton color="peach" size="sm" icon={icon} trailing={<ProPill />} style={look} aria-label={`Play Unlimited ${mode.title} with Pro`}
      onClick={() => openGoProPopup({ afterPurchaseHref: href, reason: `Unlimited ${mode.title}` })}>
      Unlimited
    </CandyButton>
  );
}

// ── R2: the action dock ───────────────────────────────────────────────────

const DAILY_ORDER: Array<{ id: string; href: string }> = SWEEP_MODES
  .map((m) => ({ id: m.dbKey as string, href: dailyHref(m.dbKey as string) ?? '/' }));

/**
 * R2: the action dock, the last thing in the finished screen's flex column
 * (so it sits just above the tab bar, never scrolled away): the 3D share icon
 * + the primary candy (daily: the next unplayed daily, else this game's
 * Leaderboard; unlimited: none — the Unlimited card's NEW PUZZLE is the
 * primary) + the Unlimited card (Pro). `extra` (a rank badge, Play again for
 * games that keep it) rides beside the share icon.
 */
export function FinishedDock({ currentMode, isDaily, onShare, copied, onNewPuzzle, extra, className = '', compactUnlimited = false }: {
  currentMode: string;
  isDaily: boolean;
  onShare?: () => void;
  copied?: boolean;
  /** Unlimited games: start a fresh puzzle in place (the card's NEW PUZZLE, Pro). */
  onNewPuzzle?: () => void;
  extra?: ReactNode;
  className?: string;
  /** One-screen audit: the 48 px Unlimited row on every phone (OctoWord's 8 boards need the room). */
  compactUnlimited?: boolean;
}) {
  const { todayDailies } = useDailyCompletions();
  const mode = PROFILE_MODES.find((m) => m.dbKey === currentMode);
  const next = isDaily ? DAILY_ORDER.find((m) => m.id !== currentMode && !todayDailies.has(m.id)) : undefined;
  const nextMode = next ? PROFILE_MODES.find((m) => m.dbKey === next.id) : undefined;
  return (
    <div className={`shrink-0 w-full max-w-[400px] mx-auto flex flex-col gap-2 pt-2 ${className}`} style={{ paddingBottom: 6 }}>
      {/* AT1: the primary buttons sit centered on the SCREEN; the share icon is
          pinned to the trailing edge and the rank badge (extra) to the leading
          one, in equal side columns, so neither pushes the row sideways. */}
      {(() => {
        const hasCenter = isDaily && (!!(nextMode && next) || !!mode);
        const share = onShare ? <ShareGlyph onShare={onShare} copied={copied} /> : null;
        if (!hasCenter) {
          return (share || extra) ? <div className="flex items-center justify-center gap-2">{extra}{share}</div> : null;
        }
        return (
          <div className="grid items-center gap-2" style={{ gridTemplateColumns: share || extra ? 'minmax(44px, 1fr) minmax(0, 3.4fr) minmax(44px, 1fr)' : 'minmax(0, 1fr)' }}>
            {(share || extra) && <div className="flex items-center justify-start min-w-0">{extra}</div>}
            <div className="flex items-center gap-2 min-w-0">
              {isDaily && (
                nextMode && next ? (
                  <CandyLink href={next.href} color="amber" size="md" block icon="arrow" className="flex-1 min-w-0" aria-label={`Next Daily: ${nextMode.title}`}>
                    Next: {nextMode.shortTitle ?? nextMode.title}
                  </CandyLink>
                ) : mode ? (
                  <CandyLink href={`/daily?mode=${currentMode}`} color="purple" size="md" block icon={<Icon3D name="trophy" size={20} />} className="flex-1 min-w-0" aria-label={`View ${mode.title} Leaderboard`}>
                    Leaderboard
                  </CandyLink>
                ) : null
              )}
              {isDaily && nextMode && mode && (
                <CandyLink href={`/daily?mode=${currentMode}`} color="purple" size="round" icon={<Icon3D name="trophy" size={20} />} aria-label={`View ${mode.title} Leaderboard`} />
              )}
            </div>
            {(share || extra) && <div className="flex items-center justify-end">{share}</div>}
          </div>
        );
      })()}
      {/* BA1: under 700 px tall, the Unlimited card's place is this one slim line. */}
      <div className="hidden [@media(max-height:699.98px)]:flex justify-center">
        <UnlimitedChip currentMode={currentMode} onNewPuzzle={isDaily ? undefined : onNewPuzzle} />
      </div>
      <UnlimitedCard currentMode={currentMode} onNewPuzzle={isDaily ? undefined : onNewPuzzle} compact={compactUnlimited} />
    </div>
  );
}

