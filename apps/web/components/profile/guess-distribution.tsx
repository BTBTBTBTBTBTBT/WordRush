'use client';

import { useState } from 'react';
import { CORRECT_GRADIENT, PRESENT_GRADIENT } from '@/lib/tile-theme';

interface GuessDistributionProps {
  data: Array<{ guesses: number; count: number }>;
  accentColor?: string;
}

export function GuessDistribution({ data, accentColor }: GuessDistributionProps) {
  // Tapped bar's label — shows "N guesses · X wins · Y% of wins".
  const [selected, setSelected] = useState<string | null>(null);

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

  function barLabel(d: GuessDistributionProps['data'][number]): string {
    return (d as { label?: string }).label ?? String(d.guesses);
  }

  const selectedBar = selected ? data.find((d) => barLabel(d) === selected) : undefined;

  return (
    <div
      className="p-4"
      style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '16px' }}
    >
      <div className="space-y-1.5">
        {data.map((d) => {
          const pct = (d.count / maxCount) * 100;
          const widthPct = Math.max(8, pct);
          const label = barLabel(d);
          return (
            <div
              key={d.guesses}
              className={`flex items-center gap-2 ${d.count > 0 ? 'cursor-pointer' : ''}`}
              style={{ opacity: selected === null || selected === label ? 1 : 0.35 }}
              onClick={() => {
                if (d.count > 0) setSelected(selected === label ? null : label);
              }}
            >
              <span
                className="text-xs font-black w-6 text-right shrink-0"
                style={{ color: 'var(--color-text)' }}
              >
                {label}
              </span>
              <div className="flex-1 h-6 relative">
                <div
                  className="h-full rounded-r flex items-center justify-end pr-2 transition-all duration-500"
                  style={{
                    width: `${widthPct}%`,
                    background: accentColor
                      ? `linear-gradient(90deg, ${accentColor}, ${accentColor}cc)`
                      : d.guesses <= 2
                        ? `linear-gradient(90deg, ${CORRECT_GRADIENT[0]}, ${CORRECT_GRADIENT[1]})`
                        : d.guesses <= 4
                        ? `linear-gradient(90deg, ${PRESENT_GRADIENT[0]}, ${PRESENT_GRADIENT[1]})`
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
      {/* Footer: tapped-bar detail (wins share) or the plain total. */}
      {selectedBar && selectedBar.count > 0 ? (
        <p className="text-[10px] font-black text-center mt-2" style={{ color: '#7C3AED' }}>
          {selected} guess{selected === '1' ? '' : 'es'} · {selectedBar.count} win{selectedBar.count === 1 ? '' : 's'} · {Math.round((selectedBar.count / Math.max(1, totalGames)) * 100)}% of wins
        </p>
      ) : (
        <p className="text-[10px] font-bold text-center mt-2" style={{ color: 'var(--color-text-muted)' }}>
          {totalGames} {totalGames === 1 ? 'win' : 'wins'} total
        </p>
      )}
    </div>
  );
}
