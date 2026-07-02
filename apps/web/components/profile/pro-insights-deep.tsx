'use client';

import useSWR from 'swr';
import { Swords, Lightbulb, BookOpen, Skull, Grid3X3 } from 'lucide-react';
import { WIN_FG } from '@/lib/tile-theme';
import { SectionHeader, KitCard, ProLockOverlay } from './stat-kit';
import {
  fetchSkillRadar, fetchRivalries, fetchOpenerDeep, fetchPositionAccuracy,
  fetchWordAlmanac, fetchGauntletStageStats, fetchHintHonesty,
  type SkillRadarData,
} from '@/lib/stats-service';

// Pro Insights deep layer (restat R4): the stat-nerd centerpiece. Every card
// self-fetches (SWR) so pages just drop them in; all data derives from stored
// guess logs — no new collection.

/* ── Skill Radar ─────────────────────────────────────── */

const RADAR_AXES: Array<{ key: keyof SkillRadarData; label: string }> = [
  { key: 'speed', label: 'Speed' },
  { key: 'accuracy', label: 'Accuracy' },
  { key: 'consistency', label: 'Consistency' },
  { key: 'endurance', label: 'Endurance' },
  { key: 'versatility', label: 'Versatility' },
];

function RadarSvg({ data }: { data: SkillRadarData }) {
  const size = 260, cx = size / 2, cy = size / 2 + 6, R = 88;
  const pt = (i: number, r: number) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const ring = (f: number) => RADAR_AXES.map((_, i) => pt(i, R * f).join(',')).join(' ');
  const shape = RADAR_AXES.map((ax, i) => pt(i, R * Math.max(0.04, data[ax.key] / 100)).join(',')).join(' ');
  return (
    <svg viewBox={`0 0 ${size} ${size - 20}`} className="w-full max-w-[280px] mx-auto">
      {[0.33, 0.66, 1].map((f) => (
        <polygon key={f} points={ring(f)} fill="none" stroke="var(--color-border)" strokeWidth={1} />
      ))}
      {RADAR_AXES.map((_, i) => {
        const [x, y] = pt(i, R);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--color-border)" strokeWidth={1} />;
      })}
      <polygon points={shape} fill="#7c3aed33" stroke="#7c3aed" strokeWidth={2} strokeLinejoin="round" />
      {RADAR_AXES.map((ax, i) => {
        const [x, y] = pt(i, R + 20);
        return (
          <text key={ax.key} x={x} y={y} textAnchor="middle" dominantBaseline="middle"
            style={{ fontSize: 10, fontWeight: 800, fill: 'var(--color-text-muted)' }}>
            {ax.label} {data[ax.key]}
          </text>
        );
      })}
    </svg>
  );
}

export function SkillRadarCard({ userId, isPro }: { userId: string; isPro: boolean }) {
  const { data } = useSWR(isPro ? ['skill-radar', userId] : ['skill-radar-locked'], () =>
    isPro ? fetchSkillRadar(userId) : Promise.resolve<SkillRadarData | null>({ speed: 62, accuracy: 74, consistency: 55, endurance: 40, versatility: 68 }));
  if (!data) return null;
  const card = (
    <KitCard>
      <RadarSvg data={data} />
      <p className="text-[9px] font-bold text-center mt-1" style={{ color: 'var(--color-text-muted)' }}>
        Speed · win rate · steadiness · Gauntlet clears · mode spread — all 0–100
      </p>
    </KitCard>
  );
  return (
    <>
      <SectionHeader label="Skill Radar" accent="#7c3aed" />
      {isPro ? card : <ProLockOverlay label="Unlock Skill Radar with Pro">{card}</ProLockOverlay>}
    </>
  );
}

/* ── Rivalries (VS) ──────────────────────────────────── */

export function RivalriesCard({ userId, isPro }: { userId: string; isPro: boolean }) {
  const { data } = useSWR(isPro ? ['rivalries', userId] : null, () => fetchRivalries(userId, 5));
  const rows = data ?? [];
  if (isPro && rows.length === 0) return null;
  const card = (
    <KitCard>
      <div className="space-y-1.5">
        {(isPro ? rows : [
          { opponentId: '1', username: 'WordSmith', wins: 4, losses: 2, draws: 0, total: 6 },
          { opponentId: '2', username: 'LexiconLou', wins: 1, losses: 3, draws: 1, total: 5 },
        ]).map((r) => {
          const pct = r.total > 0 ? (r.wins / r.total) * 100 : 0;
          return (
            <div key={r.opponentId} className="p-2" style={{ background: 'var(--color-bg)', borderRadius: '10px' }}>
              <div className="flex items-center gap-2">
                <Swords className="w-3.5 h-3.5 shrink-0" style={{ color: '#7c3aed' }} />
                <span className="text-xs font-extrabold flex-1 truncate" style={{ color: 'var(--color-text)' }}>{r.username}</span>
                <span className="text-xs font-black" style={{ color: r.wins >= r.losses ? WIN_FG : '#dc2626' }}>
                  {r.wins}–{r.losses}{r.draws > 0 ? `–${r.draws}` : ''}
                </span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden mt-1.5" style={{ background: '#dc262633' }}>
                <div className="h-full" style={{ width: `${pct}%`, background: WIN_FG }} />
              </div>
            </div>
          );
        })}
      </div>
    </KitCard>
  );
  return (
    <>
      <SectionHeader label="Rivalries" accent="#ec4899" />
      {isPro ? card : <ProLockOverlay label="Unlock Rivalries with Pro">{card}</ProLockOverlay>}
    </>
  );
}

