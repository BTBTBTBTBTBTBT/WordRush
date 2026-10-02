'use client';

import { Sparkles } from 'lucide-react';
import { Icon3D } from '@/components/ui/icon3d';
import type { DailySweepStats, DailyPointsPoint } from '@/lib/stats-service';
import { softCard } from '@/lib/soft-surface';
import { SoftNum } from '@/components/ui/soft-number';

// Profile "All"-view card: Daily Sweep / Flawless Victory stats + a
// daily-points-over-time area chart. Sweep days are marked violet, flawless
// days gold.

function fmtTime(s: number): string {
  if (!s) return '—';
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="text-center">
      <SoftNum size={18} as="div" className="soft-num-auto">{value}</SoftNum>
      <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{label}</div>
    </div>
  );
}

// Exported: Profile's Trends section renders this chart alone — the sweep
// COUNTS grid now lives solely on Records → You (page-role split).
/** Two lines (founder, 2026-10-01 stats audit): Wordocious in violet, Puzzles in pink, each
 *  dot marking that row's own sweep (its color) or flawless (gold) day. */
export function PointsChart({ points }: { points: DailyPointsPoint[] }) {
  if (points.length < 2) return null;
  const W = 320, H = 90, pad = 6;
  const max = Math.max(1, ...points.map((p) => Math.max(p.wordPoints ?? p.totalPoints, p.puzzlePoints ?? 0)));
  const stepX = (W - pad * 2) / (points.length - 1);
  const x = (i: number) => pad + i * stepX;
  const y = (v: number) => H - pad - (v / max) * (H - pad * 2);
  const path = (v: (p: DailyPointsPoint) => number) => points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v(p)).toFixed(1)}`).join(' ');
  const wordLine = path((p) => p.wordPoints ?? p.totalPoints);
  const area = `${wordLine} L ${x(points.length - 1).toFixed(1)} ${H - pad} L ${x(0).toFixed(1)} ${H - pad} Z`;
  const hasPuzzles = points.some((p) => (p.puzzlePoints ?? 0) > 0);
  const puzzleLine = path((p) => p.puzzlePoints ?? 0);

  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full mt-3" style={{ height: 90 }} preserveAspectRatio="none">
        <defs>
          <linearGradient id="sweepArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#sweepArea)" />
        <path d={wordLine} fill="none" stroke="#7c3aed" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {hasPuzzles && <path d={puzzleLine} fill="none" stroke="#db2777" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
        {points.map((p, i) => (
          (p.swept || p.flawless) ? (
            <circle key={`w${i}`} cx={x(i)} cy={y(p.wordPoints ?? p.totalPoints)} r={3.5}
              fill={p.flawless ? '#f59e0b' : '#7c3aed'} stroke="#fff" strokeWidth={1} />
          ) : null
        ))}
        {hasPuzzles && points.map((p, i) => (
          (p.puzzleSwept || p.puzzleFlawless) ? (
            <circle key={`p${i}`} cx={x(i)} cy={y(p.puzzlePoints)} r={3.5}
              fill={p.puzzleFlawless ? '#f59e0b' : '#db2777'} stroke="#fff" strokeWidth={1} />
          ) : null
        ))}
      </svg>
      <div className="flex items-center justify-center gap-3 mt-1 text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-0.5 rounded" style={{ background: '#7c3aed' }} />Wordocious</span>
        {hasPuzzles && <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-0.5 rounded" style={{ background: '#db2777' }} />Puzzles</span>}
        <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full" style={{ background: '#f59e0b' }} />flawless</span>
      </div>
    </>
  );
}

export function SweepStatsCard({ stats, points }: { stats: DailySweepStats; points: DailyPointsPoint[] }) {
  return (
    <div className="p-4" style={softCard('#7c3aed', { radius: 18 })}>
      <div className="grid grid-cols-3 gap-y-3">
        <div className="flex flex-col items-center gap-1">
          <Sparkles className="w-4 h-4" style={{ color: '#7c3aed' }} />
          <Stat label="Sweeps" value={String(stats.sweepCount)} color="#7c3aed" />
        </div>
        <div className="flex flex-col items-center gap-1">
          <Icon3D name="trophy" size={16} />
          <Stat label="Flawless" value={String(stats.flawlessCount)} color="#d97706" />
        </div>
        <div className="flex flex-col items-center gap-1">
          <Icon3D name="flame" size={16} />
          <Stat label="Sweep Streak" value={String(stats.currentSweepStreak)} color="#ef4444" />
        </div>
        <Stat label="Avg Sweep" value={fmtTime(stats.avgSweepSecs)} />
        <Stat label="Best Sweep" value={fmtTime(stats.bestSweepSecs)} />
        <Stat label="Best Flawless" value={fmtTime(stats.bestFlawlessSecs)} />
      </div>

      {points.length >= 2 && (
        <>
          <div className="text-[10px] font-bold uppercase tracking-wider mt-4 mb-0.5" style={{ color: 'var(--color-text-muted)' }}>
            Daily Points · Last 30 Days
          </div>
          <PointsChart points={points} />
        </>
      )}
    </div>
  );
}
