'use client';

import useSWR from 'swr';
import { Swords, Lightbulb, BookOpen, Skull, Grid3X3 } from 'lucide-react';
import { WIN_FG } from '@/lib/tile-theme';
import { SectionHeader, KitCard, ProStatsInvite } from './stat-kit';
import {
  fetchSkillRadar, fetchRivalries, fetchOpenerDeep, fetchPositionAccuracy,
  fetchWordAlmanac, fetchGauntletStageStats, fetchHintHonesty,
  type SkillRadarData, type StatsPlayType,
} from '@/lib/stats-service';
import { alphaHex } from '@/lib/soft-surface';
import { SoftNum } from '@/components/ui/soft-number';
import { Icon3D } from '@/components/ui/icon3d';
import { UiIcon } from '@/components/ui/ui-icon';
import { FriendAvatar } from '@/components/friends/friends-ui';
import { RecordBar } from '@/components/stats/stat-hero';
import { isFriend } from '@/lib/friends-service';

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
  // Wide viewBox + edge-aware text anchors so side labels ("Versatility 97",
  // "Accuracy 88") never clip at the card edge.
  const W = 340, H = 240, cx = W / 2, cy = H / 2 + 8, R = 84;
  const pt = (i: number, r: number) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const ring = (f: number) => RADAR_AXES.map((_, i) => pt(i, R * f).join(',')).join(' ');
  const shape = RADAR_AXES.map((ax, i) => pt(i, R * Math.max(0.04, data[ax.key] / 100)).join(',')).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[340px] mx-auto">
      {[0.33, 0.66, 1].map((f) => (
        <polygon key={f} points={ring(f)} fill="none" stroke="var(--color-border)" strokeWidth={1} />
      ))}
      {RADAR_AXES.map((_, i) => {
        const [x, y] = pt(i, R);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--color-border)" strokeWidth={1} />;
      })}
      {/* F4: the shape grows out from the center on first render. */}
      <polygon points={shape} fill="#7c3aed33" stroke="#7c3aed" strokeWidth={2} strokeLinejoin="round"
        className="radar-draw-in" style={{ transformOrigin: `${cx}px ${cy}px` }} />
      {RADAR_AXES.map((ax, i) => {
        const [x, y] = pt(i, R + 16);
        // Anchor side labels away from the edge: right-side points anchor at
        // start (grow rightward has room in the wide box), left-side at end.
        const anchor = x > cx + 8 ? 'start' : x < cx - 8 ? 'end' : 'middle';
        return (
          <text key={ax.key} x={x} y={y} textAnchor={anchor} dominantBaseline="middle"
            style={{ fontSize: 10, fontWeight: 800, fill: 'var(--color-text-muted)' }}>
            {ax.label} {data[ax.key]}
          </text>
        );
      })}
    </svg>
  );
}


/** Visible "no data yet" card — replaces silent hiding for Pro users (an
 *  invisible card reads as a broken build; this doubles as a diagnostic:
 *  stuck-on-empty with real history behind it = failing fetch). */
function StatsEmptyCard({ title, accent = '#7c3aed', hint }: { title: string; accent?: string; hint: string }) {
  return (
    <div>
      <SectionHeader label={title} accent={accent} />
      <KitCard>
        <div className="flex items-center justify-center gap-2 py-3 text-[11px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
          <Icon3D name="tab-stats" size={18} />
          <span>{hint}</span>
        </div>
      </KitCard>
    </div>
  );
}

export function SkillRadarCard({ userId, isPro, compact = true }: { userId: string; isPro: boolean; compact?: boolean }) {
  const { data } = useSWR(isPro ? ['skill-radar', userId] : null, () => fetchSkillRadar(userId));
  // FINISH_SPEC BJ17: free players get the GO PRO sign invitation (no blur, no sample radar).
  if (!isPro) {
    return (
      <div className="animate-fade-in-up">
        <SectionHeader label="Skill Radar" accent="#7c3aed" />
        <ProStatsInvite line="See your speed, accuracy and steadiness on a skill radar with Pro" compact={compact} cast="d" />
      </div>
    );
  }
  if (!data) {
    if (!isPro) return null;
    return <StatsEmptyCard title="Skill Radar" hint="Play 5+ solo games to generate your skill radar." />;
  }
  const card = (
    <KitCard>
      <RadarSvg data={data} />
      <p className="text-[9px] font-bold text-center mt-1" style={{ color: 'var(--color-text-muted)' }}>
        Speed · win rate · steadiness · Gauntlet clears · mode spread — all 0–100
      </p>
    </KitCard>
  );
  return (
    <div className="animate-fade-in-up">
      <SectionHeader label="Skill Radar" accent="#7c3aed" />
      {card}
    </div>
  );
}

