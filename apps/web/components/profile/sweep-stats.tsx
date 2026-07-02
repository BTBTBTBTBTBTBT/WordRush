'use client';

import { Trophy, Sparkles, Flame } from 'lucide-react';
import type { DailySweepStats, DailyPointsPoint } from '@/lib/stats-service';

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
      <div className="text-lg font-black" style={{ color: color ?? 'var(--color-text)' }}>{value}</div>
      <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{label}</div>
    </div>
  );
}

// Exported: Profile's Trends section renders this chart alone — the sweep
// COUNTS grid now lives solely on Records → You (page-role split).
export function PointsChart({ points }: { points: DailyPointsPoint[] }) {
  if (points.length < 2) return null;
  const W = 320, H = 90, pad = 6;
  const max = Math.max(1, ...points.map((p) => p.totalPoints));
  const stepX = (W - pad * 2) / (points.length - 1);
  const x = (i: number) => pad + i * stepX;
  const y = (v: number) => H - pad - (v / max) * (H - pad * 2);
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p.totalPoints).toFixed(1)}`).join(' ');
  const area = `${line} L ${x(points.length - 1).toFixed(1)} ${H - pad} L ${x(0).toFixed(1)} ${H - pad} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full mt-3" style={{ height: 90 }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="sweepArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#sweepArea)" />
      <path d={line} fill="none" stroke="#7c3aed" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        (p.swept || p.flawless) ? (
          <circle key={i} cx={x(i)} cy={y(p.totalPoints)} r={3.5}
            fill={p.flawless ? '#f59e0b' : '#ec4899'} stroke="#fff" strokeWidth={1} />
        ) : null
      ))}
    </svg>
  );
}

export function SweepStatsCard({ stats, points }: { stats: DailySweepStats; points: DailyPointsPoint[] }) {
  return (
    <div className="p-4" style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '16px' }}>
      <div className="grid grid-cols-3 gap-y-3">
        <div className="flex flex-col items-center gap-1">
          <Sparkles className="w-4 h-4" style={{ color: '#7c3aed' }} />
          <Stat label="Sweeps" value={String(stats.sweepCount)} color="#7c3aed" />
        </div>
        <div className="flex flex-col items-center gap-1">
          <Trophy className="w-4 h-4" style={{ color: '#d97706' }} fill="currentColor" />
          <Stat label="Flawless" value={String(stats.flawlessCount)} color="#d97706" />
        </div>
        <div className="flex flex-col items-center gap-1">
          <Flame className="w-4 h-4" style={{ color: '#ef4444' }} />
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
