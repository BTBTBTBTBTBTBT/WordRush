'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Trophy, Clock, Target, Flame, Crown, Zap, Medal, Sparkles, TrendingUp, Star, Share } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { fetchDailySweepStats, type DailySweepStats } from '@/lib/stats-service';
import { getUserSweepRank, getUserAllTimeSweepRank, type AllTimeRecord } from '@/lib/daily-service';
import { shareTrophyCaseCard } from '@/lib/leaderboard-share-flow';
import { modeByKey } from '@/components/profile/mode-picker';
import {
  fetchAllTimeRecordsShared, RECORD_LABELS, recordValue, recordLabel, formatRecordTime, SHIELD_EVERY,
  MyStatCell, type UserStatRow,
} from '@/lib/records-ui';

// YOUR RECORDS, folded into the Stats tab (Stats + Friends redesign D2 step 3,
// founder 2026-09-26: the Records tab goes "so long as the information
// expected still populates elsewhere"). Every row the old Records → You view
// had lives here: Next Up (shield + record chases) and the Daily Sweeps
// window, Global Records held and the Trophy Shelf on the All-time page; the
// per-game bests (Fastest Win · Fewest Guesses · Games Played · Win–Loss plus
// the records you hold in that game) on each game page.
// `scripts/records-fold.test.ts` asserts every one of those labels is here.

export interface Chase { label: string; gap: string; pct: number; gameMode: string | null }

export interface YourRecordsData {
  sweep: DailySweepStats | null;
  sweepRankToday: { rank: number; totalPlayers: number } | null;
  sweepRankAllTime: { rank: number; totalPlayers: number } | null;
  recordsHeld: AllTimeRecord[];
  chases: Chase[];
  loading: boolean;
}

