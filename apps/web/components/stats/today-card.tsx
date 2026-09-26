'use client';

import Link from 'next/link';
import { type ReactNode } from 'react';
import { Trophy, Sparkles, Zap, Swords, Flame, TrendingUp, LayoutGrid, Star, Timer } from 'lucide-react';
import type { ModeMeta } from '@/lib/modes.generated';
import { MODE_BY_DBKEY } from '@/lib/modes.generated';
import type { DailyCompletion } from '@/lib/daily-service';
import type { DailyStanding } from '@/lib/stats-service';
import { MODE_CHROME } from '@/components/home/mode-chrome';
import { WIN_FG } from '@/lib/tile-theme';
import { guessNoun } from '@/lib/mode-stats';

// The Stats tab's landing page — "your day in one card" (Stats + Friends
// redesign D2, founder 2026-09-26): the eight sweep tiles with today's W/L,
// then More Games N of 10, VS W/L, today's field standing (ONE formula: the
// leaderboard's (better+1)/total), the sweep streak and a "best moment" line.
// Free tier throughout — today's facts. Pro comparisons ("vs your record")
// live on the game pages. Sweep/Flawless days keep the banner treatment the
// old Today's Dailies card had (the footer is passed in). iOS TodayCard /
// Android TodayCard are the twins.

interface Props {
  sweepModes: Array<{ id: string; href: string }>;
  moreModes: ModeMeta[];
  todayDailies: Map<string, DailyCompletion>;
  vsDailyWon: boolean | null;
  standing: DailyStanding | null;
  sweepStreak: number;
  flawlessStreak: number;
  /** Rendered under the tiles on a Flawless day (the streak + share footer). */
  flawlessFooter?: ReactNode;
  onJump: (key: string) => void;
}

function fmtTime(s: number): string {
  const m = Math.floor(s / 60), r = s % 60;
  return m > 0 ? `${m}:${String(r).padStart(2, '0')}` : `${r}s`;
}

/** The single best thing that happened today: a perfect game first, else the
 *  fastest win. Pure over today's completions — no fetch. */
export function bestMomentToday(todayDailies: Map<string, DailyCompletion>): { text: string; key: string } | null {
  let perfect: { key: string; title: string; n: number; noun: string } | null = null;
  let fastest: { key: string; title: string; secs: number } | null = null;
  for (const [key, r] of todayDailies) {
    const meta = MODE_BY_DBKEY[key];
    if (!meta || !r.won) continue;
    if (r.guesses <= meta.guessBase && !perfect) {
      const noun = guessNoun(meta.guessSemantics);
      perfect = { key, title: meta.title, n: r.guesses, noun: r.guesses === 1 ? noun.one : noun.many };
    }
    if (r.timeSeconds > 0 && (!fastest || r.timeSeconds < fastest.secs)) fastest = { key, title: meta.title, secs: r.timeSeconds };
  }
  if (perfect) {
    const detail = MODE_BY_DBKEY[perfect.key]?.guessSemantics === 'guesses' ? ` in ${perfect.n} ${perfect.noun}` : '';
    return { text: `Perfect ${perfect.title}${detail}`, key: perfect.key };
  }
  if (fastest) return { text: `Fastest win: ${fastest.title} in ${fmtTime(fastest.secs)}`, key: fastest.key };
  return null;
}

