'use client';

import type { ReactNode, ComponentType } from 'react';
import { Lock } from 'lucide-react';
import Link from 'next/link';

// Shared visual grammar for the Profile + Records stat pages. Every section
// uses SectionHeader; every stat cell uses StatCell inside a StatGrid; every
// chart sits in a ChartCard; every Pro gate uses ProLockOverlay. One look,
// defined once — the pages previously had ~6 header styles and 4 card variants.

/** Uppercase tracked section label with an accent tick + optional right control. */
export function SectionHeader({
  label,
  accent = '#7c3aed',
  right,
}: {
  label: string;
  accent?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-2">
        <span className="w-1 h-3.5 rounded-full" style={{ background: accent }} />
        <span className="text-[11px] font-black uppercase tracking-[0.15em]" style={{ color: 'var(--color-text-muted)' }}>
          {label}
        </span>
      </div>
      {right}
    </div>
  );
}

/** The standard card surface (matches the app's rounded/bordered card idiom). */
export function KitCard({
  children,
  className = '',
  padded = true,
  accent,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
  /** Optional 3px top accent bar (mode color), like the leaderboard card. */
  accent?: string;
}) {
  return (
    <div
      className={`overflow-hidden ${className}`}
      style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '16px' }}
    >
      {accent && <div style={{ height: 3, background: accent }} />}
      <div className={padded ? 'p-4' : ''}>{children}</div>
    </div>
  );
}

export interface StatCellProps {
  icon?: ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  value: ReactNode;
  sub?: string;
  color?: string;
}

/** One stat: icon, big value, small uppercase label, optional sub line. */
export function StatCell({ icon: Icon, label, value, sub, color }: StatCellProps) {
  return (
    <div className="text-center">
      {Icon && <Icon className="w-4 h-4 mx-auto mb-1" style={{ color: color ?? 'var(--color-text-muted)' }} />}
      <div className="text-lg font-black leading-tight" style={{ color: color && !Icon ? color : 'var(--color-text)' }}>{value}</div>
      <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{label}</div>
      {sub && <div className="text-[9px] font-bold" style={{ color: 'var(--color-text-muted)' }}>{sub}</div>}
    </div>
  );
}

/** Grid of StatCells on one card. cols: 2 | 3 | 4 (defaults 4-up like the summary row). */
export function StatGrid({ stats, cols = 4, accent }: { stats: StatCellProps[]; cols?: 2 | 3 | 4; accent?: string }) {
  const colsClass = cols === 2 ? 'grid-cols-2' : cols === 3 ? 'grid-cols-3' : 'grid-cols-4';
  return (
    <KitCard accent={accent}>
      <div className={`grid ${colsClass} gap-y-3 gap-x-2`}>
        {stats.map((s) => <StatCell key={s.label} {...s} />)}
      </div>
    </KitCard>
  );
}

/** Chart frame: title row + optional timeframe hint + consistent empty state. */
export function ChartCard({
  title,
  hint,
  empty,
  children,
  accent,
}: {
  title: string;
  hint?: string;
  /** When set, renders the empty-state message instead of children. */
  empty?: string | false | null;
  children?: ReactNode;
  accent?: string;
}) {
  return (
    <KitCard accent={accent}>
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-xs font-black" style={{ color: 'var(--color-text)' }}>{title}</span>
        {hint && <span className="text-[9px] font-bold" style={{ color: 'var(--color-text-muted)' }}>{hint}</span>}
      </div>
      {empty ? (
        <div className="py-6 text-center text-[11px] font-bold" style={{ color: 'var(--color-text-muted)' }}>{empty}</div>
      ) : children}
    </KitCard>
  );
}

/** The single Pro gate: blurred content + lock + upgrade link. */
export function ProLockOverlay({ children, label = 'Unlock with Pro' }: { children: ReactNode; label?: string }) {
  return (
    <div className="relative">
      <div className="pointer-events-none select-none blur-[3px] opacity-60" aria-hidden>{children}</div>
      <Link
        href="/pro"
        className="absolute inset-0 flex flex-col items-center justify-center gap-1.5"
        aria-label={label}
      >
        <span
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black text-white"
          style={{ background: 'linear-gradient(90deg,#a78bfa,#ec4899)' }}
        >
          <Lock className="w-3 h-3" /> {label}
        </span>
      </Link>
    </div>
  );
}
