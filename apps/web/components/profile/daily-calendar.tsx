'use client';

interface DailyCalendarProps {
  data: Array<{ day: string; gamesPlayed: number; gamesWon: number }>;
}

export function DailyCalendar({ data }: DailyCalendarProps) {
  if (data.length === 0) return null;

  const maxGames = Math.max(1, ...data.map((d) => d.gamesPlayed));
  const totalDaysPlayed = data.filter((d) => d.gamesPlayed > 0).length;
  const totalGames = data.reduce((s, d) => s + d.gamesPlayed, 0);

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
    const winRatio = d.gamesWon / d.gamesPlayed;
    if (winRatio >= 0.8) {
      if (intensity > 0.6) return '#16a34a';
      if (intensity > 0.3) return '#4ade80';
      return '#86efac';
    }
    if (intensity > 0.6) return '#7c3aed';
    if (intensity > 0.3) return '#a78bfa';
    return '#c4b5fd';
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
        <div className="flex gap-0 mb-1 relative" style={{ height: '14px' }}>
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

      <div className="flex gap-[3px] overflow-x-auto">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-[3px]">
            {week.map((d, di) => (
              <div
                key={di}
                className="rounded-sm"
                style={{
                  width: '10px',
                  height: '10px',
                  background: getCellColor(d),
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

      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-1">
          <span className="text-[9px] font-bold" style={{ color: 'var(--color-text-muted)' }}>Less</span>
          {['#f3f0ff', '#c4b5fd', '#a78bfa', '#7c3aed', '#16a34a'].map((c, i) => (
            <div
              key={i}
              className="rounded-sm"
              style={{ width: '8px', height: '8px', background: c }}
            />
          ))}
          <span className="text-[9px] font-bold" style={{ color: 'var(--color-text-muted)' }}>More</span>
        </div>
        <span className="text-[9px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
          {totalDaysPlayed} days · {totalGames} games
        </span>
      </div>
    </div>
  );
}