/** The fetches the old Records → You view made, minus user_stats (the page has them). */
export function useYourRecords(userId: string | undefined, stats: UserStatRow[]): YourRecordsData {
  const [data, setData] = useState<YourRecordsData>({ sweep: null, sweepRankToday: null, sweepRankAllTime: null, recordsHeld: [], chases: [], loading: true });
  useEffect(() => {
    if (!userId) { setData((d) => ({ ...d, loading: false })); return; }
    let active = true;
    (async () => {
      const [sweepRes, recs, sweepRankTodayRes, sweepRankAllTimeRes] = await Promise.all([
        fetchDailySweepStats(userId).catch(() => null),
        fetchAllTimeRecordsShared().catch(() => [] as AllTimeRecord[]),
        getUserSweepRank(userId).catch(() => null),
        getUserAllTimeSweepRank(userId).catch(() => null),
      ]);
      if (!active) return;
      // One shelf row per (record type, mode): all_time_records keeps a
      // separate row per play_type ('solo' and 'vs'); prefer the solo row.
      const heldByKey = new Map<string, AllTimeRecord>();
      for (const r of recs) {
        if (r.holder_id !== userId) continue;
        const key = `${r.record_type}|${r.game_mode ?? 'global'}`;
        const existing = heldByKey.get(key);
        if (!existing || (existing.play_type !== 'solo' && r.play_type === 'solo')) heldByKey.set(key, r);
      }
      // Record Chase: EVERY beatable all-time record with your gap, sorted by
      // how close you are (relative gap). Lower-is-better types only.
      const all: Array<Chase & { rel: number }> = [];
      for (const r of recs) {
        if (r.holder_id === userId || !r.game_mode || r.play_type !== 'solo') continue;
        const mine = stats.find((s) => s.game_mode === r.game_mode && s.play_type === 'solo');
        if (!mine) continue;
        if (r.record_type === 'fastest_win' && mine.fastest_time && mine.fastest_time > r.record_value) {
          const gap = mine.fastest_time - r.record_value;
          all.push({ label: `${modeByKey(r.game_mode).title} fastest win`, gap: `${gap}s away`, pct: Math.round((r.record_value / mine.fastest_time) * 100), rel: gap / Math.max(1, r.record_value), gameMode: r.game_mode });
        } else if (r.record_type === 'fewest_guesses' && mine.best_score && mine.best_score > r.record_value) {
          const gap = mine.best_score - r.record_value;
          all.push({ label: `${modeByKey(r.game_mode).title} ${recordLabel('fewest_guesses', r.game_mode).toLowerCase()}`, gap: `${gap} away`, pct: Math.round((r.record_value / mine.best_score) * 100), rel: gap / Math.max(1, r.record_value), gameMode: r.game_mode });
        }
      }
      setData({
        sweep: sweepRes,
        sweepRankToday: sweepRankTodayRes,
        sweepRankAllTime: sweepRankAllTimeRes,
        recordsHeld: [...heldByKey.values()],
        chases: all.sort((a, b) => a.rel - b.rel).map(({ rel: _rel, ...rest }) => rest),
        loading: false,
      });
    })();
    return () => { active = false; };
  // stats identity changes on every SWR revalidation; key on its length + the user.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, stats.length]);
  return data;
}

const card: React.CSSProperties = { background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '16px' };

/** Next Up — the next streak shield and your three closest record chases. */
export function NextUpCard({ dailyStreak, chases }: { dailyStreak: number; chases: Chase[] }) {
  const nextShield = (Math.floor(dailyStreak / SHIELD_EVERY) + 1) * SHIELD_EVERY;
  const top = chases.slice(0, 3);
  return (
    <div className="overflow-hidden" style={card}>
      <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, #a78bfa, #ec4899)' }} />
      <div className="px-4 pt-3 pb-4">
        <div className="text-[10px] font-black uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>Next Up</div>
        <div className="mb-3">
          <div className="flex items-center justify-between text-[11px] font-extrabold mb-1">
            <span className="flex items-center gap-1.5" style={{ color: 'var(--color-text)' }}><Flame className="w-3.5 h-3.5" style={{ color: '#f97316' }} />{nextShield}-day streak shield</span>
            <span style={{ color: 'var(--color-text-muted)' }}>{dailyStreak}/{nextShield}</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-border)' }}>
            <div className="h-full rounded-full" style={{ width: `${Math.min(100, (dailyStreak / nextShield) * 100)}%`, background: 'linear-gradient(90deg, #f97316, #fbbf24)' }} />
          </div>
        </div>
        {top.length > 0 && (
          <div className="space-y-2">
            {top.map((c) => (
              <div key={c.label}>
                <div className="flex items-center gap-1.5 text-[11px] font-bold mb-0.5" style={{ color: 'var(--color-text-muted)' }}>
                  <TrendingUp className="w-3.5 h-3.5 shrink-0" style={{ color: '#7c3aed' }} />
                  <span className="flex-1 truncate">You&apos;re <b style={{ color: 'var(--color-text)' }}>{c.gap}</b> from the {c.label} record</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-border)' }}>
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, c.pct)}%`, background: 'linear-gradient(90deg, #a78bfa, #7c3aed)' }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Daily Sweeps — count, flawless, streak, best time, today's + all-time board ranks. */
export function SweepRecordsCard({ sweep, sweepRankToday, sweepRankAllTime }: Pick<YourRecordsData, 'sweep' | 'sweepRankToday' | 'sweepRankAllTime'>) {
  const color = '#4f46e5';
  return (
    <div className="overflow-hidden" style={card}>
      <div className="h-[3px]" style={{ background: `linear-gradient(90deg, ${color}, ${color}88)` }} />
      <div className="flex items-center gap-2.5 px-4 pt-3 pb-1">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${color}15` }}>
          <Sparkles className="w-4 h-4" style={{ color }} />
        </div>
        <div className="font-black text-sm" style={{ color: 'var(--color-text)' }}>Daily Sweeps</div>
      </div>
      {sweep && (sweep.sweepCount > 0 || sweep.flawlessCount > 0) ? (
        <div className="px-4 pb-3">
          <div className="grid grid-cols-2 gap-1">
            <MyStatCell icon={Sparkles} value={`${sweep.sweepCount}`} label="Daily Sweeps" color="#7c3aed" />
            <MyStatCell icon={Trophy} value={`${sweep.flawlessCount}`} label="Flawless Victories" color="#d97706" />
            <MyStatCell icon={Flame} value={`${sweep.currentSweepStreak}`} label="Current Sweep Streak" color="#f97316" />
            <MyStatCell icon={Clock} value={sweep.bestSweepSecs ? formatRecordTime(Math.round(sweep.bestSweepSecs)) : '—'} label="Best Sweep Time" color="#2563eb" dim={!sweep.bestSweepSecs} />
          </div>
          {(sweepRankToday || sweepRankAllTime || sweep.currentFlawlessStreak > 0) && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 pt-2" style={{ borderTop: '1px solid var(--color-border)' }}>
              {sweepRankToday && (
                <span className="text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
                  Today: <span className="font-black" style={{ color }}>#{sweepRankToday.rank}</span> of {sweepRankToday.totalPlayers}
                </span>
              )}
              {sweepRankAllTime && (
                <span className="text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
                  All-Time: <span className="font-black" style={{ color }}>#{sweepRankAllTime.rank}</span> of {sweepRankAllTime.totalPlayers}
                </span>
              )}
              {sweep.currentFlawlessStreak > 0 && (
                <span className="text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
                  🏆 Flawless: <span className="font-black" style={{ color: '#d97706' }}>×{sweep.currentFlawlessStreak}</span>
                  {sweep.bestFlawlessStreak > sweep.currentFlawlessStreak ? ` · best ${sweep.bestFlawlessStreak}` : ''}
                </span>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="py-5 text-center">
          <Trophy className="w-7 h-7 mx-auto mb-1.5" style={{ color: 'var(--color-text-muted)' }} />
          <p className="text-[11px] font-extrabold" style={{ color: 'var(--color-text-muted)' }}>No sweeps yet</p>
        </div>
      )}
    </div>
  );
}

/** One game's personal bests + the all-time records you hold in it + your closest chase. */
export function GameRecordsCard({ dbKey, my, recordsHeld, chases }: { dbKey: string; my: UserStatRow | undefined; recordsHeld: AllTimeRecord[]; chases: Chase[] }) {
  const mode = modeByKey(dbKey);
  const color = mode.accentColor;
  const held = recordsHeld.filter((r) => r.game_mode === dbKey);
  const chase = chases.find((c) => c.gameMode === dbKey);
  const fmt = (rt: string, v: number | null | undefined) => (v == null || v === 0 ? '—' : recordValue(rt, v, dbKey));
  return (
    <div className="overflow-hidden" style={card}>
      <div className="h-[3px]" style={{ background: `linear-gradient(90deg, ${color}, ${color}88)` }} />
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <div className="font-black text-sm" style={{ color: 'var(--color-text)' }}>Your Records</div>
        {held.length > 0 && (
          <span className="flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full" style={{ background: 'var(--color-highlight-gold)', color: '#d97706' }}>
            <Crown className="w-3 h-3" /> {held.length} all-time record{held.length === 1 ? '' : 's'}
          </span>
        )}
      </div>
      <div className="px-4 pb-3 grid grid-cols-2 gap-1">
        <MyStatCell icon={Clock} value={fmt('fastest_win', my?.fastest_time)} label="Fastest Win" color={color} dim={!my?.fastest_time} />
        <MyStatCell icon={Target} value={fmt('fewest_guesses', my?.best_score)} label={recordLabel('fewest_guesses', dbKey)} color={color} dim={!my?.best_score} />
        <MyStatCell icon={Zap} value={my ? `${my.total_games} games` : '—'} label="Games Played" color={color} dim={!my} />
        <MyStatCell icon={Trophy} value={my ? `${my.wins}–${my.losses}` : '—'} label="Win–Loss" color={color} dim={!my} />
      </div>
      {(held.length > 0 || chase) && (
        <div className="px-4 pb-3 space-y-1.5" style={{ borderTop: '1px solid var(--color-border)' }}>
          {held.map((r) => {
            const cfg = RECORD_LABELS[r.record_type];
            return (
              <div key={`${r.record_type}-${r.play_type}`} className="flex items-center gap-2 pt-2 text-[11px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
                <Crown className="w-3.5 h-3.5 shrink-0" style={{ color: '#d97706' }} />
                <span className="flex-1 truncate">You hold the all-time <b style={{ color: 'var(--color-text)' }}>{cfg?.label ?? r.record_type}</b> record</span>
                <span className="font-black" style={{ color: '#d97706' }}>{recordValue(r.record_type, r.record_value, dbKey)}</span>
              </div>
            );
          })}
          {chase && (
            <div className="pt-2">
              <div className="flex items-center gap-1.5 text-[11px] font-bold mb-0.5" style={{ color: 'var(--color-text-muted)' }}>
                <TrendingUp className="w-3.5 h-3.5 shrink-0" style={{ color }} />
                <span className="flex-1 truncate">You&apos;re <b style={{ color: 'var(--color-text)' }}>{chase.gap}</b> from the {chase.label} record</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-border)' }}>
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, chase.pct)}%`, background: `linear-gradient(90deg, ${color}88, ${color})` }} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Medals tally + count of global records held, side by side. */
export function RecordsHeldRow({ recordsHeld }: { recordsHeld: AllTimeRecord[] }) {
  const { profile } = useAuth();
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="overflow-hidden" style={card}>
        <div className="px-4 py-3">
          <div className="text-[10px] font-black uppercase tracking-wider mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Medals</div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 font-black text-sm" style={{ color: '#d97706' }}><Crown className="w-3.5 h-3.5" />{(profile as any)?.gold_medals ?? 0}</span>
            <span className="flex items-center gap-1 font-black text-sm" style={{ color: '#9ca3af' }}><Medal className="w-3.5 h-3.5" />{(profile as any)?.silver_medals ?? 0}</span>
            <span className="flex items-center gap-1 font-black text-sm" style={{ color: '#b45309' }}><Medal className="w-3.5 h-3.5" />{(profile as any)?.bronze_medals ?? 0}</span>
          </div>
          <div className="text-[10px] font-bold mt-1.5" style={{ color: 'var(--color-text-muted)' }}>every medal is listed below</div>
        </div>
      </div>
      <Link href="/records" className="overflow-hidden block" style={card}>
        <div className="px-4 py-3">
          <div className="text-[10px] font-black uppercase tracking-wider mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Global Records</div>
          <div className="flex items-center gap-1.5 font-black text-2xl" style={{ color: recordsHeld.length ? '#d97706' : 'var(--color-text-muted)' }}>
            <Star className="w-5 h-5" />{recordsHeld.length}
          </div>
          <div className="text-[10px] font-bold mt-0.5" style={{ color: '#7c3aed' }}>all-time record{recordsHeld.length !== 1 ? 's' : ''} held · Hall of Fame →</div>
        </div>
      </Link>
    </div>
  );
}

/** Trophy shelf (§245): marquee jewels, then type-grouped shelves of mode-accented tiles. */
export function TrophyShelf({ recordsHeld }: { recordsHeld: AllTimeRecord[] }) {
  const { profile } = useAuth();
  const [sharing, setSharing] = useState(false);
  if (recordsHeld.length === 0) return null;
  const bestOf = (type: string) => recordsHeld
    .filter((r) => r.record_type === type && r.game_mode)
    .sort((a, b) => a.record_value - b.record_value)[0];
  const marquee = [bestOf('fastest_win'), bestOf('fewest_guesses')].filter(Boolean) as AllTimeRecord[];
  const marqueeKeys = new Set(marquee.map((r) => `${r.record_type}|${r.game_mode}`));
  const shelfOrder = ['fastest_win', 'fewest_guesses', 'longest_streak', 'most_games_played', 'most_gold_medals', 'highest_level', 'most_daily_completions'];
  const grouped = shelfOrder
    .map((t) => ({ type: t, rows: recordsHeld.filter((r) => r.record_type === t && !marqueeKeys.has(`${r.record_type}|${r.game_mode}`)) }))
    .filter((g) => g.rows.length > 0);
  const heldSince = (iso?: string) => {
    if (!iso) return null;
    const t = Date.parse(iso);
    if (!Number.isFinite(t)) return null;
    return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };
  const glyph = (gameMode: string | null, boxPx: number) => {
    if (!gameMode) return <Star style={{ width: boxPx / 2, height: boxPx / 2, color: '#d97706' }} />;
    const m = modeByKey(gameMode);
    const MIcon = m.icon;
    return m.romanNumeral
      ? <span className="font-black leading-none" style={{ color: m.accentColor, fontSize: boxPx * 0.34 }}>{m.romanNumeral}</span>
      : MIcon ? <MIcon style={{ width: boxPx / 2, height: boxPx / 2, color: m.accentColor }} /> : null;
  };
  const accentOf = (gameMode: string | null) => (gameMode ? modeByKey(gameMode).accentColor : '#d97706');
  const shareShelf = async () => {
    if (sharing) return;
    setSharing(true);
    try { await shareTrophyCaseCard({ records: recordsHeld, username: profile?.username }); }
    finally { setSharing(false); }
  };
  return (
    <div className="overflow-hidden" style={card}>
      <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, #fbbf24, #d97706)' }} />
      <div className="px-4 pt-2 pb-3">
        <div className="flex items-center justify-between mb-1.5">
          <div className="text-[10px] font-black uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Your Trophy Shelf</div>
          <button
            onClick={shareShelf}
            disabled={sharing}
            aria-label="Share trophy shelf"
            className="p-1 -my-1 active:scale-95 transition-transform"
            style={{ color: 'var(--color-text-muted)', opacity: sharing ? 0.4 : 1 }}
          >
            <Share className="w-3.5 h-3.5" />
          </button>
        </div>
        {marquee.length > 0 && (
          <div className="space-y-1.5 mb-2">
            {marquee.map((r) => {
              const cfg = RECORD_LABELS[r.record_type];
              const since = heldSince(r.achieved_at);
              const accent = accentOf(r.game_mode);
              return (
                <div key={`mq-${r.record_type}-${r.game_mode}`} className="flex items-center gap-3 p-3"
                  style={{ background: 'linear-gradient(135deg, #fffbeb, #fef3c7)', border: '1px solid #fde68a', borderRadius: '12px' }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${accent}18` }}>
                    {glyph(r.game_mode, 40)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-black uppercase tracking-wider truncate" style={{ color: '#92400e' }}>
                      {r.game_mode ? modeByKey(r.game_mode).title : 'Global'} · {cfg?.label ?? r.record_type}
                    </div>
                    <div className="text-2xl font-black leading-tight" style={{ color: '#d97706' }}>
                      {cfg ? recordValue(r.record_type, r.record_value, r.game_mode) : r.record_value}
                    </div>
                  </div>
                  {since && (
                    <div className="text-[10px] font-bold shrink-0 text-right" style={{ color: '#b45309' }}>
                      held since<br />{since}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div className="space-y-2">
          {grouped.map((g) => {
            const cfg = RECORD_LABELS[g.type];
            const GIcon = cfg?.icon ?? Star;
            return (
              <div key={g.type}>
                <div className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-muted)' }}>
                  <GIcon className="w-3 h-3" style={{ color: '#d97706' }} />
                  {cfg?.label ?? g.type}
                </div>
                <div className="flex flex-wrap gap-1.5 pb-1.5" style={{ borderBottom: '1px solid #fde68a55' }}>
                  {g.rows.map((r) => {
                    const accent = accentOf(r.game_mode);
                    return (
                      <div key={`${r.record_type}-${r.game_mode ?? 'g'}-${r.play_type ?? 'g'}`}
                        className="flex items-center gap-1.5 pl-1.5 pr-2 py-1" style={{ background: 'var(--color-bg)', borderRadius: '9px' }}>
                        <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0" style={{ background: `${accent}18` }}>
                          {glyph(r.game_mode, 20)}
                        </div>
                        <span className="text-[11px] font-black" style={{ color: accent }}>
                          {cfg ? recordValue(r.record_type, r.record_value, r.game_mode) : r.record_value}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
