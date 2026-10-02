'use client';

import { createContext, useContext, useState } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * The Leaderboard redesign (docs/LEADERBOARD_REDESIGN_SPEC.md §2.2) shows the
 * completed board "in a soft card": no border, radius 14, soft shadow. Pages
 * opt in by wrapping the board in <SoftCompletedCards>; everywhere else keeps
 * the bordered card.
 */
const SoftCardContext = createContext(false);
export function SoftCompletedCards({ children }: { children: React.ReactNode }) {
  return <SoftCardContext.Provider value={true}>{children}</SoftCardContext.Provider>;
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

  return (
    <div
      className="mb-4"
      style={{
        background: 'var(--color-surface)',
        ...(soft
          ? { borderRadius: 14, boxShadow: '0 2px 10px rgba(26,26,46,0.06)' }
          : { border: '1.5px solid var(--color-border)', borderRadius: '16px' }),
        overflow: 'hidden',
      }}
    >
      {/* Top accent */}
      <div
        className="h-1"
        style={{
          background: won
            ? 'linear-gradient(90deg, #7c3aed, #a78bfa)'
            : 'linear-gradient(90deg, #9ca3af, #d1d5db)',
        }}
      />

      {/* Collapsible header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2.5"
      >
        <div className="flex items-center gap-2">
          <span
            className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black flex-shrink-0"
            style={{
              background: won ? '#f5f3ff' : '#fee2e2',
              color: won ? '#7c3aed' : '#dc2626',
            }}
          >
            {won ? '✓' : '✗'}
          </span>
          <span
            className="text-[10px] font-extrabold uppercase tracking-wider"
            style={{ color: won ? '#7c3aed' : 'var(--color-text-muted)' }}
          >
            {won ? 'Completed' : 'Attempted'} Today
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
            {summaryLabel}
          </span>
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
