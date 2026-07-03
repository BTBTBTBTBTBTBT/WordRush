'use client';

import Link from 'next/link';
import { ArrowRight, Trophy } from 'lucide-react';
import { useDailyCompletions } from '@/lib/daily-completions-context';
import { PROFILE_MODES } from '@/components/profile/mode-picker';

// Canonical daily order + routes — mirrors DAILY_MODES on the profile page
// and the home grid order. First unplayed mode in this order is "next".
const DAILY_ORDER: Array<{ id: string; href: string }> = [
  { id: 'DUEL',          href: '/practice?daily=true' },
  { id: 'QUORDLE',       href: '/quordle?daily=true' },
  { id: 'OCTORDLE',      href: '/octordle?daily=true' },
  { id: 'SEQUENCE',      href: '/sequence?daily=true' },
  { id: 'RESCUE',        href: '/rescue?daily=true' },
  { id: 'DUEL_6',        href: '/six?daily=true' },
  { id: 'DUEL_7',        href: '/seven?daily=true' },
  { id: 'GAUNTLET',      href: '/gauntlet?daily=true' },
  { id: 'PROPERNOUNDLE', href: '/propernoundle?daily=true' },
];

/**
 * U3: post-game handoff that keeps the daily loop moving. Rendered only on
 * DAILY results — points at the first unplayed daily mode, or celebrates
 * the sweep when all 9 are done. `currentMode` is excluded explicitly so a
 * just-finished game never suggests itself while its completion event is
 * still propagating into the completions context.
 */
export function NextDailyCta({ currentMode }: { currentMode: string }) {
  const { todayDailies } = useDailyCompletions();

  const next = DAILY_ORDER.find(
    (m) => m.id !== currentMode && !todayDailies.has(m.id),
  );

  if (!next) {
    return (
      <div
        className="w-full max-w-[400px] mx-auto mt-3 px-3 py-2.5 flex items-center justify-center gap-2 text-xs font-black"
        style={{
          background: 'var(--color-highlight-gold)',
          border: '1.5px solid var(--color-gold-border)',
          borderRadius: '12px',
          color: '#92400e',
        }}
      >
        <Trophy className="w-3.5 h-3.5" />
        All 9 dailies done — Sweep complete! 🏆
      </div>
    );
  }

  const mode = PROFILE_MODES.find((m) => m.dbKey === next.id);
  if (!mode) return null;
  const color = mode.accentColor;
  const Icon = mode.icon;

  return (
    <Link
      href={next.href}
      className="w-full max-w-[400px] mx-auto mt-3 px-3 py-2.5 flex items-center justify-between transition-transform active:scale-[0.98]"
      style={{
        background: 'var(--color-surface)',
        border: `1.5px solid ${color}55`,
        borderRadius: '12px',
      }}
    >
      <span className="flex items-center gap-2 min-w-0">
        <span
          className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
          style={{ background: `${color}15` }}
        >
          {mode.romanNumeral ? (
            <span className="text-[9px] font-black leading-none" style={{ color }}>{mode.romanNumeral}</span>
          ) : Icon ? (
            <Icon className="w-3.5 h-3.5" style={{ color }} />
          ) : null}
        </span>
        <span className="text-xs font-black truncate" style={{ color: 'var(--color-text)' }}>
          Next Daily: <span style={{ color }}>{mode.title}</span>
        </span>
      </span>
      <ArrowRight className="w-4 h-4 flex-shrink-0" style={{ color }} />
    </Link>
  );
}
