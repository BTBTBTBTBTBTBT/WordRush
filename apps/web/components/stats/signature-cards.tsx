'use client';

import { useEffect, useState } from 'react';
import { CalendarDays, CalendarRange, Undo2, Star, TrendingUp } from 'lucide-react';
import { KitCard, StatCell, ChartCard, ProLockOverlay } from '@/components/profile/stat-kit';
import { WIN_FG } from '@/lib/tile-theme';
import { fetchSignatureStats, fetchStandingTrend, type SignatureStats, type StandingPoint } from '@/lib/signature-stats';

// The audit's new stats on the All-time page (D2). Free: SignatureCard — Best
// day, Best week, Comebacks (a win on the very last row), Perfect games. Pro:
// StandingTrendCard — your average Top X% per day over the last 30 days, the
// one badge formula, blurred behind the Pro lock for free players.

const fmtDay = (day: string) => new Date(`${day}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const fmtWeek = (monday: string) => {
  const m = new Date(`${monday}T00:00:00`); const s = new Date(m); s.setDate(m.getDate() + 6);
  return `${fmtDay(monday)}–${s.toLocaleDateString('en-US', { day: 'numeric' })}`;
};

export function SignatureCard({ userId }: { userId: string }) {
  const [s, setS] = useState<SignatureStats | null>(null);
  useEffect(() => {
    let active = true;
    fetchSignatureStats(userId).then((v) => { if (active) setS(v); }).catch(() => {});
    return () => { active = false; };
  }, [userId]);
  if (!s) return null;
  return (
    <KitCard>
      <div className="grid grid-cols-4 gap-y-3 gap-x-2">
        <StatCell icon={CalendarDays} label="Best day" value={s.bestDay ? s.bestDay.wins : '—'} sub={s.bestDay ? `${fmtDay(s.bestDay.day)} · wins` : undefined} color="#7c3aed" />
        <StatCell icon={CalendarRange} label="Best week" value={s.bestWeek ? s.bestWeek.wins : '—'} sub={s.bestWeek ? `${fmtWeek(s.bestWeek.weekStart)} · wins` : undefined} color="#2563eb" />
        <StatCell icon={Undo2} label="Comebacks" value={s.comebacks} sub="last-row wins" color="#f97316" />
        <StatCell icon={Star} label="Perfect" value={s.perfectGames} sub="games" color={WIN_FG} />
      </div>
    </KitCard>
  );
}

export function StandingTrendCard({ userId, isPro }: { userId: string; isPro: boolean }) {
  const [pts, setPts] = useState<StandingPoint[] | null>(null);
  useEffect(() => {
    if (!isPro) { setPts([]); return; }
    let active = true;
    fetchStandingTrend(userId, 30).then((v) => { if (active) setPts(v); }).catch(() => { if (active) setPts([]); });
    return () => { active = false; };
  }, [userId, isPro]);
  // A sample curve for the locked preview so free players see the shape.
  const data = isPro ? (pts ?? []) : [38, 31, 27, 22, 25, 18, 14, 16, 12, 9].map((p, i) => ({ day: `d${i}`, topPercent: p, modes: 3 }));
  if (isPro && pts !== null && pts.length < 2) return null;
  const w = 300, h = 80, pad = 6;
  const xs = data.map((_, i) => pad + (i * (w - pad * 2)) / Math.max(1, data.length - 1));
  const ys = data.map((d) => pad + ((d.topPercent - 1) / 99) * (h - pad * 2)); // 1% at the top
  const path = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
  const latest = data[data.length - 1];
  const first = data[0];
  const improving = latest && first ? latest.topPercent < first.topPercent : false;
  const chart = (
    <ChartCard
      title="Standing trend"
      hint={data.length ? `Last 30 days · now Top ${latest.topPercent}%${improving ? ' · climbing' : ''}` : undefined}
      empty={!data.length ? 'Play a few dailies to see your standing over time.' : undefined}
    >
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: 80 }} aria-label="Average daily standing, lower is better">
        <line x1={pad} x2={w - pad} y1={pad + ((25 - 1) / 99) * (h - pad * 2)} y2={pad + ((25 - 1) / 99) * (h - pad * 2)} stroke="var(--color-border)" strokeDasharray="3 3" />
        <path d={path} fill="none" stroke="#7c3aed" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        {xs.map((x, i) => <circle key={i} cx={x} cy={ys[i]} r={2.5} fill={data[i].topPercent <= 25 ? '#d97706' : '#7c3aed'} />)}
      </svg>
      <div className="flex justify-between text-[9px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
        <span>{data.length ? fmtDayLabel(first.day) : ''}</span>
        <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" /> dashed = Top 25%</span>
        <span>{data.length ? fmtDayLabel(latest.day) : ''}</span>
      </div>
    </ChartCard>
  );
  return isPro ? chart : <ProLockOverlay label="Standing trend — Pro">{chart}</ProLockOverlay>;
}

function fmtDayLabel(day: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? fmtDay(day) : '';
}