/* ── Rivalries (VS) ──────────────────────────────────── */

export function RivalriesCard({ userId, isPro, compact = true }: { userId: string; isPro: boolean; compact?: boolean }) {
  const { data } = useSWR(isPro ? ['rivalries', userId] : null, () => fetchRivalries(userId, 5));
  const rows = (data ?? []).filter((r) => !isFriend(r.opponentId));
  if (!isPro) {
    return (
      <div className="animate-fade-in-up">
        <SectionHeader label="Rivalries" accent="#ec4899" />
        <ProStatsInvite line="See your head-to-head record against every rival with Pro" compact={compact} cast="o2" />
      </div>
    );
  }
  if (rows.length === 0) {
    if (!data || data.length > 0) return null; // still loading, or every rival is a friend (shown in HEAD TO HEAD)
    return <StatsEmptyCard title="Rivals" accent="#ec4899" hint="Face the same opponent a few times to start a rivalry." />;
  }
  // Item 16: friends already read in the HEAD TO HEAD section above; rivals are the most-faced opponents who are not.
  const card = (
    <KitCard tint="#ec4899">
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.opponentId} className="flex items-center gap-3">
            <FriendAvatar name={r.username} userId={r.opponentId} size={34} />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-extrabold truncate" style={{ color: 'var(--color-text)' }}>{r.username}</span>
                <span className="text-xs font-black shrink-0" style={{ color: 'var(--color-text)' }}>
                  {r.wins}–{r.losses}{r.draws > 0 ? `–${r.draws}` : ''}
                </span>
              </div>
              <RecordBar wins={r.wins} losses={r.losses} height={7} className="mt-1" />
            </div>
          </div>
        ))}
      </div>
    </KitCard>
  );
  return (
    <div className="animate-fade-in-up">
      <SectionHeader label="Rivals" accent="#ec4899" />
      {card}
    </div>
  );
}

/* ── Per-mode deep card ──────────────────────────────── */

const HINT_MODES = new Set(['DUEL_6', 'DUEL_7', 'PROPERNOUNDLE']);

