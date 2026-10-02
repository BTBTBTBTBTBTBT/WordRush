'use client';

import { Swords } from 'lucide-react';
import { CastLoader, LoadingTip } from '@/components/ui/cast-loader';
import { PageHeader } from '@/components/ui/page-header';
import { LetterTileAvatar } from '@/components/ui/letter-tile-avatar';
import type { MascotId } from '@/lib/mascots';
import { MODE_BY_DBKEY } from '@/lib/modes.generated';
import { MODE_CHROME } from '@/components/home/mode-chrome';
import { isGameArtIcon, type TitleArtName } from '@/lib/art';
import { VS, modeColor, modeTitle } from '@/lib/vs-lobby';

// Shared pieces of the VS screens (VS overhaul, spec docs/VS_REDESIGN_SPEC.md
// §0): the real mode icons from the home cards, the mode chip, section labels,
// the teal nav, avatars and the bot art in a circle.

/** The home card's icon for a VS mode: the game's 3D art, else the old glyph (roman numeral for Quad/Octo) in `color`. */
export function VsModeIcon({ mode, size = 16, color }: { mode: string; size?: number; color?: string }) {
  const meta = MODE_BY_DBKEY[mode];
  const ink = color ?? modeColor(mode);
  const chrome = meta ? MODE_CHROME[meta.id]?.icon : null;
  // The game's 3D art (docs/ART_SPEC.md §3) fills the tile the glyph sat in.
  if (chrome && isGameArtIcon(chrome)) {
    const Art = chrome;
    return <Art style={{ width: size, height: size, color: ink }} />;
  }
  if (meta?.romanNumeral) {
    return <span className="font-black leading-none" style={{ color: ink, fontSize: meta.romanNumeral.length > 2 ? size * 0.55 : size * 0.72 }}>{meta.romanNumeral}</span>;
  }
  const Icon = chrome || Swords;
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

/**
 * The VS page header (HEADER_SPEC §4): the shared PageHeader in the VS teal —
 * a white back circle, the gradient caps title, the host when no banner below
 * carries it, and a right slot.
 */
export function VsNav({ title, onBack, right, host, art, artLabel }: {
  title: string; onBack: () => void; right?: React.ReactNode; host?: MascotId;
  /** Whole-cast title art in place of the text title (docs/ART_SPEC.md §2). */
  art?: TitleArtName; artLabel?: string;
}) {
  return <PageHeader title={title} art={art} artLabel={artLabel} accent="vs" back={{ onClick: onBack }} host={host} right={right} />;
}

export const vsCardStyle: React.CSSProperties = { background: '#ffffff', borderRadius: 14, boxShadow: VS.cardShadow };

/** A player's avatar: their picture (circle), or their letter tile (ART_SPEC §20). */
export function InitialAvatar({ name, url, emoji, accent, size = 34 }: { name: string; url?: string | null; emoji?: string | null; accent?: string | null; size?: number }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name} className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />;
  }
  return <LetterTileAvatar name={name} emoji={emoji} accent={accent} size={size} />;
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

/** Centered teal ring spinner (VS polish §2 — loading, sending, starting). */
export function VsRingSpinner({ size = 44 }: { size?: number }) {
  return (
    <span
      className="block rounded-full animate-spin"
      style={{ width: size, height: size, border: `${Math.max(3, Math.round(size / 11))}px solid ${VS.soft}`, borderTopColor: VS.ink }}
      aria-hidden="true"
    />
  );
}

/**
 * The VS loading screen (VS polish §2): the mode icon in its color, the cast
 * loader (it replaced the teal ring spinner) and `LOADING <MODE>` on the VS page — never bare text or a
 * blank screen while the match or its word lists load.
 */
export function VsLoadingScreen({ mode, label }: { mode: string; label?: string }) {
  return (
    <div
      className="h-screen-stable flex flex-col items-center justify-center gap-4 px-6"
      style={{ backgroundColor: VS.page, paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      role="status"
      aria-live="polite"
    >
      <span className="flex items-center justify-center" style={{ width: 52, height: 52, borderRadius: 14, background: `${modeColor(mode)}1f` }}>
        <VsModeIcon mode={mode} size={26} />
      </span>
      {/* The cast waves in place of the spinner (docs/MASCOT_SPEC.md §3). */}
      <CastLoader />
      <span className="text-[12px] font-black uppercase" style={{ color: VS.label, letterSpacing: 1.2 }}>
        {label ?? `Loading ${modeTitle(mode)}`}
      </span>
      <LoadingTip color={VS.label} />
    </div>
  );
}

/** Small solid teal `VS` pill beside a match title (VS polish §1). */
export function VsPill() {
  return (
    <span
      className="inline-flex items-center justify-center font-black text-white shrink-0"
      style={{ background: VS.ink, borderRadius: 999, fontSize: 11, letterSpacing: 0.8, height: 20, padding: '0 8px' }}
    >
      VS
    </span>
  );
}
