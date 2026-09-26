'use client';

import { LayoutGrid, Sparkles, Trophy, Check } from 'lucide-react';
import { MORE_GAMES_BAND_ID } from './more-games-sheet';
import type { DailyCompletion } from '@/lib/daily-service';
import { morePlayedCount, morePlayedText, moreSweepTier, moreDailyModes, computeMoreTotals, MORE_SWEEP_COPY } from '@/lib/more-games';
import type { ModeMeta } from '@/lib/modes.generated';
import { MODE_CHROME } from './mode-chrome';
import type { HomeCard } from './mode-chrome';

// The More Games band (founder + JP, 2026-09-26): a full-width tile directly
// UNDER the game grid — indigo accent, the ten small game icons in catalog
// order, "N of 10 played" — so nobody hunts for the extra games but the page
// still opens on the Daily Challenge and the eight word games. No chevron
// (founder, 2026-09-26): the whole band is the button, and the sheet GROWS out
// of it (more-games-sheet.tsx finds this element by MORE_GAMES_BAND_ID).
//
// It is also the More Games "hero": when every More Games daily is played it
// fills indigo ("MORE GAMES SWEEP!"); when every one is won it takes the gold
// Flawless treatment ("FLAWLESS MORE GAMES!"). Purely visual — derived from
// today's completions, never a bonus row, XP or a leaderboard. Tap opens the
// sheet; the Share button (sweep states only) shares the More Games card.

interface Props {
  card: HomeCard;
  /** The More Games titles visible to this viewer (catalog ∩ remote flags). */
  modes: ModeMeta[];
  playMode: 'daily' | 'unlimited';
  todayDailies: Map<string, DailyCompletion>;
  onOpen: () => void;
  onShare: () => void;
}

const INDIGO = '#4f46e5';

export function MoreGamesBand({ card, modes, playMode, todayDailies, onOpen, onShare }: Props) {
  const daily = moreDailyModes(modes);
  const played = morePlayedCount(todayDailies.keys(), modes);
  const tier = playMode === 'daily' ? moreSweepTier(todayDailies, modes) : null;
  const gold = tier === 'flawless';
  const totals = tier ? computeMoreTotals(todayDailies, modes) : null;
  const totalTime = totals ? `${Math.floor(totals.totalTimeSeconds / 60)}:${String(totals.totalTimeSeconds % 60).padStart(2, '0')}` : '';

  const background = tier
    ? gold ? 'linear-gradient(135deg, #fef3c7, #fde68a)' : `linear-gradient(135deg, ${INDIGO}, #6366f1)`
    : 'var(--color-surface)';
  const border = tier
    ? gold ? '1.5px solid #f59e0b' : `1.5px solid ${INDIGO}`
    : 'var(--color-border)';
  const titleColor = tier ? (gold ? '#92400e' : '#ffffff') : 'var(--color-text)';
  const subColor = tier ? (gold ? '#b45309' : '#e0e7ff') : 'var(--color-text-muted)';
  const subtitle = tier && totals
    ? `All ${totals.total} ${gold ? 'won' : 'played'} · ${totalTime} · ${totals.totalScore.toLocaleString()} pts`
    : playMode === 'daily' ? morePlayedText(played.played, played.total) : card.desc;

  return (
    <div
      id={MORE_GAMES_BAND_ID}
      className="relative w-full shrink-0 overflow-hidden"
      style={{ background, border: tier ? border : `1.5px solid ${border}`, borderRadius: '14px' }}
      role="group"
      aria-label={tier ? MORE_SWEEP_COPY[tier].short : 'More Games'}
    >
      {tier && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="animate-foil-sweep absolute top-0 h-full" style={{ width: '40%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)' }} />
        </div>
      )}
      {/* Left accent bar (the grid cards wear theirs on top; a wide tile reads better with it on the left). */}
      {!tier && <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: `linear-gradient(180deg, ${INDIGO}, ${INDIGO}88)` }} />}

      <button
        type="button"
        onClick={onOpen}
        className="relative w-full flex items-center gap-3 px-3 py-2.5 text-left transition-transform active:scale-[0.98]"
        aria-label="Open More Games"
      >
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: tier ? 'rgba(255,255,255,0.25)' : `${INDIGO}15` }}
        >
          {gold
            ? <Trophy className="w-5 h-5" style={{ color: '#b45309' }} fill="currentColor" />
            : tier
            ? <Sparkles className="w-5 h-5" style={{ color: '#ffffff' }} />
            : <LayoutGrid className="w-5 h-5" style={{ color: INDIGO }} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-black leading-tight" style={{ color: titleColor }}>
            {tier ? MORE_SWEEP_COPY[tier].title : card.title}
          </div>
          {/* The ten game icons, catalog order. In a sweep state every tile becomes a check. */}
          <div className="flex items-center gap-1 mt-1 mb-1" aria-hidden="true">
            {daily.map((m) => {
              const Icon = MODE_CHROME[m.id]?.icon ?? null;
              const done = todayDailies.has(m.dbKey as string);
              return (
                <span
                  key={m.id}
                  className="flex items-center justify-center rounded-[5px] shrink-0"
                  style={{
                    width: 18, height: 18,
                    background: tier ? 'rgba(255,255,255,0.9)' : done ? m.accentHex : `${m.accentHex}22`,
                    border: tier ? 'none' : `1px solid ${m.accentHex}55`,
                  }}
                  title={m.title}
                >
                  {tier
                    ? <Check className="w-3 h-3" style={{ color: gold ? '#b45309' : INDIGO }} strokeWidth={3} />
                    : Icon
                    ? <Icon className="w-3 h-3" style={{ color: done ? '#fff' : m.accentHex }} />
                    : <span className="text-[9px] font-black" style={{ color: done ? '#fff' : m.accentHex }}>{m.glyph ?? m.shortTitle[0]}</span>}
                </span>
              );
            })}
          </div>
          <div className="text-[10px] font-bold leading-tight" style={{ color: subColor }}>{subtitle}</div>
        </div>
      </button>

      {tier && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onShare(); }}
          className="absolute top-2 right-3 text-[10px] font-black px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(255,255,255,0.85)', color: gold ? '#b45309' : INDIGO }}
        >
          Share
        </button>
      )}
    </div>
  );
}
