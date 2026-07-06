'use client';

import { useState } from 'react';
import { MODES } from '@/lib/modes.generated';

interface SolveTimeChartProps {
  data: Array<{ date: string; timeSeconds: number; mode: string }>;
  accentColor?: string;
}

const MODE_COLORS: Record<string, string> = {
  DUEL: '#7c3aed',
  QUORDLE: '#ec4899',
  OCTORDLE: '#7e22ce',
  SEQUENCE: '#2563eb',
  RESCUE: '#059669',
  GAUNTLET: '#d97706',
  PROPERNOUNDLE: '#dc2626',
};

function formatTime(s: number): string {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return sec > 0 ? `${m}m${sec}s` : `${m}m`;
}

// Exact time for the tapped-win detail — "1:24" (native parity).
function formatTimeExact(s: number): string {
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function modeTitle(dbKey: string): string {
  return MODES.find((m) => m.dbKey === dbKey)?.title ?? dbKey;
}

function formatDay(date: string): string {
  return new Date(date + 'T00:00:00Z').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export function SolveTimeChart({ data, accentColor: customColor }: SolveTimeChartProps) {
  // Tapped point's index — shows "Jul 3 · Classic · 1:24".
  const [selected, setSelected] = useState<number | null>(null);

  if (data.length < 2) {
    return (
      <div
        className="p-4 text-center"
        style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '16px' }}
      >
        <p className="text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>
          Win more games to see your solve time trend
        </p>
      </div>
    );
  }

  const times = data.map((d) => d.timeSeconds);
  const maxTime = Math.max(...times);
  const minTime = Math.min(...times);
  const avgTime = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
  const range = Math.max(1, maxTime - minTime);

  const chartH = 100;
  const chartW = 280;
  const padX = 0;
  const padY = 8;
  const usableW = chartW - padX * 2;
  const usableH = chartH - padY * 2;

  const points = data.map((d, i) => {
    const x = padX + (i / (data.length - 1)) * usableW;
    const y = padY + (1 - (d.timeSeconds - minTime) / range) * usableH;
    return { x, y, ...d };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaPath = `${linePath} L${points[points.length - 1].x},${chartH} L${points[0].x},${chartH} Z`;

  const avgY = padY + (1 - (avgTime - minTime) / range) * usableH;

  const selectedPoint = selected !== null ? points[selected] : undefined;

  // Click snaps to the nearest win along the x axis; click it again to clear.
  function handleClick(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * chartW;
    let nearest = 0;
    for (let i = 1; i < points.length; i++) {
      if (Math.abs(points[i].x - x) < Math.abs(points[nearest].x - x)) nearest = i;
    }
    setSelected(selected === nearest ? null : nearest);
  }

  return (
    <div
      className="p-4"
      style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '16px' }}
    >
      <svg
        viewBox={`0 0 ${chartW} ${chartH}`}
        className="w-full cursor-pointer"
        style={{ height: '120px' }}
        onClick={handleClick}
      >
        <defs>
          <linearGradient id="timeGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={customColor || '#a78bfa'} stopOpacity="0.3" />
            <stop offset="100%" stopColor={customColor || '#a78bfa'} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#timeGrad)" />
        <line
          x1={padX}
          y1={avgY}
          x2={chartW - padX}
          y2={avgY}
          stroke="var(--color-border)"
          strokeWidth="1"
          strokeDasharray="4,3"
        />
        {selectedPoint && (
          <line
            x1={selectedPoint.x}
            y1={0}
            x2={selectedPoint.x}
            y2={chartH}
            stroke={MODE_COLORS[selectedPoint.mode] || '#7c3aed'}
            strokeOpacity="0.6"
            strokeWidth="1"
            strokeDasharray="3,3"
          />
        )}
        <path d={linePath} fill="none" stroke={customColor || '#7c3aed'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={selected === i ? 5 : 3}
            fill={MODE_COLORS[p.mode] || '#7c3aed'}
            fillOpacity={selected === null || selected === i ? 1 : 0.4}
            stroke="var(--color-surface)"
            strokeWidth="1.5"
          />
        ))}
      </svg>

      {/* Tapped-win detail: date, mode, exact time. */}
      {selectedPoint && (
        <p className="text-[10px] font-black text-center mt-1" style={{ color: MODE_COLORS[selectedPoint.mode] || '#7c3aed' }}>
          {formatDay(selectedPoint.date)} · {modeTitle(selectedPoint.mode)} · {formatTimeExact(selectedPoint.timeSeconds)}
        </p>
      )}

      <div className="flex justify-between mt-2">
        <div className="text-center">
          <div className="text-xs font-black" style={{ color: '#6d28d9' }}>{formatTime(minTime)}</div>
          <div className="text-[9px] font-bold" style={{ color: 'var(--color-text-muted)' }}>Fastest</div>
        </div>
        <div className="text-center">
          <div className="text-xs font-black" style={{ color: '#7c3aed' }}>{formatTime(avgTime)}</div>
          <div className="text-[9px] font-bold" style={{ color: 'var(--color-text-muted)' }}>Average</div>
        </div>
        <div className="text-center">
          <div className="text-xs font-black" style={{ color: '#d97706' }}>{formatTime(maxTime)}</div>
          <div className="text-[9px] font-bold" style={{ color: 'var(--color-text-muted)' }}>Slowest</div>
        </div>
      </div>
      <p className="text-[10px] font-bold text-center mt-1" style={{ color: 'var(--color-text-muted)' }}>
        Last {data.length} solo wins
      </p>
    </div>
  );
}
