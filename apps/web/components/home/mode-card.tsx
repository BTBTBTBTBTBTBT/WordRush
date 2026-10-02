'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import { ChevronRight, Infinity as InfinityIcon } from 'lucide-react';
import { Icon3D, type Icon3DName } from '@/components/ui/icon3d';
import { GameArt } from '@/components/ui/game-art';
import { isGameArtIcon, onPageShadow } from '@/lib/art';
import { formatGuessStat, formatShortTime } from '@/lib/format';
import type { DailyCompletion } from '@/lib/daily-service';
import type { HomeCard } from './mode-chrome';

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

/** The §18.2 card's measures (docs/ART_SPEC.md): 10 px band, 52 px icon, name 900 / 16, description 12.5. */
export const MODE_CARD = { radius: 18, band: 10, icon: 52, name: 16, nameMin: 11, desc: 12.5 } as const;

/**
 * `unlimited`: Pro's Unlimited mode (home redesign, 2026-10-01): no badges, a small infinity mark instead.
 *
 * Layout (ART_SPEC §18.2, the founder's ChatGPT mockup): a white card, radius
 * 18, with a thick 10 px band in the game's accent across its rounded top;
 * then a row: the glossy game icon at 52 px (no chip box), the game name in
 * its accent (900, 16; shrinks to fit a long single word) over the one-line
 * description (secondary ink, 12.5, two lines max), and a small chevron.
 * Every state is the same as before: the 3D W / L / ✓ badge in the top-right
 * corner over the band, the Pro lock, the dimmed free-played card, and the
 * result line in place of the description once played.
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
  return (
    <div
      className={`relative cursor-pointer transition-transform active:scale-[0.96] overflow-hidden ${isLocked ? 'opacity-60' : ''}`}
      style={{
        // Completed daily: soft tint in the mode's accent color to signal
        // "you've played this one". Fresh/unplayed cards stay white.
        // (Over the white card, so it stays opaque on the page tint.)
        background: isDailyDone
          ? `linear-gradient(${card.accentColor}0f, ${card.accentColor}0f), var(--color-surface)`
          : 'var(--color-surface)',
        border: `1.5px solid ${isLocked ? '#d1d5db' : isDailyDone ? `${card.accentColor}66` : 'var(--color-border)'}`,
        borderRadius: MODE_CARD.radius,
        // §11: lifts off the page tint with the page's tinted shadow.
        boxShadow: onPageShadow(),
      }}
    >
      {/* Thick top band in the game's accent (§18.2), rounded with the card. */}
      <div
        aria-hidden="true"
        style={{
          height: MODE_CARD.band,
          background: isLocked
            ? '#d1d5db'
            : `linear-gradient(90deg, ${card.accentColor}, ${card.accentColor}cc)`,
        }}
      />

      {/* Lock icon (only when locked but NOT daily-done — the W/L badge
          takes this slot when the daily is complete) */}
      {isLocked && !isDailyDone ? (
        <div className="absolute top-3.5 right-2 flex items-center gap-1">
          <Icon3D name="lock" size={15} label="Locked" />
        </div>
      ) : null}

      {unlimited && !isLocked && (
        <InfinityIcon className="absolute top-3.5 right-2 w-4 h-4" style={{ color: card.accentColor }} aria-hidden="true" />
      )}

      {/* 3D W / L (or ✓) badge in the top-right corner over the band when
          today's daily is already on the books (docs/ART_SPEC.md §4: 26 px). */}
      {isDailyDone && badge && (
        <Icon3D name={BADGE_ICON[badge]} size={26} label={BADGE_LABEL[badge]} className="absolute top-1 right-1.5 z-[1]" />
      )}

      <div className="flex items-center gap-2 pl-2 pr-1.5 py-2.5" style={{ minHeight: 84 - MODE_CARD.band }}>
        {/* Icon — the game's art when daily is done (even if locked); the lock
            only when locked without a result. */}
        <div className="shrink-0 flex items-center justify-center" style={{ width: MODE_CARD.icon, height: MODE_CARD.icon }}>
          {(isLocked && !isDailyDone)
            ? <Icon3D name="lock" size={30} />
            : <GameArt id={card.id} size={MODE_CARD.icon} fallback={glyph} />}
        </div>
        <div className="flex-1 min-w-0">
          <FitName color={isLocked ? 'var(--color-text-muted)' : card.accentColor}>{card.title}</FitName>
          {/* §255: fixed two-line box, so Daily ⇄ Unlimited never reflows the
              grid (the description wraps; "4 guesses · 27s" doesn't). */}
          <div
            className="font-semibold mt-0.5"
            style={{ fontSize: MODE_CARD.desc, color: 'var(--color-text-secondary)', height: 32, lineHeight: '16px', overflow: 'hidden',
                     display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}
          >
            {subtitle}
          </div>
        </div>
        <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--color-text-muted)' }} aria-hidden="true" />
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
function FitName({ color, children }: { color: string; children: string }) {
  const ref = useRef<HTMLDivElement>(null);
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
      className="font-black leading-tight"
      style={{ fontSize: MODE_CARD.name, color }}
    >
      {children}
    </div>
  );
}