export function TodayCard({ sweepModes, moreModes, todayDailies, vsDailyWon, standing, sweepStreak, flawlessStreak, flawlessFooter, onJump }: Props) {
  const sweepToday = sweepModes.filter((m) => todayDailies.has(m.id));
  const completed = sweepToday.length;
  const wins = sweepToday.filter((m) => todayDailies.get(m.id)?.won).length;
  const total = sweepModes.length;
  const allDone = total > 0 && completed >= total;
  const flawless = allDone && wins === total;
  const moreDaily = moreModes.filter((m) => m.dailyEligible && m.dbKey);
  const morePlayed = moreDaily.filter((m) => todayDailies.has(m.dbKey as string)).length;
  const moment = bestMomentToday(todayDailies);
  const dateLabel = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  const cardStyle: React.CSSProperties = flawless
    ? { background: 'linear-gradient(135deg, #fef3c7, #fde68a)', border: '1.5px solid #f59e0b', borderRadius: '16px' }
    : allDone
      ? { background: 'linear-gradient(135deg, #f5f3ff, #fce7f3)', border: '1.5px solid #c4b5fd', borderRadius: '16px' }
      : { background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '16px' };

  const pill = (icon: ReactNode, label: string, value: ReactNode, color: string, onClick?: () => void) => (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 min-w-0 flex flex-col items-center gap-0.5 py-2 px-1 text-center"
      style={{ background: 'var(--color-bg)', borderRadius: '12px', border: '1px solid var(--color-border)' }}
    >
      <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider" style={{ color }}>
        {icon}{label}
      </span>
      <span className="text-sm font-black leading-tight" style={{ color: 'var(--color-text)' }}>{value}</span>
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="p-3" style={cardStyle}>
        <div className="flex items-center justify-between mb-2 px-0.5">
          {allDone ? (
            <div className="flex items-center gap-2 mx-auto">
              {flawless ? (
                <>
                  <Trophy className="w-5 h-5" style={{ color: '#b45309' }} fill="currentColor" />
                  <span className="text-lg font-black text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, #d97706, #b45309)' }}>FLAWLESS VICTORY!</span>
                  <Trophy className="w-5 h-5" style={{ color: '#b45309' }} fill="currentColor" />
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" style={{ color: '#7c3aed' }} />
                  <span className="text-base font-black text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, #a78bfa, #ec4899)' }}>DAILY SWEEP!</span>
                  <Sparkles className="w-4 h-4" style={{ color: '#ec4899' }} />
                </>
              )}
            </div>
          ) : (
            <>
              <span className="text-[11px] font-black uppercase tracking-[0.15em]" style={{ color: 'var(--color-text-muted)' }}>Today · {dateLabel}</span>
              <span className="text-[11px] font-black" style={{ color: 'var(--color-text-muted)' }}>{completed}/{total}</span>
            </>
          )}
        </div>

        {/* The eight sweep tiles, one row — tap plays (or reopens) that daily. */}
        <div className="flex justify-between gap-1">
          {sweepModes.map((m) => {
            const meta = MODE_BY_DBKEY[m.id];
            const Icon = meta ? MODE_CHROME[meta.id]?.icon : null;
            const result = todayDailies.get(m.id);
            const played = result !== undefined;
            const won = result?.won === true;
            const color = meta?.accentHex ?? '#7c3aed';
            const tileBg = !played ? 'var(--color-bg)' : won ? WIN_FG : '#dc2626';
            const tileBorder = !played ? 'var(--color-border)' : won ? WIN_FG : '#dc2626';
            return (
              <Link key={m.id} href={m.href} className="flex flex-col items-center gap-1 min-w-0" style={{ width: '40px' }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: tileBg, border: `1.5px solid ${tileBorder}`, opacity: played ? 1 : 0.7 }}>
                  {played ? (
                    <span className="text-sm font-black" style={{ color: '#ffffff' }}>{won ? 'W' : 'L'}</span>
                  ) : meta?.romanNumeral ? (
                    <span className="text-[11px] font-black" style={{ color }}>{meta.romanNumeral}</span>
                  ) : Icon ? (
                    <Icon className="w-3.5 h-3.5" style={{ color }} />
                  ) : (
                    <Zap className="w-3.5 h-3.5" style={{ color: 'var(--color-text-muted)' }} />
                  )}
                </div>
                <span className="text-[8px] font-bold truncate w-full text-center" style={{ color: played ? 'var(--color-text)' : 'var(--color-text-muted)' }}>{meta?.shortTitle ?? m.id}</span>
              </Link>
            );
          })}
        </div>

        {allDone && (
          flawless
            ? flawlessFooter
            : (
              <div className="text-center mt-2">
                <div className="text-[11px] font-extrabold" style={{ color: '#6d28d9' }}>All {total} dailies completed · +200 XP earned</div>
              </div>
            )
        )}

        {/* The rest of the day: More Games, VS, where you stand. */}
        <div className="flex gap-2 mt-3">
          {pill(<LayoutGrid className="w-3 h-3" />, 'More Games', moreDaily.length > 0 ? `${morePlayed} of ${moreDaily.length}` : '—', '#4f46e5',
            () => onJump(moreDaily[0]?.dbKey ?? 'today'))}
          {pill(<Swords className="w-3 h-3" />, 'VS Battle', vsDailyWon === null ? '—' : vsDailyWon ? 'W' : 'L', '#ec4899', () => onJump('vs'))}
          {pill(<TrendingUp className="w-3 h-3" />, 'Standing', standing ? `Top ${standing.topPercent}%` : '—', '#7c3aed')}
        </div>

        {/* The ten More Games as tiny chips, so the day reads at a glance. */}
        {moreDaily.length > 0 && (
          <div className="flex items-center justify-center gap-1 mt-2" aria-hidden="true">
            {moreDaily.map((m) => {
              const Icon = MODE_CHROME[m.id]?.icon ?? null;
              const r = todayDailies.get(m.dbKey as string);
              const done = !!r;
              const bg = !done ? `${m.accentHex}22` : r!.won ? m.accentHex : '#dc2626';
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onJump(m.dbKey as string)}
                  className="flex items-center justify-center rounded-[5px] shrink-0"
                  style={{ width: 20, height: 20, background: bg, border: done ? 'none' : `1px solid ${m.accentHex}55` }}
                  title={m.title}
                >
                  {Icon
                    ? <Icon className="w-3 h-3" style={{ color: done ? '#fff' : m.accentHex }} />
                    : <span className="text-[9px] font-black" style={{ color: done ? '#fff' : m.accentHex }}>{m.glyph ?? m.shortTitle[0]}</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Streaks + the best thing that happened today. */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center gap-2 px-3 py-2.5" style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '14px' }}>
          <Flame className="w-4 h-4 shrink-0" style={{ color: '#f97316' }} fill="currentColor" />
          <div className="min-w-0">
            <div className="text-[9px] font-black uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Sweep streak</div>
            <div className="text-sm font-black leading-tight" style={{ color: 'var(--color-text)' }}>
              {sweepStreak} {sweepStreak === 1 ? 'day' : 'days'}
              {flawlessStreak >= 2 && <span className="text-[10px] font-black ml-1" style={{ color: '#b45309' }}>· {flawlessStreak} flawless</span>}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => moment && onJump(moment.key)}
          className="flex items-center gap-2 px-3 py-2.5 text-left"
          style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '14px' }}
        >
          {moment?.text.startsWith('Perfect') ? <Star className="w-4 h-4 shrink-0" style={{ color: WIN_FG }} fill="currentColor" /> : <Timer className="w-4 h-4 shrink-0" style={{ color: '#2563eb' }} />}
          <div className="min-w-0">
            <div className="text-[9px] font-black uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Best moment</div>
            <div className="text-[11px] font-black leading-tight truncate" style={{ color: 'var(--color-text)' }}>{moment?.text ?? 'Play a daily to start your day'}</div>
          </div>
        </button>
      </div>
    </div>
  );
}
