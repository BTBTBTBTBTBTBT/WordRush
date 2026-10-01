'use client';

import { ChevronLeft, Swords } from 'lucide-react';
import { MODE_BY_DBKEY } from '@/lib/modes.generated';
import { MODE_CHROME } from '@/components/home/mode-chrome';
import { VS, modeColor, modeTitle } from '@/lib/vs-lobby';

// Shared pieces of the VS screens (VS overhaul, spec docs/VS_REDESIGN_SPEC.md
// §0): the real mode icons from the home cards, the mode chip, section labels,
// the teal nav, avatars and the bot art in a circle.

/** The home card's icon for a VS mode (roman numeral for Quad/Octo), in `color`. */
export function VsModeIcon({ mode, size = 16, color }: { mode: string; size?: number; color?: string }) {
  const meta = MODE_BY_DBKEY[mode];
  const ink = color ?? modeColor(mode);
  if (meta?.romanNumeral) {
    return <span className="font-black leading-none" style={{ color: ink, fontSize: meta.romanNumeral.length > 2 ? size * 0.55 : size * 0.72 }}>{meta.romanNumeral}</span>;
  }
  const Icon = (meta && MODE_CHROME[meta.id]?.icon) || Swords;
  return <Icon style={{ width: size, height: size, color: ink }} />;
}

/** Icon tile + mode name in its color (nav right side on the Friend and Bots pages). */
export function ModeChip({ mode }: { mode: string }) {
  const color = modeColor(mode);
  return (
    <span className="flex items-center gap-1.5">
      <span className="flex items-center justify-center" style={{ width: 24, height: 24, borderRadius: 7, background: `${color}1f` }}>
        <VsModeIcon mode={mode} size={13} />
      </span>
      <span className="text-[11px] font-black uppercase" style={{ color, letterSpacing: 0.6 }}>{modeTitle(mode)}</span>
    </span>
  );
}

export function SectionLabel({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between pt-1">
      <span className="text-[11px] font-black uppercase" style={{ letterSpacing: 1.2, color: VS.label }}>{children}</span>
      {right}
    </div>
  );
}

/** Back chevron (teal), a gradient caps title, and a right slot. */
export function VsNav({ title, onBack, right }: { title: string; onBack: () => void; right?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2" style={{ minHeight: 44 }}>
      <button type="button" onClick={onBack} aria-label="Back" className="flex items-center justify-center active:opacity-60" style={{ width: 32, height: 32, marginLeft: -6 }}>
        <ChevronLeft style={{ width: 24, height: 24, color: VS.ink }} strokeWidth={2.6} />
      </button>
      <h1 className="flex-1 text-[22px] font-black text-transparent bg-clip-text" style={{ backgroundImage: VS.title, letterSpacing: 0.4 }}>{title}</h1>
      {right}
    </div>
  );
}

export const vsCardStyle: React.CSSProperties = { background: '#ffffff', borderRadius: 14, boxShadow: VS.cardShadow };

/** A player's avatar: their picture, or the initial in a soft circle. */
export function InitialAvatar({ name, url, size = 34 }: { name: string; url?: string | null; size?: number }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name} className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />;
  }
  return (
    <span className="rounded-full flex items-center justify-center shrink-0 font-black" style={{ width: size, height: size, background: VS.soft, color: VS.ink, fontSize: size * 0.42 }}>
      {(name || '?').charAt(0).toUpperCase()}
    </span>
  );
}

/** A bot's art in a circle (§9 — never an emoji). */
export function BotAvatar({ src, name, size = 36, ring, bg = '#f1f5f9' }: { src: string; name: string; size?: number; ring?: string; bg?: string }) {
  return (
    <span className="rounded-full flex items-center justify-center shrink-0 overflow-hidden" style={{ width: size, height: size, background: bg, boxShadow: ring }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={name} style={{ width: size * 0.9, height: size * 0.9, objectFit: 'contain' }} />
    </span>
  );
}

/** Solid teal caps button (primary VS action). */
export function TealButton({ children, onClick, disabled, className = '' }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`font-black text-white uppercase transition-transform active:scale-[0.98] disabled:opacity-40 ${className}`}
      style={{ background: VS.ink, borderRadius: 12, letterSpacing: 0.6 }}
    >
      {children}
    </button>
  );
}

/** Soft teal pill. */
export function SoftPill({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="shrink-0 px-3 font-black text-[11px] rounded-full transition-transform active:scale-95 disabled:opacity-40"
      style={{ height: 28, background: VS.soft, color: VS.ink }}
    >
      {children}
    </button>
  );
}
