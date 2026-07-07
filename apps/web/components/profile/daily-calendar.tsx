'use client';

import { useState } from 'react';
import { CALENDAR_RAMP } from '@/lib/tile-theme';

interface DailyCalendarProps {
  data: Array<{ day: string; gamesPlayed: number; gamesWon: number }>;
}

const DAY_LABEL_W = 26;

function formatDay(day: string): string {
  return new Date(day + 'T00:00:00Z').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export function DailyCalendar({ data }: DailyCalendarProps) {
  // Tapped day — shows "Jul 3 · 12 games · 9 wins" in the footer.
  const [selected, setSelected] = useState<string | null>(null);

  if (data.length === 0) return null;

  const maxGames = Math.max(1, ...data.map((d) => d.gamesPlayed));
  const totalDaysPlayed = data.filter((d) => d.gamesPlayed > 0).length;
  const totalGames = data.reduce((s, d) => s + d.gamesPlayed, 0);
  const selectedDay = selected ? data.find((d) => d.day === selected) : undefined;

  const weeks: Array<Array<typeof data[number] | null>> = [];
  let currentWeek: Array<typeof data[number] | null> = [];

  const firstDate = new Date(data[0].day + 'T00:00:00Z');
  const startDow = firstDate.getUTCDay();
  for (let i = 0; i < startDow; i++) currentWeek.push(null);

  for (const entry of data) {
    currentWeek.push(entry);
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) currentWeek.push(null);
    weeks.push(currentWeek);
  }

  function getCellColor(d: typeof data[number] | null): string {
    if (!d || d.gamesPlayed === 0) return 'var(--color-surface-hover)';
    const intensity = d.gamesPlayed / maxGames;
    if (intensity > 0.6) return CALENDAR_RAMP[2];
    if (intensity > 0.3) return CALENDAR_RAMP[1];
    return CALENDAR_RAMP[0];
  }

  const months: Array<{ label: string; colStart: number }> = [];
  let lastMonth = '';
  weeks.forEach((week, wi) => {
    for (const d of week) {
      if (!d) continue;
      const m = new Date(d.day + 'T00:00:00Z').toLocaleDateString('en-US', {
        month: 'short',
        timeZone: 'UTC',
      });
      if (m !== lastMonth) {
        months.push({ label: m, colStart: wi });
        lastMonth = m;
      }
      break;
    }
  });

  return (
    <div
      className="p-4"
      style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '16px' }}
    >
      {months.length > 0 && (
        <div className="flex gap-0 mb-1 relative" style={{ height: '14px', marginLeft: `${DAY_LABEL_W}px` }}>
          {months.map((m, i) => (
            <span
              key={i}
              className="text-[9px] font-bold absolute"
              style={{
                color: 'var(--color-text-muted)',
                left: `${(m.colStart / weeks.length) * 100}%`,
              }}
            >
              {m.label}
            </span>
          ))}
        </div>
      )}

      {/* Cells scale to fill the card (flex-1 columns + square aspect) so the
          heatmap spans the full width — and the %-positioned month labels
          above actually line up with their columns (they drifted when the
          grid was fixed 10px cells). Mirrors the native full-width fix. */}
      <div className="flex gap-1">
        {/* Weekday guide (rows are Sun→Sat; label Mon/Wed/Fri). flex-1 rows
            track the scaled cell height so labels stay row-aligned. */}
        <div className="flex flex-col gap-[3px] shrink-0" style={{ width: `${DAY_LABEL_W - 4}px` }}>
          {Array.from({ length: 7 }, (_, r) => (
            <span
              key={r}
              className="text-[8px] font-bold leading-none flex items-center flex-1"
              style={{ color: 'var(--color-text-muted)' }}
            >
              {r === 1 ? 'Mon' : r === 3 ? 'Wed' : r === 5 ? 'Fri' : ''}
            </span>
          ))}
        </div>
        <div className="flex gap-[3px] flex-1 min-w-0">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px] flex-1 min-w-0">
              {week.map((d, di) => (
                <div
                  key={di}
                  className={`rounded-sm w-full ${d && d.gamesPlayed > 0 ? 'cursor-pointer' : ''}`}
                  style={{
                    aspectRatio: '1 / 1',
                    background: getCellColor(d),
                    boxShadow: d && selected === d.day ? 'inset 0 0 0 1.5px #7C3AED' : undefined,
                  }}
                  onClick={() => {
                    if (d && d.gamesPlayed > 0) {
                      setSelected(selected === d.day ? null : d.day);
                    } else {
                      setSelected(null);
                    }
                  }}
                  title={
                    d
                      ? `${d.day}: ${d.gamesPlayed} game${d.gamesPlayed !== 1 ? 's' : ''}, ${d.gamesWon} won`
                      : ''
                  }
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-1">
          <span className="text-[9px] font-bold" style={{ color: 'var(--color-text-muted)' }}>Less</span>
          {['#f3f0ff', ...CALENDAR_RAMP].map((c, i) => (
            <div
              key={i}
              className="rounded-sm"
              style={{ width: '8px', height: '8px', background: c }}
            />
          ))}
          <span className="text-[9px] font-bold" style={{ color: 'var(--color-text-muted)' }}>More</span>
        </div>
        {/* Tapped-day detail when selected, totals otherwise. */}
        {selectedDay ? (
          <span className="text-[9px] font-black" style={{ color: '#7C3AED' }}>
            {formatDay(selectedDay.day)} · {selectedDay.gamesPlayed} game{selectedDay.gamesPlayed === 1 ? '' : 's'} · {selectedDay.gamesWon} win{selectedDay.gamesWon === 1 ? '' : 's'}
          </span>
        ) : (
          <span className="text-[9px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
            {totalDaysPlayed} days · {totalGames} games
          </span>
        )}
      </div>
    </div>
  );
}
