'use client';

import Link from 'next/link';
import { type ReactNode } from 'react';
import { Icon3D } from '@/components/ui/icon3d';
import { GameArt } from '@/components/ui/game-art';
import { SoftNum } from '@/components/ui/soft-number';
import { TintTile } from '@/components/profile/stat-kit';
import { softCard, softIconTile, softPill } from '@/lib/soft-surface';
import type { ModeMeta } from '@/lib/modes.generated';
import { MODE_BY_DBKEY } from '@/lib/modes.generated';
import type { DailyCompletion } from '@/lib/daily-service';
import type { DailyStanding } from '@/lib/stats-service';
import { guessNoun } from '@/lib/mode-stats';
import { MomentArt } from '@/components/ui/art-title';
import { MedalArt } from '@/components/stats/medal-art';

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
  /** The Puzzles row's runs (founder, 2026-10-01 stats audit; the home banner shows them too). */
  puzzleStreaks?: { sweep: number; flawless: number };
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

const BLUE = '#2563eb';
const GOLD = '#f5a524';
const PURPLE = '#7c3aed';
/** Today's W / L corner badges (FINISH_SPEC C3: purple W, slate L). */
const W_BG = '#7c3aed';
const L_BG = '#6b7891';

export function TodayCard({ sweepModes, moreModes, todayDailies, vsDailyWon, standing, sweepStreak, flawlessStreak, puzzleStreaks, flawlessFooter, onJump }: Props) {
  const sweepToday = sweepModes.filter((m) => todayDailies.has(m.id));
  const completed = sweepToday.length;
  const wins = sweepToday.filter((m) => todayDailies.get(m.id)?.won).length;
  const total = sweepModes.length;
  const allDone = total > 0 && completed >= total;
  const flawless = allDone && wins === total;
  const moreDaily = moreModes.filter((m) => m.dailyEligible && m.dbKey);
  const morePlayed = moreDaily.filter((m) => todayDailies.has(m.dbKey as string)).length;
  const moment = bestMomentToday(todayDailies);
  const dateLabel = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  // C3 cont: Today on a soft blue card (gold on a Flawless day, lavender on a Sweep day).
  const accent = flawless ? GOLD : allDone ? PURPLE : BLUE;
  const ink = flawless ? '#a2560c' : allDone ? '#5b21b6' : '#2456a8';
  const bar = flawless ? 'linear-gradient(90deg, #f59e0b, #fcd34d)' : allDone ? 'linear-gradient(90deg, #7c3aed, #ec4899)' : 'linear-gradient(90deg, #0a6cff, #60a5fa)';

  // The three tinted pills (magenta Puzzles, teal VS, gold Standing) in soft numbers.
  const pill = (pc: string, pink: string, label: string, value: ReactNode, onClick?: () => void, ariaLabel?: string) => {
    const inner = (
      <>
        <SoftNum size={18} as="div" className="soft-num-auto">{value}</SoftNum>
        <span className="block text-[10px] font-black uppercase tint-ink mt-1" style={{ letterSpacing: '0.08em', color: pink }}>{label}</span>
      </>
    );
    const style: React.CSSProperties = { ...softPill(pc, { radius: 12 }), padding: '9px 6px 7px', textAlign: 'center', minWidth: 0 };
    return onClick
      ? <button type="button" onClick={onClick} aria-label={ariaLabel} className="flex-1" style={style}>{inner}</button>
      : <div className="flex-1" style={style} aria-label={ariaLabel}>{inner}</div>;
  };

  return (
    <div className="space-y-3">
      <div className="overflow-hidden" style={softCard(accent, { radius: 20 })}>
        <div aria-hidden="true" style={{ height: 10, background: bar }} />
        <div className="grid gap-2.5" style={{ padding: '12px 14px 14px' }}>
          <div className="flex items-center justify-between px-0.5">
            {allDone ? (
              // FLAWLESS! / SWEEP! lettering (docs/ART_SPEC.md §6), sized for the card's header row.
              <MomentArt
                moment={flawless ? 'flawless' : 'sweep'}
                label={flawless ? 'Flawless Victory!' : 'Daily Sweep!'}
                as="div"
                maxHeight={40}
                className="w-full"
              />
            ) : (
              <>
                <span className="text-[11px] font-black uppercase tint-ink" style={{ letterSpacing: '0.12em', color: ink }}>Today · {dateLabel}</span>
                <SoftNum size={15} className="soft-num-auto">{completed} / {total}</SoftNum>
              </>
            )}
          </div>

          {/* The eight sweep tiles as mini game cards with today's W / L — tap plays (or reopens) that daily. */}
          <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.max(1, sweepModes.length)}, minmax(0, 1fr))` }}>
            {sweepModes.map((m) => {
              const meta = MODE_BY_DBKEY[m.id];
              const result = todayDailies.get(m.id);
              const played = result !== undefined;
              const won = result?.won === true;
              const color = meta?.accentHex ?? PURPLE;
              const title = meta?.title ?? m.id;
              return (
                <Link
                  key={m.id}
                  href={m.href}
                  aria-label={`${title}: ${played ? (won ? 'won today' : 'lost today') : 'not played yet'}`}
                  className="relative flex items-center justify-center min-w-0"
                  style={{ ...softIconTile(color, { radius: 11 }), aspectRatio: '1 / 1', opacity: played ? 1 : 0.8 }}
                >
                  {meta ? <GameArt id={meta.id} size={48} style={{ width: '72%', height: '72%', marginTop: 2 }} /> : null}
                  {played && (
                    <span
                      aria-hidden="true"
                      className="absolute flex items-center justify-center font-black text-white"
                      style={{ top: -4, right: -4, width: 16, height: 16, borderRadius: 5, fontSize: 10, background: won ? W_BG : L_BG, boxShadow: '0 1px 2px rgba(0,0,0,0.2)' }}
                    >
                      {won ? 'W' : 'L'}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          {allDone && (
            flawless
              ? flawlessFooter
              : (
                <div className="text-center">
                  <div className="text-[11px] font-extrabold tint-ink" style={{ color: '#6d28d9' }}>All {total} dailies completed · +200 XP earned</div>
                </div>
              )
          )}

          {/* The rest of the day: Puzzles, VS, where you stand. */}
          <div className="flex gap-1.5">
            {pill('#c026d3', '#a21caf', 'Puzzles', moreDaily.length > 0 ? `${morePlayed} of ${moreDaily.length}` : '—',
              () => onJump(moreDaily[0]?.dbKey ?? 'today'), `Puzzles: ${morePlayed} of ${moreDaily.length} played today`)}
            {pill('#0d9488', '#0f766e', 'VS Battle', vsDailyWon === null ? '—' : vsDailyWon ? 'W' : 'L',
              () => onJump('vs'), `VS Battle: ${vsDailyWon === null ? 'not played today' : vsDailyWon ? 'won today' : 'lost today'}`)}
            {pill(GOLD, '#a2560c', 'Standing', standing ? `Top ${standing.topPercent}%` : '—', undefined,
              standing ? `Standing: top ${standing.topPercent}% today` : 'Standing: no games yet today')}
          </div>

          {/* The Puzzles as tiny mini game cards, so the day reads at a glance. */}
          {moreDaily.length > 0 && (
            <div className="flex items-center justify-center gap-1">
              {moreDaily.map((m) => {
                const r = todayDailies.get(m.dbKey as string);
                const done = !!r;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onJump(m.dbKey as string)}
                    aria-label={`${m.title}: ${done ? (r!.won ? 'won today' : 'lost today') : 'not played yet'}`}
                    className="flex items-center justify-center shrink-0"
                    style={{
                      ...softIconTile(done && !r!.won ? L_BG : m.accentHex, { selected: done, radius: 6 }),
                      width: 24, height: 24, padding: 0, opacity: done ? 1 : 0.6,
                    }}
                    title={m.title}
                  >
                    <GameArt id={m.id} size={16} style={{ marginTop: 2 }} />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Streaks + the best thing that happened today, each on its own color with a 3D icon. */}
      <div className="grid grid-cols-2 gap-2.5">
        <TintTile
          accent={GOLD}
          ink="#a2560c"
          icon={<Icon3D name="flame" size={20} />}
          label="Sweep streak"
          value={sweepStreak}
          sub={`${sweepStreak === 1 ? 'day' : 'days'}${flawlessStreak >= 2 ? ` · ${flawlessStreak} flawless` : ''}`}
        >
          {/* Wordocious above, Puzzles here: the same two runs the home banner shows. */}
          <span className="text-[10px] font-black uppercase truncate" style={{ color: 'var(--color-text-muted)' }}>
            Puzzles {puzzleStreaks?.sweep ?? 0} {(puzzleStreaks?.sweep ?? 0) === 1 ? 'day' : 'days'}
            {(puzzleStreaks?.flawless ?? 0) >= 2 ? ` · ${puzzleStreaks!.flawless} flawless` : ''}
          </span>
        </TintTile>
        <TintTile
          accent="#ec4899"
          ink="#a0336b"
          icon={moment?.text.startsWith('Perfect') ? <Icon3D name="crown" size={20} /> : <MedalArt medal="trophy" size={20} />}
          label="Best moment"
          value={moment?.text ?? 'Play a daily'}
          size={15}
          sub={moment ? undefined : 'to start your day'}
          onClick={moment ? () => onJump(moment.key) : undefined}
          ariaLabel={moment ? `Best moment: ${moment.text}` : undefined}
        />
      </div>
    </div>
  );
}
