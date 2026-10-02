'use client';

import { useEffect, useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { Icon3D, type Icon3DName } from '@/components/ui/icon3d';
import { GameArt } from '@/components/ui/game-art';
import { isGameArtIcon, onPageShadow } from '@/lib/art';
import { SOFT, accentInk, alphaHex, overAlpha, softBackground } from '@/lib/soft-surface';
import { formatGuessStat, formatShortTime } from '@/lib/format';
import type { DailyCompletion } from '@/lib/daily-service';
import type { HomeCard } from './mode-chrome';
import { modeCardSlots } from '@/lib/stationary-layout';

// The home-grid mode card, extracted verbatim from app/page.tsx (More Games
// Stage 5) so the More Games sheet renders the SAME card pixel for pixel. The
// markup below is the grid's; only the inputs are now props. §255's fixed
// two-line subtitle box is kept so Daily⇄Unlimited never reflows the grid.

export type CardBadge = 'W' | 'L' | '✓' | null;

/** The 3D completion badge for a card badge (docs/ART_SPEC.md §4). */
export const BADGE_ICON: Record<'W' | 'L' | '✓', Icon3DName> = { W: 'badge-w', L: 'badge-l', '✓': 'badge-check' };
const BADGE_LABEL: Record<'W' | 'L' | '✓', string> = { W: 'Won', L: 'Lost', '✓': 'Played' };

export interface ModeCardState {
  isDailyDone: boolean;
  isLocked: boolean;
  badge: CardBadge;
  subtitle: string;
}

/**
 * Everything the card needs to know, derived once so the grid and the sheet
 * cannot disagree. `dailyResult` is today's row for this mode (Daily mode
 * only); `vsWon` is the daily-VS outcome for the VS card; `playedToday` is
 * the play-limit cache's answer; `subtitleOverride` is the More Games tile's
 * "N of M played" line, which replaces the description and never locks.
 */
export function modeCardState(args: {
  card: HomeCard;
  playMode: 'daily' | 'unlimited';
  dailyResult?: DailyCompletion;
  vsWon?: boolean | null;
  playedToday: boolean;
  isPro: boolean;
  signedIn: boolean;
  resetCountdownText: string;
  subtitleOverride?: string | null;
}): ModeCardState {
  const { card, playMode, dailyResult, vsWon, playedToday, isPro, signedIn, resetCountdownText, subtitleOverride } = args;
  if (subtitleOverride != null) {
    return { isDailyDone: false, isLocked: false, badge: null, subtitle: subtitleOverride };
  }
  const isVs = card.id === 'vs';
  // VS has no daily_results row; reflect its completed state from the
  // play-limit cache so the card shows "played" like other modes.
  const isDailyDone = !!dailyResult || (isVs && playMode === 'daily' && (vsWon != null || playedToday));
  // Freemium users: lock card once the daily is done OR the play-limit cache
  // says played. isDailyDone covers modes whose play-limit modeId was
  // recorded under the wrong key.
  const isLocked = !isPro && signedIn && (isDailyDone || playedToday);
  const badge: CardBadge = !isDailyDone ? null
    : dailyResult ? (dailyResult.won ? 'W' : 'L')
    : vsWon != null ? (vsWon ? 'W' : 'L')
    : '✓';
  const subtitle = isDailyDone
    ? (dailyResult
        ? `${formatGuessStat(card.guessSemantics, card.guessBase, dailyResult.guesses)} · ${formatShortTime(dailyResult.timeSeconds)}`
        : 'Played today')
    : isLocked
    ? `Play again in ${resetCountdownText}`
    : card.desc;
  return { isDailyDone, isLocked, badge, subtitle };
}

/**
 * The §18.2 card's measures (docs/ART_SPEC.md): 10 px band, 52 px icon, name 900 / 16, description 12.5.
 * §21: `titleLine` is the name's line box (16 × leading-tight), the row the badge centers on;
 * `descLine` the subtitle's line height; `padX` / `padY` the inner padding. The Word of the Day
 * and VS Battle cards reuse the surface, band and padding (§21.5).
 */
export const MODE_CARD = {
  radius: 18, band: 10, icon: 52, name: 16, nameMin: 11, desc: 12.5,
  titleLine: 20, descLine: 16, badge: 26, padX: 10, padY: 10,
} as const;

/**
 * The game card's surface (§18.2 / §21.5; FINISH_SPEC A1 — no plain white):
 * every card takes a soft wash of its game's accent (≈13% over white) with a
 * 1.5 px accent border (≈32%), radius 18 and the page's tinted shadow. A
 * finished daily gets a stronger wash and an accent border so "played" still
 * reads; a locked card a gray wash and border. Shared with the Word of the Day
 * and VS Battle cards so all of Home is one card style. Dark mode keeps the
 * dark surface under the wash (--color-card-base).
 */
export function modeCardSurface(accent: string, { done = false, locked = false }: { done?: boolean; locked?: boolean } = {}): CSSProperties {
  const share = done ? 0.2 : SOFT.tint;
  return {
    background: locked ? softBackground('#9ca3af', SOFT.tint) : softBackground(accent, share),
    border: `1.5px solid ${locked ? '#d1d5db' : done ? `${accent}66` : alphaHex(accent, overAlpha(SOFT.line, share))}`,
    borderRadius: MODE_CARD.radius,
    // §11: lifts off the page tint with the page's tinted shadow.
    boxShadow: onPageShadow(),
  };
}

/** The colored top band in the card's accent, rounded with the card (the card clips it). */
export function ModeCardBand({ accent, locked = false }: { accent: string; locked?: boolean }) {
  return (
    <div
      aria-hidden="true"
      style={{
        height: MODE_CARD.band,
        background: locked ? '#d1d5db' : `linear-gradient(90deg, ${accent}, ${accent}cc)`,
      }}
    />
  );
}

/**
 * The slot at the right end of a card's title line (§21.1): the 3D badge (or
 * lock) at its own size, vertically centered on the name's line
 * box, without making the line taller (the art overflows the box evenly).
 */
export function TitleLineSlot({ children, line = MODE_CARD.titleLine }: { children: ReactNode; line?: number }) {
  return (
    <span className="shrink-0 flex items-center justify-center" style={{ height: line, minWidth: MODE_CARD.badge }}>
      {children}
    </span>
  );
}

/**
 * `unlimited`: Pro's Unlimited mode (home redesign, 2026-10-01): no badges. FINISH_SPEC Y: no infinity
 * mark; Z: the title-line slot and the two-line subtitle box exist in both modes (empty when a mode has
 * nothing for them), so Daily ⇄ Unlimited never moves or resizes a card (lib/stationary-layout.ts).
 *
 * Layout (ART_SPEC §18.2 + §21): a white card, radius 18, with a thick 10 px
 * band in the game's accent across its rounded top; then a row: the glossy
 * game icon at 52 px (no chip box) and a text column exactly as tall as the
 * icon, pinned to it: the game name in its accent (900, 16; shrinks to fit a
 * long single word) at the icon's top, the description / result line
 * (secondary ink, 12.5, two lines max) sitting on the icon's bottom edge. The
 * 3D W / L / ✓ badge sits at the right end of the title line (the lock takes
 * the same slot). No disclosure chevron (§21.4). A text
 * block taller than the icon grows the card and the icon stays centered on it.
 */
export function ModeCard({ card, state, unlimited = false }: { card: HomeCard; state: ModeCardState; unlimited?: boolean }) {
  const { isDailyDone, isLocked, badge, subtitle } = state;
  const Icon = card.icon;
  // The old glyph (lucide / custom / roman numeral), drawn only when the art is missing.
  const glyph = Icon && isGameArtIcon(Icon)
    ? null
    : card.romanNumeral
    ? <span className="text-[18px] font-black leading-none" style={{ color: card.accentColor }}>{card.romanNumeral}</span>
    : Icon
    ? <Icon className="w-7 h-7" style={{ color: card.accentColor }} />
    : null;
  // One slot at the end of the title line: the W / L / ✓ badge once today's
  // daily is on the books (§4: 26 px); otherwise the lock; Unlimited leaves it empty.
  const slot = unlimited ? null
    : isDailyDone && badge
    ? <Icon3D name={BADGE_ICON[badge]} size={MODE_CARD.badge} label={BADGE_LABEL[badge]} />
    : isLocked
    ? <Icon3D name="lock" size={15} label="Locked" />
    : null;
  const slots = modeCardSlots(unlimited ? 'unlimited' : 'daily');
  return (
    <div
      data-squish="card"
      className={`relative cursor-pointer overflow-hidden ${isLocked ? 'opacity-60' : ''}`}
      style={modeCardSurface(card.accentColor, { done: isDailyDone, locked: isLocked })}
    >
      {/* Thick top band in the game's accent (§18.2), rounded with the card. */}
      <ModeCardBand accent={card.accentColor} locked={isLocked} />

      <div
        className="flex items-center gap-2"
        style={{ padding: `${MODE_CARD.padY}px ${MODE_CARD.padX}px`, minHeight: 84 - MODE_CARD.band }}
      >
        {/* Icon — the game's art when daily is done (even if locked); the lock
            only when locked without a result. */}
        <div className="shrink-0 flex items-center justify-center" style={{ width: MODE_CARD.icon, height: MODE_CARD.icon }}>
          {(isLocked && !isDailyDone)
            ? <Icon3D name="lock" size={30} />
            : <GameArt id={card.id} size={MODE_CARD.icon} fallback={glyph} />}
        </div>
        {/* §21.2: the text column spans the icon — title on its top edge, the
            subtitle's last line on its bottom edge. Title line (20) + two
            subtitle lines (32) = the icon's 52, so a wrapping description
            fills it exactly and Daily ⇄ Unlimited never reflows the grid
            (§255); a one-line result just sits at the bottom. */}
        <div className="flex-1 min-w-0 flex flex-col justify-between" style={{ minHeight: MODE_CARD.icon }} data-testid="mode-card-text">
          <div className="flex items-start gap-1">
            <div className="flex-1 min-w-0">
              <FitName color={isLocked ? 'var(--color-text-muted)' : null} accent={card.accentColor}>{card.title}</FitName>
            </div>
            {/* Z: the slot is always there (empty in Unlimited / before a result) so the name never reflows. */}
            <span className="shrink-0" style={{ width: slots.titleSlotWidth }}>
              {slot && <TitleLineSlot>{slot}</TitleLineSlot>}
            </span>
          </div>
          {/* Z: a fixed two-line box; a one-line result sits on its bottom line. */}
          <div className="flex flex-col justify-end" style={{ height: slots.descHeight }}>
            <div
              key={unlimited ? 'u' : 'd'}
              className="font-semibold mode-xfade"
              style={{ fontSize: MODE_CARD.desc, color: 'var(--color-text-secondary)', lineHeight: `${MODE_CARD.descLine}px`, maxHeight: MODE_CARD.descLine * 2,
                       overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}
            >
              {subtitle}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * The game name at 900 / 16 in its color, wrapping at spaces (Letter Ladder),
 * and shrinking (down to 11) only when one word is wider than the column
 * (Crosswordocious on a phone).
 */
function FitName({ color, accent, children }: { color: string | null; accent: string; children: string }) {
  const ref = useRef<HTMLDivElement>(null);
  // The accent name stays legible on the dark card: the accent itself on
  // light, its pastel on dark (deep accents like #1e40af vanish on #252542).
  const ink = color == null ? accentInk(accent, accent) : null;
  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let lastWidth = -1;
    const fit = () => {
      const width = el.clientWidth;
      if (width === lastWidth) return;
      lastWidth = width;
      let size: number = MODE_CARD.name;
      el.style.overflowWrap = 'normal';
      el.style.fontSize = `${size}px`;
      while (size > MODE_CARD.nameMin && el.scrollWidth > width + 0.5) {
        size -= 0.5;
        el.style.fontSize = `${size}px`;
      }
      // Still too wide at the floor (a very narrow screen): let the word break.
      if (el.scrollWidth > width + 0.5) el.style.overflowWrap = 'anywhere';
    };
    fit();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [children]);
  return (
    <div
      ref={ref}
      className={`font-black leading-tight ${ink?.className ?? ''}`}
      style={{ fontSize: MODE_CARD.name, ...(ink ? ink.style : { color: color ?? undefined }) }}
    >
      {children}
    </div>
  );
}
