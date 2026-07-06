'use client';

import { useState } from 'react';

interface TimeOfDayHeatmapProps {
  data: Array<{ hour: number; gamesPlayed: number; gamesWon: number }>;
  accentColor: string;
}

// "8am" / "12pm" — the tapped-hour detail label (native parity).
function hourLabel(h: number): string {
  const am = h < 12;
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve}${am ? 'am' : 'pm'}`;
}

export function TimeOfDayHeatmap({ data, accentColor }: TimeOfDayHeatmapProps) {
  // Tapped hour — shows "8am · 65 games · 52 wins" instead of the peak line.
  const [selected, setSelected] = useState<number | null>(null);

  const maxGames = Math.max(1, ...data.map((d) => d.gamesPlayed));
  const totalGames = data.reduce((s, d) => s + d.gamesPlayed, 0);
  if (totalGames === 0) return null;

  const peakHour = data.reduce((best, d) => d.gamesPlayed > best.gamesPlayed ? d : best, data[0]);
  const selectedHour = selected !== null ? data.find((d) => d.hour === selected) : undefined;

  function getOpacity(count: number): number {
    if (count === 0) return 0.08;
    return 0.2 + (count / maxGames) * 0.8;
  }

  function formatHour(h: number): string {
    if (h === 0) return '12a';
    if (h === 12) return '12p';
    return h < 12 ? `${h}a` : `${h - 12}p`;
  }

  return (
    <div>
      <div className="flex gap-[2px]">
        {data.map((d) => (
          <div
            key={d.hour}
            className={`flex-1 rounded-sm relative group ${d.gamesPlayed > 0 ? 'cursor-pointer' : ''}`}
            style={{
              height: '28px',
              minWidth: '0',
              boxShadow: selected === d.hour ? '0 0 0 1.5px #7C3AED' : undefined,
            }}
            onClick={() => {
              setSelected(selected === d.hour || d.gamesPlayed === 0 ? null : d.hour);
            }}
            title={`${formatHour(d.hour)}: ${d.gamesPlayed} games, ${d.gamesWon} won`}
          >
            <div
              className="absolute inset-0 rounded-sm"
              style={{
                background: accentColor,
                opacity: getOpacity(d.gamesPlayed),
              }}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[8px] font-bold" style={{ color: 'var(--color-text-muted)' }}>12a</span>
        <span className="text-[8px] font-bold" style={{ color: 'var(--color-text-muted)' }}>6a</span>
        <span className="text-[8px] font-bold" style={{ color: 'var(--color-text-muted)' }}>12p</span>
        <span className="text-[8px] font-bold" style={{ color: 'var(--color-text-muted)' }}>6p</span>
        <span className="text-[8px] font-bold" style={{ color: 'var(--color-text-muted)' }}>12a</span>
      </div>
      <div className="text-center mt-1">
        {/* Tapped-hour detail when selected; the peak line otherwise. */}
        {selectedHour && selectedHour.gamesPlayed > 0 ? (
          <span className="text-[9px] font-black" style={{ color: '#7C3AED' }}>
            {hourLabel(selectedHour.hour)} · {selectedHour.gamesPlayed} game{selectedHour.gamesPlayed === 1 ? '' : 's'} · {selectedHour.gamesWon} win{selectedHour.gamesWon === 1 ? '' : 's'}
          </span>
        ) : (
          <span className="text-[9px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
            Peak: {formatHour(peakHour.hour)} · {totalGames} total games
          </span>
        )}
      </div>
    </div>
  );
}
