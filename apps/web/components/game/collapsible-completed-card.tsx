'use client';

import { createContext, useContext, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { accentInk, cardBarStyle, softCard } from '@/lib/soft-surface';
import { Icon3D } from '@/components/ui/icon3d';
import { SoftNum } from '@/components/ui/soft-number';

/** The "Completed Today" ink (purple on light, a light lilac on the dark card). */
const WON_INK = accentInk('#7c3aed', '#7c3aed');

/**
 * The Leaderboard redesign (docs/LEADERBOARD_REDESIGN_SPEC.md §2.2) shows the
 * completed board "in a soft card": no border, radius 14, soft shadow. Pages
 * opt in by wrapping the board in <SoftCompletedCards>; everywhere else keeps
 * the bordered card.
 */
const SoftCardContext = createContext(false);
/**
 * BJ7: under the Leaderboard's result row, whose line already says how it went
 * ("#2 of 3 · 2,323 PTS · Solved in 3 guesses · 23s"), the card's header reads
 * YOUR BOARD alone — no duplicate "COMPLETED TODAY · 3/6 · 23s" on the screen.
 */
const UnderRankContext = createContext(false);
export function SoftCompletedCards({ children, underRank = false }: { children: React.ReactNode; underRank?: boolean }) {
  return (
    <SoftCardContext.Provider value={true}>
      <UnderRankContext.Provider value={underRank}>{children}</UnderRankContext.Provider>
    </SoftCardContext.Provider>
  );
}

/** Collapsible card wrapper used by all completed daily board variants */
export function CollapsibleCompletedCard({
  won,
  summaryLabel,
  children,
}: {
  won: boolean;
  summaryLabel: string;
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const soft = useContext(SoftCardContext);
  const underRank = useContext(UnderRankContext);

  // FINISH_SPEC A1 + B6: a tinted card in purple (won) / slate (lost) with
  // the game-card top bar, the 3D W / L badge, the summary as a soft number.
  const accent = won ? '#7c3aed' : '#6b7891';
  return (
    <div
      className="mb-3"
      style={{
        ...softCard(accent, { radius: soft ? 14 : 16 }),
        overflow: 'hidden',
      }}
    >
      {/* The game-card top bar. */}
      <div aria-hidden="true" style={cardBarStyle(accent)} />

      {/* Collapsible header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        className="w-full flex items-center justify-between px-3 py-2"
        style={{ minHeight: 44 }}
      >
        <div className="flex items-center gap-2">
          <Icon3D name={won ? 'badge-w' : 'badge-l'} size={22} label={won ? 'Won' : 'Lost'} />
          <span
            className={`text-[10px] font-extrabold uppercase tracking-wider ${won ? WON_INK.className : ''}`}
            style={won ? WON_INK.style : { color: 'var(--color-text-secondary)' }}
          >
            {underRank ? 'Your board' : `${won ? 'Completed' : 'Attempted'} Today`}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {!underRank && <SoftNum size={13}>{summaryLabel}</SoftNum>}
          <ChevronDown
            className="w-3.5 h-3.5 transition-transform duration-200"
            style={{
              color: 'var(--color-text-muted)',
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          />
        </div>
      </button>

      {/* Collapsible content */}
      <div
        className="overflow-hidden transition-all duration-200"
        style={{ maxHeight: expanded ? '2000px' : '0px', opacity: expanded ? 1 : 0 }}
      >
        <div className="px-4 pb-4">
          {children}
        </div>
      </div>
    </div>
  );
}
