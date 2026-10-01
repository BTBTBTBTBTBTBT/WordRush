'use client';

import { useState } from 'react';
import { CORRECT_GRADIENT, PRESENT_GRADIENT } from '@/lib/tile-theme';

interface GuessDistributionProps {
  data: Array<{ guesses: number; count: number }>;
  accentColor?: string;
  /** The unit each bar counts (More Games §18): guess/guesses by default,
   *  check/checks for Muddle — the card title, empty state and footer follow. */
  noun?: { one: string; many: string };
  /** Hubbub's chart counts every game, not just wins (founder, 2026-10-01). */
  unit?: 'wins' | 'games';
}

const GUESS_NOUN = { one: 'guess', many: 'guesses' };

export function GuessDistribution({ data, accentColor, noun = GUESS_NOUN, unit = 'wins' }: GuessDistributionProps) {
  // Tapped bar's label — shows "N guesses · X wins · Y% of wins".
  const [selected, setSelected] = useState<string | null>(null);

  const maxCount = Math.max(1, ...data.map((d) => d.count));
  const totalGames = data.reduce((sum, d) => sum + d.count, 0);
  const title = `${noun.one} distribution`;

  if (totalGames === 0) {
    return (
      <div
        className="p-4 text-center"
        style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '16px' }}
      >
        <p className="text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>
          {unit === 'games' ? 'Play a game' : 'Win a game'} to see your {title}
        </p>
      </div>
    );
  }

  function barLabel(d: GuessDistributionProps['data'][number]): string {
    return (d as { label?: string }).label ?? String(d.guesses);
  }

  const selectedBar = selected ? data.find((d) => barLabel(d) === selected) : undefined;
  // Word labels (Par, +2, Hubbub's ranks) need a wider column than "1".."13".
  const wideLabels = data.some((d) => barLabel(d).length > 3);
  const one = unit === 'games' ? 'game' : 'win';
  const many = unit === 'games' ? 'games' : 'wins';
  const tappedLine = (label: string, n: number) => {
    const head = /^\d+\+?$/.test(label) ? `${label} ${label === '1' ? noun.one : noun.many}` : label;
    return `${head} · ${n} ${n === 1 ? one : many} · ${Math.round((n / Math.max(1, totalGames)) * 100)}% of ${many}`;
  };

  return (
    <div
      className="p-4"
      style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '16px' }}
    >
      {/* Only a non-default unit needs naming — the word modes' card is unchanged. */}
      {noun !== GUESS_NOUN && (
        <div className="section-header mb-2">{title.toUpperCase()}</div>
      )}
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
                className={`text-xs font-black text-right shrink-0 ${wideLabels ? 'w-24 truncate' : 'w-6'}`}
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
          {tappedLine(selected as string, selectedBar.count)}
        </p>
      ) : (
        <p className="text-[10px] font-bold text-center mt-2" style={{ color: 'var(--color-text-muted)' }}>
          {totalGames} {totalGames === 1 ? one : many} total
        </p>
      )}
    </div>
  );
}
