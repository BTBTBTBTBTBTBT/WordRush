'use client';

import type { ReactNode, ComponentType } from 'react';
import { useEffect, useRef, useState } from 'react';
import { SoftNum } from '@/components/ui/soft-number';
import { CastLink } from '@/components/ui/cast-button';
import { ART_SIZE, artSrc, type GoProSignId } from '@/lib/art';
import { BRAND_ACCENT, cardBarStyle, softCard } from '@/lib/soft-surface';

/** Counts from 0 to `target` over ~500ms on mount (F4). Snaps under
 *  prefers-reduced-motion. Re-snaps (no re-count) when the target changes. */
export function CountUp({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [n, setN] = useState(target);
  const started = useRef(false);
  useEffect(() => {
    if (started.current) { setN(target); return; }
    started.current = true;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setN(target); return;
    }
    if (target <= 0) { setN(target); return; }
    const steps = Math.min(target, 24);
    let i = 0;
    setN(0);
    const id = setInterval(() => {
      i++;
      setN(Math.round((target * i) / steps));
      if (i >= steps) clearInterval(id);
    }, 500 / steps);
    return () => clearInterval(id);
  }, [target]);
  return <>{n}{suffix}</>;
}

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

/**
 * The standard card surface (docs/FINISH_SPEC.md A1): the accent's soft wash
 * and border (lavender when no accent is given), rounded, never plain white.
 * `accent` also draws the 10 px game-card top bar; `tint` washes without a bar.
 */
export function KitCard({
  children,
  className = '',
  padded = true,
  accent,
  tint,
  style,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
  /** Wash + the 10 px top bar in this color (mode color). */
  accent?: string;
  /** Wash only (no bar); defaults to the brand lavender. */
  tint?: string;
  style?: React.CSSProperties;
}) {
  const wash = accent ?? tint ?? BRAND_ACCENT;
  return (
    <div className={`overflow-hidden ${className}`} style={{ ...softCard(wash, { radius: 18 }), ...style }}>
      {accent && <div aria-hidden="true" style={cardBarStyle(accent)} />}
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

/** One stat: icon, big soft number (A2), small uppercase label, optional sub line. */
export function StatCell({ icon: Icon, label, value, sub, color }: StatCellProps) {
  return (
    <div className="text-center">
      {Icon && <Icon className="w-4 h-4 mx-auto mb-1" style={{ color: color ?? 'var(--color-text-muted)' }} />}
      <SoftNum size={18} as="div" className="soft-num-auto leading-tight">{value}</SoftNum>
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

/**
 * A colored stat tile (C3 cont: the streak / best-moment and the four
 * all-time tiles): its own wash, a 3D icon beside a small tracked label in the
 * tile's ink, a big soft number and a small line under it.
 */
export function TintTile({ accent, ink, icon, label, value, sub, size = 28, onClick, ariaLabel, children }: {
  accent: string;
  /** Label ink (light theme); dark mode falls back to the muted text. */
  ink: string;
  icon?: ReactNode;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  size?: number;
  onClick?: () => void;
  ariaLabel?: string;
  children?: ReactNode;
}) {
  const body = (
    <>
      <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tint-ink" style={{ letterSpacing: '0.1em', color: ink }}>
        {icon}{label}
      </span>
      <SoftNum size={size} as="div" className="soft-num-auto truncate" style={{ lineHeight: 1.1 }}>{value}</SoftNum>
      {sub != null && <span className="text-[11px] font-extrabold truncate" style={{ color: 'var(--color-text-muted)' }}>{sub}</span>}
      {children}
    </>
  );
  const style: React.CSSProperties = { ...softCard(accent, { radius: 18 }), padding: 12, display: 'grid', gap: 4, minWidth: 0, textAlign: 'left' };
  return onClick ? (
    <button type="button" onClick={onClick} aria-label={ariaLabel} className="w-full" style={style}>{body}</button>
  ) : (
    <div style={style}>{body}</div>
  );
}

/** Chart frame: title row + optional timeframe hint + consistent empty state, on a tinted card. */
export function ChartCard({
  title,
  hint,
  empty,
  children,
  accent,
  tint,
}: {
  title: string;
  hint?: string;
  /** When set, renders the empty-state message instead of children. */
  empty?: string | false | null;
  children?: ReactNode;
  accent?: string;
  tint?: string;
}) {
  return (
    <KitCard accent={accent} tint={tint}>
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

/**
 * The single Pro gate (FINISH_SPEC BJ17, founder 10-03: "a mascot saying go pro… instead of it being
 * blurred out"): no blur and no sample numbers behind glass. The section keeps its own header; in place of
 * the stats, a cast member holds up the gold GO PRO sign, one line says what Pro unlocks HERE, and the gold
 * cast GO PRO button opens /pro. `compact` = the small sign art beside the line + a small button, for every
 * locked section after the first on a page (one big sign per page).
 */
export function ProStatsInvite({ line, compact = false, cast = 'w' }: { line: string; compact?: boolean; cast?: GoProSignId }) {
  const name = `art-gopro-sign-${cast}` as const;
  const [w, h] = ART_SIZE[name];
  const box = compact ? 60 : 116;
  const img = (
    <img src={artSrc(name)} alt="" aria-hidden="true" width={w} height={h} draggable={false} decoding="async"
      className="shrink-0" style={{ width: box, height: box, objectFit: 'contain' }} />
  );
  const text = <p className="text-[13px] font-extrabold leading-snug" style={{ color: 'var(--color-text)' }}>{line}</p>;
  if (compact) {
    return (
      <div className="flex items-center justify-center gap-3 py-1">
        {img}
        <div className="flex flex-col items-start gap-2" style={{ maxWidth: 230 }}>
          {text}
          <CastLink href="/pro" color="gold" size="sm" aria-label="Go Pro">Go Pro</CastLink>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-2 py-1 text-center">
      {img}
      <div style={{ maxWidth: 280 }}>{text}</div>
      <CastLink href="/pro" color="gold" size="md" aria-label="Go Pro">Go Pro</CastLink>
    </div>
  );
}
