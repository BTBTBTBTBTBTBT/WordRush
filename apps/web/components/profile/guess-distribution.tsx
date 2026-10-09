'use client';

import { useState } from 'react';
import { CORRECT_GRADIENT, PRESENT_GRADIENT } from '@/lib/tile-theme';
import { softCard } from '@/lib/soft-surface';
import { CAST_COLORS, showGuessDistribution } from '@wordle-duel/core';
import { BubbleText } from '@/components/ui/bubble-text';

interface GuessDistributionProps {
  data: Array<{ guesses: number; count: number }>;
  accentColor?: string;
  /** The unit each bar counts (More Games §18): guess/guesses by default,
   *  check/checks for Muddle — the card title, empty state and footer follow. */
  noun?: { one: string; many: string };
  /** Hubbub's chart counts every game, not just wins (founder, 2026-10-01). */
  unit?: 'wins' | 'games';
  /** "Best 4": the player's best result, shown small in the card's header (moved here from the stat grid). */
  best?: string | null;
  /** The caller already drew a section title above (the All-time page): skip the card's own. */
  untitled?: boolean;
}

const GUESS_NOUN = { one: 'guess', many: 'guesses' };

export function GuessDistribution({ data, accentColor, noun = GUESS_NOUN, unit = 'wins', best = null, untitled = false }: GuessDistributionProps) {
  // Tapped bar's label — shows "N guesses · X wins · Y% of wins".
  const [selected, setSelected] = useState<string | null>(null);

  const maxCount = Math.max(1, ...data.map((d) => d.count));
  const totalGames = data.reduce((sum, d) => sum + d.count, 0);

  // Item 16 (founder 10-07): hidden until there is a win (core showGuessDistribution) — no placeholder sentence.
  if (!showGuessDistribution(data)) return null;

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
      style={softCard(accentColor ?? '#2563eb', { radius: 18 })}
    >
      {/* Only a non-default unit needs naming — the word modes' card is unchanged. */}
      {(!untitled || best) && (
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0" style={{ maxWidth: 200 }}>
            {!untitled && <BubbleText text={noun.many.toUpperCase()} accent={CAST_COLORS.I} align="left" maxSize={20} minSize={13} level={3} />}
          </div>
          {best && <span className="text-[10px] font-black" style={{ color: accentColor ?? '#7C3AED' }}>Best {best}</span>}
        </div>
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
