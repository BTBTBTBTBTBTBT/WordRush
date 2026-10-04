'use client';

import { HeadingArt } from '@/components/ui/heading-art';
import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Icon3D } from '@/components/ui/icon3d';
import { SoftNum } from '@/components/ui/soft-number';
import { CandyButton, CandyIcon, CandyLink } from '@/components/ui/candy-button';
import { CastButton, CastLink, castNaturalWidth, castRowMin } from '@/components/ui/cast-button';
import { useAuth } from '@/lib/auth-context';
import { useDailyCompletions } from '@/lib/daily-completions-context';
import { PROFILE_MODES } from '@/components/profile/mode-picker';
import { SWEEP_MODES } from '@/lib/modes.generated';
import { dailyHref, MODE_ROUTES } from '@/lib/mode-routes';
import { ART_SIZE, artSrc } from '@/lib/art';
import { SOFT_INK, darken, softBackground, softBorder, softPill, softShadow } from '@/lib/soft-surface';
import { ClockGlyph } from './result-line';
import { fitScale, formatNextDailyIn, unlimitedHref } from '@/lib/finished-layout';
import { getSecondsUntilMidnightLocal } from '@/lib/play-limit-service';
import { openGoProPopup } from '@/lib/payment/go-pro-popup';

// The one-screen finished screen (docs/FINISH_SPEC.md R2) and the Unlimited
// card (R3). Every game's finished screen reads, top → bottom: its header, a
// compact one-line ResultStrip (badge · guesses · time · points), the board(s)
// in a FitBox that scales them to whatever height is left, then the
// FinishedDock — the "Share results" candy (+ the next-daily countdown) + the
// primary candy (Next daily / Leaderboard) + the Unlimited card for Pro. The
// whole block sits vertically centered in the room (useBlockCentering). Extras
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
        {/* BJ16: SOLVED! / NOT TODAY lettering by result (the chips carry the counts; the text stays the label). */}
        <HeadingArt slug={won ? 'solved' : 'nottoday'} label={headline ?? (won ? 'Solved!' : 'Not today')} height={36} />
      </div>
    )}
    <div className="w-full flex items-center justify-center gap-1.5 flex-nowrap overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
      <span className="sr-only">{srText}</span>
      <Icon3D name={won ? 'badge-w' : 'badge-l'} size={24} label={won ? 'Won' : 'Lost'} />
      {guesses != null && <StripChip accent="#7c3aed" icon={<Icon3D name="badge-check" size={18} />} value={guesses} label={guessLabel} />}
      {time && <StripChip accent="#2563eb" icon={<ClockGlyph size={17} />} value={time} label="time" />}
      {points != null && <StripChip accent="#f5a524" icon={<Icon3D name="trophy" size={17} />} value={Math.round(points).toLocaleString()} label="pts" />}
      {/* Founder 10-02: an invisible twin of the leading W / L badge, so the chips sit on the screen's center line. */}
      <span aria-hidden="true" className="shrink-0" style={{ width: 24, height: 24 }} />
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
export function FitBox({ children, className = '', style, minScale = 0.4, onSlack }: {
  children: ReactNode; className?: string; style?: React.CSSProperties; minScale?: number;
  /** Founder 10-02 (centered finished screens): the board sits vertically centered in the box and this gets the unused height (px). */
  onSlack?: (px: number) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const slackRef = useRef(onSlack);
  slackRef.current = onSlack;
  const centered = !!onSlack;
  useLayoutEffect(() => {
    const box = boxRef.current;
    const inner = innerRef.current;
    if (!box || !inner || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      // The natural size: scrollWidth/Height are unaffected by the transform.
      const s = fitScale({ width: box.clientWidth, height: box.clientHeight }, { width: inner.scrollWidth, height: inner.scrollHeight }, minScale);
      setScale(s);
      slackRef.current?.(Math.max(0, box.clientHeight - inner.scrollHeight * Math.min(1, s)));
    };
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    ro.observe(inner);
    measure();
    return () => ro.disconnect();
  }, [minScale]);
  return (
    <div ref={boxRef} className={`relative flex-1 min-h-0 w-full flex justify-center overflow-hidden ${centered ? 'items-center' : ''} ${className}`} style={style}>
      <div ref={innerRef} className={centered ? 'shrink-0' : undefined} style={{ transform: scale < 1 ? `scale(${scale})` : undefined, transformOrigin: centered ? 'center center' : 'top center', width: '100%' }}>
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
    <CastButton color="peach" size={size} icon="replay" onClick={newPuzzle} className="shrink-0">New puzzle</CastButton>
  ) : isProActive ? (
    <CastLink href={href} native color="peach" size="sm" icon="play" className="shrink-0" aria-label={`Play Unlimited ${mode.title}`}>Play</CastLink>
  ) : (
    <CastButton
      color="peach"
      size="sm"
      icon="play"
      trailing={<ProPill />}
      className="shrink-0"
      aria-label={`Play Unlimited ${mode.title} with Pro`}
      onClick={() => openGoProPopup({ afterPurchaseHref: href, reason: `Unlimited ${mode.title}` })}
    >
      Play
    </CastButton>
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
    return <CastButton color="peach" size="sm" icon={icon} onClick={onNewPuzzle} style={look} aria-label={`New ${mode.title} puzzle`}>Unlimited</CastButton>;
  }
  if (isProActive) {
    return <CastLink href={href} native color="peach" size="sm" icon={icon} style={look} aria-label={`Play Unlimited ${mode.title}`}>Unlimited</CastLink>;
  }
  // Free + guest: the PRO pill, and the tap opens Go Pro (as the card did).
  return (
    <CastButton color="peach" size="sm" icon={icon} trailing={<ProPill />} style={look} aria-label={`Play Unlimited ${mode.title} with Pro`}
      onClick={() => openGoProPopup({ afterPurchaseHref: href, reason: `Unlimited ${mode.title}` })}>
      Unlimited
    </CastButton>
  );
}

// ── Founder 10-02: the centered block, the share CTA + next-daily countdown ─

/**
 * Centers a finished screen's block (strip + board + dock + More) in its
 * column: the board box is the flex-1 room, the board sits centered in it, and
 * the unused height (`onSlack`) is taken back by shifting the strip down and
 * the dock + More up by half — so the extra room splits equally above and
 * below. Transforms only (no layout change), so the board's own measuring
 * never feeds back.
 */
export function useBlockCentering() {
  const [shift, setShift] = useState(0);
  const onSlack = useCallback((slack: number) => {
    const s = Math.max(0, Math.floor(slack / 2));
    setShift((prev) => (prev === s ? prev : s));
  }, []);
  const down: React.CSSProperties | undefined = shift ? { transform: `translateY(${shift}px)` } : undefined;
  const up: React.CSSProperties | undefined = shift ? { transform: `translateY(${-shift}px)` } : undefined;
  return { onSlack, down, up };
}

/** "3h 12m" until the next daily (local midnight), refreshed every 30 s; null until mounted, so the server HTML never disagrees with the client clock. */
function useNextDailyIn(on: boolean): string | null {
  const [left, setLeft] = useState<string | null>(null);
  useEffect(() => {
    if (!on) return;
    const update = () => setLeft(formatNextDailyIn(getSecondsUntilMidnightLocal()));
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, [on]);
  return on ? left : null;
}


/**
 * The finished screen's share CTA (founder 10-02, every game): a pink "Share
 * results" candy IN the dock's action row (beside Next daily / Leaderboard) —
 * no row of its own and no taller than the row's other 40 px candies — doing
 * exactly what the old 3D share icon did (the game's own handler, chooser
 * included). On a DAILY the "Next <Game> in 3h 12m" countdown rides inside it
 * as a small second line (the glyph steps aside for it); under 700 px tall the
 * countdown is dropped and the label sits alone with its glyph.
 */
export function ShareResultsCandy({ onShare, copied = false, countdownFor, className = '', rowItem = false }: {
  onShare: () => void; copied?: boolean;
  /** The game's title for the countdown line (dailies only); undefined = no line. */
  countdownFor?: string;
  className?: string;
  /** BJ17: a `.cast-row` item — shares the line, never narrower than its label at the normal cap. */
  rowItem?: boolean;
}) {
  const left = useNextDailyIn(!!countdownFor);
  const line = countdownFor && left && !copied ? { game: countdownFor, left } : null;
  const glyph = <CandyIcon name={copied ? 'check' : 'share'} size={16} />;
  // BJ15 round 2: the countdown is a small muted caption UNDER the button (never squeezed into the
  // skin with the label art); the button keeps the normal cap height.
  return (
    <div className={`flex flex-col items-center min-w-0 ${rowItem ? 'cast-row-flex' : ''} ${className}`}
      style={rowItem ? castRowMin(castNaturalWidth(copied ? 'Copied!' : 'Share results', 'md', 16)) : undefined}>
      <CastButton
        color="pink" size="md" block
        icon={glyph}
        onClick={onShare}
        aria-label={copied ? 'Copied' : line ? `Share results. Next ${line.game} in ${line.left}` : 'Share results'}
      >
        {copied ? 'Copied!' : 'Share results'}
      </CastButton>
      {line && (
        // The game name gives way first, so the time always shows.
        <span className="flex max-w-full min-w-0 mt-[3px] text-[11px] leading-[13px] font-extrabold [@media(max-height:699.98px)]:hidden"
          style={{ color: 'var(--color-text-muted, #6f5f8f)' }} aria-hidden="true">
          <span className="shrink-0 whitespace-pre">Next </span>
          <span className="min-w-0 truncate">{line.game}</span>
          <span className="shrink-0 whitespace-pre"> in {line.left}</span>
        </span>
      )}
    </div>
  );
}

// ── R2: the action dock ───────────────────────────────────────────────────

const DAILY_ORDER: Array<{ id: string; href: string }> = SWEEP_MODES
  .map((m) => ({ id: m.dbKey as string, href: dailyHref(m.dbKey as string) ?? '/' }));

/**
 * R2: the action dock, the last thing in the finished screen's flex column
 * (so it sits just above the tab bar, never scrolled away): ONE 40 px action
 * row — the "Share results" candy (founder 10-02; on a daily the next-daily
 * countdown rides inside it) + the primary candy (daily: the next unplayed
 * daily, else this game's Leaderboard; unlimited: none — the Unlimited card's
 * NEW PUZZLE is the primary) + the round Leaderboard — then the Unlimited card
 * (Pro). The row spans the dock, so it is centered on the screen. `extra` (a
 * rank badge) rides on a slim centered line above it.
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
  // BJ17: the row is a .cast-row — Share + the primary split it at their normal cap height, or
  // wrap to full-width lines when a label can't fit (never one squeezed beside a full-size one).
  // The next-daily candy and its round Leaderboard travel together as one row item.
  const nextLabel = nextMode ? `Next: ${nextMode.shortTitle ?? nextMode.title}` : '';
  const primary = isDaily && (nextMode && next && mode ? (
    <div className="cast-row-flex flex items-center gap-2" style={castRowMin(castNaturalWidth(nextLabel, 'md', 16) + 48)}>
      <CastLink href={next.href} color="amber" size="md" block icon={<CandyIcon name="arrow" size={16} />} className="flex-1 min-w-0" aria-label={`Next Daily: ${nextMode.title}`}>
        {nextLabel}
      </CastLink>
      <CandyLink href={`/daily?mode=${currentMode}`} color="purple" size="round" icon={<Icon3D name="trophy" size={20} />} aria-label={`View ${mode.title} Leaderboard`} />
    </div>
  ) : nextMode && next ? (
    <CastLink href={next.href} color="amber" size="md" block icon={<CandyIcon name="arrow" size={16} />} className="cast-row-flex" style={castRowMin(castNaturalWidth(nextLabel, 'md', 16))} aria-label={`Next Daily: ${nextMode.title}`}>
      {nextLabel}
    </CastLink>
  ) : mode ? (
    <CastLink href={`/daily?mode=${currentMode}`} color="purple" size="md" block icon={<Icon3D name="trophy" size={18} />} className="cast-row-flex" style={castRowMin(castNaturalWidth('Leaderboard', 'md', 18))} aria-label={`View ${mode.title} Leaderboard`}>
      Leaderboard
    </CastLink>
  ) : null);
  const share = onShare ? (
    <ShareResultsCandy onShare={onShare} copied={copied} countdownFor={isDaily ? mode?.title : undefined}
      // Alone (an Unlimited result) it hugs its label; beside Next / Leaderboard it is a cast-row item.
      rowItem={!!primary} className={primary ? '' : '!w-auto max-w-full'} />
  ) : null;
  return (
    <div className={`shrink-0 w-full max-w-[400px] mx-auto flex flex-col gap-2 pt-2 ${className}`} style={{ paddingBottom: 6 }}>
      {extra && <div className="flex items-center justify-center min-w-0">{extra}</div>}
      {/* AT1 + founder 10-02: one row, spanning the dock, so the group is centered on the SCREEN. */}
      {(share || primary) && (
        <div className="cast-row">
          {share}
          {primary}
        </div>
      )}
      {/* BA1: under 700 px tall, the Unlimited card's place is this one slim line. */}
      <div className="hidden [@media(max-height:699.98px)]:flex justify-center">
        <UnlimitedChip currentMode={currentMode} onNewPuzzle={isDaily ? undefined : onNewPuzzle} />
      </div>
      <UnlimitedCard currentMode={currentMode} onNewPuzzle={isDaily ? undefined : onNewPuzzle} compact={compactUnlimited} />
    </div>
  );
}

