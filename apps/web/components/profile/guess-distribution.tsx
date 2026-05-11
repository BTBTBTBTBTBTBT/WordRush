'use client';

interface GuessDistributionProps {
  data: Array<{ guesses: number; count: number }>;
}

export function GuessDistribution({ data }: GuessDistributionProps) {
  const maxCount = Math.max(1, ...data.map((d) => d.count));
  const totalGames = data.reduce((sum, d) => sum + d.count, 0);

  if (totalGames === 0) {
    return (
      <div
        className="p-4 text-center"
        style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '16px' }}
      >
        <p className="text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>
          Win a game to see your guess distribution
        </p>
      </div>
    );
  }

  return (
    <div
      className="p-4"
      style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '16px' }}
    >
      <div className="space-y-1.5">
        {data.map((d) => {
          const pct = (d.count / maxCount) * 100;
          const widthPct = Math.max(8, pct);
          return (
            <div key={d.guesses} className="flex items-center gap-2">
              <span
                className="text-xs font-black w-3 text-right shrink-0"
                style={{ color: 'var(--color-text)' }}
              >
                {d.guesses}
              </span>
              <div className="flex-1 h-6 relative">
                <div
                  className="h-full rounded-r flex items-center justify-end pr-2 transition-all duration-500"
                  style={{
                    width: `${widthPct}%`,
                    background:
                      d.guesses <= 2
                        ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                        : d.guesses <= 4
                        ? 'linear-gradient(90deg, #eab308, #ca8a04)'
                        : 'linear-gradient(90deg, #9ca3af, #6b7280)',
                    minWidth: d.count > 0 ? '28px' : '8px',
                  }}
                >
                  {d.count > 0 && (
                    <span className="text-[10px] font-black text-white">{d.count}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[10px] font-bold text-center mt-2" style={{ color: 'var(--color-text-muted)' }}>
        {totalGames} {totalGames === 1 ? 'win' : 'wins'} total
      </p>
    </div>
  );
}
