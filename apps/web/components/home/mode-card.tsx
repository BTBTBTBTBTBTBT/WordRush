'use client';

import { Lock } from 'lucide-react';
import { formatGuessStat, formatShortTime } from '@/lib/format';
import type { DailyCompletion } from '@/lib/daily-service';
import type { HomeCard } from './mode-chrome';

// The home-grid mode card, extracted verbatim from app/page.tsx (More Games
// Stage 5) so the More Games sheet renders the SAME card pixel for pixel. The
// markup below is the grid's; only the inputs are now props. §255's fixed
// two-line subtitle box is kept so Daily⇄Unlimited never reflows the grid.

export type CardBadge = 'W' | 'L' | '✓' | null;

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

export function ModeCard({ card, state }: { card: HomeCard; state: ModeCardState }) {
  const { isDailyDone, isLocked, badge, subtitle } = state;
  const Icon = card.icon;
  return (
    <div
      className={`relative px-3 py-3 cursor-pointer transition-transform active:scale-[0.96] overflow-hidden ${isLocked ? 'opacity-60' : ''}`}
      style={{
        // Completed daily: soft tint in the mode's accent color to signal
        // "you've played this one". Fresh/unplayed cards stay white.
        background: isDailyDone ? `${card.accentColor}0f` : 'var(--color-surface)',
        border: `1.5px solid ${isLocked ? '#d1d5db' : isDailyDone ? `${card.accentColor}66` : 'var(--color-border)'}`,
        borderRadius: '14px',
      }}
    >
      {/* Top accent bar */}
      <div
        className="absolute top-0 left-0 right-0 h-1"
        style={{
          background: isLocked
            ? '#d1d5db'
            : `linear-gradient(90deg, ${card.accentColor}, ${card.accentColor}88)`,
          borderRadius: '14px 14px 0 0',
        }}
      />

      {/* Lock icon (only when locked but NOT daily-done — the W/L badge
          takes this slot when the daily is complete) */}
      {isLocked && !isDailyDone ? (
        <div className="absolute top-2.5 right-2.5 flex items-center gap-1">
          <Lock className="w-3 h-3" style={{ color: 'var(--color-text-muted)' }} />
        </div>
      ) : null}

      {/* W / L pill in the top-right when today's daily is already on the books. */}
      {isDailyDone && badge && (
        <div
          className="absolute top-2.5 right-2.5 w-5 h-5 rounded-md flex items-center justify-center"
          style={{ background: badge === 'L' ? '#dc2626' : '#7c3aed' }}
        >
          <span className="text-[10px] font-black text-white leading-none">{badge}</span>
        </div>
      )}

      {/* Icon — show mode icon when daily is done (even if locked), show lock
          only when locked without a result */}
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center mb-1.5"
        style={{ background: (isLocked && !isDailyDone) ? '#f3f4f6' : `${card.accentColor}15` }}
      >
        {(isLocked && !isDailyDone)
          ? <Lock className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
          : card.romanNumeral
          ? <span className="text-[11px] font-black leading-none" style={{ color: card.accentColor }}>{card.romanNumeral}</span>
          : Icon
          ? <Icon className="w-4 h-4" style={{ color: card.accentColor }} />
          : null
        }
      </div>
      <div className="text-[13px] font-black" style={{ color: isLocked ? 'var(--color-text-muted)' : 'var(--color-text)' }}>{card.title}</div>
      {/* §255: fixed two-line box. In Unlimited this line is the description,
          which wraps on several cards; in Daily it's "4 guesses · 27s" on one
          line — so the cards changed height and the whole grid reflowed on
          every Daily/Unlimited toggle (founder). */}
      <div
        className="text-[10px] font-bold"
        style={{ color: 'var(--color-text-muted)', height: '28px', lineHeight: '14px', overflow: 'hidden',
                 display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}
      >
        {subtitle}
      </div>
    </div>
  );
}