/* ── Per-mode deep card ──────────────────────────────── */

const HINT_MODES = new Set(['DUEL_6', 'DUEL_7', 'PROPERNOUNDLE']);

export function ProDeepModeCard({ userId, gameMode, isPro, accentColor }: {
  userId: string; gameMode: string; isPro: boolean; accentColor: string;
}) {
  const { data } = useSWR(isPro ? ['pro-deep', userId, gameMode] : null, async () => {
    const [openers, positions, almanac, hints, gauntlet] = await Promise.all([
      fetchOpenerDeep(userId, gameMode, 4),
      fetchPositionAccuracy(userId, gameMode),
      fetchWordAlmanac(userId, gameMode, 24),
      HINT_MODES.has(gameMode) ? fetchHintHonesty(userId, gameMode) : Promise.resolve(null),
      gameMode === 'GAUNTLET' ? fetchGauntletStageStats(userId) : Promise.resolve([]),
    ]);
    return { openers, positions, almanac, hints, gauntlet };
  });

  // Locked preview uses static sample content so free users see the shape.
  const d = isPro ? data : {
    openers: [{ word: 'CRANE', count: 12, avgGreens: 1.2, avgYellows: 1.6, winRate: 75 }],
    positions: { wordLength: 5, pct: [34, 22, 28, 31, 41], sampleGuesses: 120 },
    almanac: [
      { word: 'PIQUE', won: true, guesses: 4, time: 88, date: new Date().toISOString() },
      { word: 'KNOLL', won: false, guesses: 6, time: 240, date: new Date().toISOString() },
    ],
    hints: null,
    gauntlet: [],
  };
  if (!d) return null;
  const hasAny = (d.openers?.length ?? 0) > 0 || d.positions || (d.almanac?.length ?? 0) > 0 || d.hints || (d.gauntlet?.length ?? 0) > 0;
  if (!hasAny) return null;

  const inner = (
    <div className="space-y-3">
      {/* Opener yield */}
      {(d.openers?.length ?? 0) > 0 && (
        <KitCard>
          <div className="flex items-center gap-1.5 mb-2">
            <Lightbulb className="w-3.5 h-3.5" style={{ color: accentColor }} />
            <span className="text-xs font-black" style={{ color: 'var(--color-text)' }}>Opener Yield</span>
          </div>
          <div className="space-y-1.5">
            {d.openers!.map((o) => (
              <div key={o.word} className="flex items-center gap-2 p-2" style={{ background: 'var(--color-bg)', borderRadius: '10px' }}>
                <span className="text-sm font-black tracking-wider flex-1" style={{ color: 'var(--color-text)' }}>{o.word}</span>
                <span className="text-[10px] font-bold" style={{ color: WIN_FG }}>{o.avgGreens} 🟩</span>
                <span className="text-[10px] font-bold" style={{ color: '#f59e0b' }}>{o.avgYellows} 🟨</span>
                <span className="text-[10px] font-bold w-14 text-right" style={{ color: 'var(--color-text-muted)' }}>{o.count}× · {o.winRate}%</span>
              </div>
            ))}
          </div>
          <p className="text-[9px] font-bold mt-1.5 text-center" style={{ color: 'var(--color-text-muted)' }}>Average greens / yellows revealed by your first guess</p>
        </KitCard>
      )}

      {/* Position accuracy */}
      {d.positions && (
        <KitCard>
          <div className="flex items-center gap-1.5 mb-2">
            <Grid3X3 className="w-3.5 h-3.5" style={{ color: accentColor }} />
            <span className="text-xs font-black" style={{ color: 'var(--color-text)' }}>Position Accuracy</span>
          </div>
          <div className="flex gap-1.5 justify-center">
            {d.positions.pct.map((p, i) => (
              <div key={i} className="flex flex-col items-center gap-1" style={{ width: 44 }}>
                <div className="w-full rounded-lg flex items-center justify-center" style={{ height: 44, background: `${accentColor}${Math.round(20 + (p / 100) * 200).toString(16).padStart(2, '0')}` }}>
                  <span className="text-xs font-black" style={{ color: p > 45 ? '#fff' : 'var(--color-text)' }}>{p}%</span>
                </div>
                <span className="text-[9px] font-bold" style={{ color: 'var(--color-text-muted)' }}>{i + 1}</span>
              </div>
            ))}
          </div>
          <p className="text-[9px] font-bold mt-1.5 text-center" style={{ color: 'var(--color-text-muted)' }}>
            How often each slot is green across {d.positions.sampleGuesses} guesses
          </p>
        </KitCard>
      )}

      {/* Gauntlet stage breakdown */}
      {(d.gauntlet?.length ?? 0) > 0 && (
        <KitCard>
          <div className="flex items-center gap-1.5 mb-2">
            <Skull className="w-3.5 h-3.5" style={{ color: '#d97706' }} />
            <span className="text-xs font-black" style={{ color: 'var(--color-text)' }}>Stage Breakdown</span>
          </div>
          <div className="space-y-1.5">
            {d.gauntlet!.map((s) => {
              const clearPct = s.runs > 0 ? Math.round((s.clears / s.runs) * 100) : 0;
              return (
                <div key={s.stage} className="flex items-center gap-2 p-2" style={{ background: 'var(--color-bg)', borderRadius: '10px' }}>
                  <span className="text-[10px] font-black w-4 text-center" style={{ color: 'var(--color-text-muted)' }}>{s.stage + 1}</span>
                  <span className="text-xs font-extrabold flex-1 truncate" style={{ color: 'var(--color-text)' }}>{s.name ?? `Stage ${s.stage + 1}`}</span>
                  <span className="text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>{s.avgTimeSecs > 0 ? `~${s.avgTimeSecs}s` : ''}</span>
                  <span className="text-xs font-black w-12 text-right" style={{ color: clearPct >= 50 ? WIN_FG : '#dc2626' }}>{clearPct}%</span>
                </div>
              );
            })}
          </div>
          <p className="text-[9px] font-bold mt-1.5 text-center" style={{ color: 'var(--color-text-muted)' }}>Clear rate + average time per stage</p>
        </KitCard>
      )}

      {/* Hint honesty */}
      {d.hints && (
        <KitCard>
          <div className="flex items-center justify-between">
            <span className="text-xs font-black" style={{ color: 'var(--color-text)' }}>💡 Hints</span>
            <span className="text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>{d.hints.gamesCounted} games</span>
          </div>
          <div className="flex items-center justify-around mt-2">
            <div className="text-center">
              <div className="text-lg font-black" style={{ color: WIN_FG }}>{d.hints.hintlessWinRate}%</div>
              <div className="text-[9px] font-bold uppercase" style={{ color: 'var(--color-text-muted)' }}>Hintless wins</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-black" style={{ color: 'var(--color-text)' }}>{d.hints.avgHintsPerGame}</div>
              <div className="text-[9px] font-bold uppercase" style={{ color: 'var(--color-text-muted)' }}>Hints / game</div>
            </div>
          </div>
        </KitCard>
      )}

      {/* Word Almanac */}
      {(d.almanac?.length ?? 0) > 0 && (
        <KitCard>
          <div className="flex items-center gap-1.5 mb-2">
            <BookOpen className="w-3.5 h-3.5" style={{ color: accentColor }} />
            <span className="text-xs font-black" style={{ color: 'var(--color-text)' }}>Word Almanac</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 max-h-56 overflow-y-auto pr-0.5">
            {d.almanac!.map((a, i) => (
              <div key={`${a.word}-${i}`} className="text-center p-1.5" style={{ background: a.won ? '#f5f3ff' : '#fef2f2', border: `1px solid ${a.won ? '#ddd6fe' : '#fecaca'}`, borderRadius: '8px' }}>
                <div className="text-[11px] font-black tracking-wide truncate" style={{ color: a.won ? '#6d28d9' : '#dc2626' }}>{a.word}</div>
                <div className="text-[8px] font-bold" style={{ color: 'var(--color-text-muted)' }}>{a.won ? `${a.guesses}g` : '✗'}</div>
              </div>
            ))}
          </div>
          <p className="text-[9px] font-bold mt-1.5 text-center" style={{ color: 'var(--color-text-muted)' }}>Every solution you&apos;ve faced recently — solved in purple</p>
        </KitCard>
      )}
    </div>
  );

  return (
    <div className="mt-4">
      <SectionHeader label="Deep Insights" accent={accentColor} />
      {isPro ? inner : <ProLockOverlay label="Unlock Deep Insights with Pro">{inner}</ProLockOverlay>}
    </div>
  );
}
