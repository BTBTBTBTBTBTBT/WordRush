'use client';

interface TimeOfDayHeatmapProps {
  data: Array<{ hour: number; gamesPlayed: number; gamesWon: number }>;
  accentColor: string;
}

export function TimeOfDayHeatmap({ data, accentColor }: TimeOfDayHeatmapProps) {
  const maxGames = Math.max(1, ...data.map((d) => d.gamesPlayed));
  const totalGames = data.reduce((s, d) => s + d.gamesPlayed, 0);
  if (totalGames === 0) return null;

  const peakHour = data.reduce((best, d) => d.gamesPlayed > best.gamesPlayed ? d : best, data[0]);

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
            className="flex-1 rounded-sm relative group"
            style={{
              height: '28px',
              background: accentColor,
              opacity: getOpacity(d.gamesPlayed),
              minWidth: '0',
            }}
            title={`${formatHour(d.hour)}: ${d.gamesPlayed} games, ${d.gamesWon} won`}
          />
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
        <span className="text-[9px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
          Peak: {formatHour(peakHour.hour)} · {totalGames} total games
        </span>
      </div>
    </div>
  );
}