export function ProDeepModeCard({ userId, gameMode, isPro, accentColor, playType = 'solo', openers: showOpeners = true, positions: showPositions = true }: {
  userId: string; gameMode: string; isPro: boolean; accentColor: string; playType?: StatsPlayType;
  /** The mode's statPanels flags — ProperNoundle names get neither card. */
  openers?: boolean; positions?: boolean;
}) {
  const { data } = useSWR(isPro && playType !== 'vs_cpu' ? ['pro-deep', userId, gameMode, playType, showOpeners, showPositions] : null, async () => {
    const [openers, positions, almanac, hints, gauntlet] = await Promise.all([
      showOpeners ? fetchOpenerDeep(userId, gameMode, 4, playType) : Promise.resolve([]),
      showPositions ? fetchPositionAccuracy(userId, gameMode, playType) : Promise.resolve(null),
      fetchWordAlmanac(userId, gameMode, 24, playType),
      HINT_MODES.has(gameMode) ? fetchHintHonesty(userId, gameMode, playType) : Promise.resolve(null),
      gameMode === 'GAUNTLET' ? fetchGauntletStageStats(userId, playType) : Promise.resolve([]),
    ]);
    return { openers, positions, almanac, hints, gauntlet };
  });
  // No per-game rows exist for CPU practice — hide the deep card entirely
  // (the panel shows a "totals only" note instead).
  if (playType === 'vs_cpu') return null;

  // FINISH_SPEC BJ17: free players get the GO PRO sign invitation (no blur, no sample insights).
  if (!isPro) {
    return (
      <div className="mt-4 animate-fade-in-up">
        <SectionHeader label="Deep Insights" accent={accentColor} />
        <ProStatsInvite line="See your best openers, letter accuracy and word almanac with Pro" cast="i" />
      </div>
    );
  }
  const d = data;
  if (!d) return null;
  const hasAny = (d.openers?.length ?? 0) > 0 || d.positions || (d.almanac?.length ?? 0) > 0 || d.hints || (d.gauntlet?.length ?? 0) > 0;
  if (!hasAny) {
    return <StatsEmptyCard title="Deep Insights" hint="Play more of this mode to unlock openers, accuracy and almanac insights." />;
  }

  const inner = (
    <div className="space-y-3">
      {/* Opener yield */}
      {(d.openers?.length ?? 0) > 0 && (
        <KitCard tint={accentColor}>
          <div className="flex items-center gap-1.5 mb-2">
            <Lightbulb className="w-3.5 h-3.5" style={{ color: accentColor }} />
            <span className="text-xs font-black" style={{ color: 'var(--color-text)' }}>Opener Yield</span>
          </div>
          <div className="space-y-1.5">
            {d.openers!.map((o) => (
              <div key={o.word} className="flex items-center gap-2 p-2" style={{ background: alphaHex(accentColor, 0.08), borderRadius: '10px' }}>
                <span className="text-sm font-black tracking-wider flex-1" style={{ color: 'var(--color-text)' }}>{o.word}</span>
                <span className="text-[10px] font-bold" style={{ color: WIN_FG }}>{o.avgGreens} <span aria-hidden="true" className="inline-block align-[-1px] ml-0.5" style={{ width: 9, height: 9, borderRadius: 2.5, background: WIN_FG }} /><span className="sr-only"> greens</span></span>
                <span className="text-[10px] font-bold" style={{ color: '#f59e0b' }}>{o.avgYellows} <span aria-hidden="true" className="inline-block align-[-1px] ml-0.5" style={{ width: 9, height: 9, borderRadius: 2.5, background: '#f59e0b' }} /><span className="sr-only"> yellows</span></span>
                <span className="text-[10px] font-bold w-14 text-right" style={{ color: 'var(--color-text-muted)' }}>{o.count}× · {o.winRate}%</span>
              </div>
            ))}
          </div>
          <p className="text-[9px] font-bold mt-1.5 text-center" style={{ color: 'var(--color-text-muted)' }}>Average greens / yellows revealed by your first guess</p>
        </KitCard>
      )}

      {/* Position accuracy */}
      {d.positions && (
        <KitCard tint={accentColor}>
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
        <KitCard tint="#d97706">
          <div className="flex items-center gap-1.5 mb-2">
            <Skull className="w-3.5 h-3.5" style={{ color: '#d97706' }} />
            <span className="text-xs font-black" style={{ color: 'var(--color-text)' }}>Stage Breakdown</span>
          </div>
          <div className="space-y-1.5">
            {d.gauntlet!.map((s) => {
              const clearPct = s.runs > 0 ? Math.round((s.clears / s.runs) * 100) : 0;
              return (
                <div key={s.stage} className="flex items-center gap-2 p-2" style={{ background: alphaHex('#d97706', 0.08), borderRadius: '10px' }}>
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
            <span className="inline-flex items-center gap-1 text-xs font-black" style={{ color: 'var(--color-text)' }}><UiIcon name="sparkles" size={14} /> Hints</span>
            <span className="text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>{d.hints.gamesCounted} games</span>
          </div>
          <div className="flex items-center justify-around mt-2">
            <div className="text-center">
              <SoftNum size={18} as="div" className="soft-num-auto">{d.hints.hintlessWinRate}%</SoftNum>
              <div className="text-[9px] font-bold uppercase" style={{ color: 'var(--color-text-muted)' }}>Hintless wins</div>
            </div>
            <div className="text-center">
              <SoftNum size={18} as="div" className="soft-num-auto">{d.hints.avgHintsPerGame}</SoftNum>
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
    <div className="mt-4 animate-fade-in-up">
      <SectionHeader label="Deep Insights" accent={accentColor} />
      {inner}
    </div>
  );
}
