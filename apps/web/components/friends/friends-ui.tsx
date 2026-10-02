'use client';

import { useEffect } from 'react';
import { Hash, Scissors, ArrowLeftRight, Ghost, Link as LinkChain } from 'lucide-react';
import { Icon3D } from '@/components/ui/icon3d';
import { PocketArt } from '@/components/ui/game-art';
import { GAME_ART_FILL } from '@/lib/art';
import type { FriendlyKind } from '@wordle-duel/core';
import { FR, KIND_COLOR } from '@/lib/friends-play';

// Shared pieces of the Friends tab and the pocket-game screens (Friends
// overhaul §0): white cards with a soft shadow and no borders, caps section
// labels, the OUTLINE game icons in colored rounded squares, avatars with the
// green on-now ring, the flame streak and one bottom sheet.

export const cardStyle: React.CSSProperties = { background: '#ffffff', borderRadius: 14, boxShadow: FR.cardShadow };

export function SectionLabel({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 pt-1">
      <span className="text-[11px] font-black uppercase flex items-center gap-1.5" style={{ letterSpacing: 1.2, color: FR.label }}>{children}</span>
      {right}
    </div>
  );
}

/** Call It: two concentric circles and a short vertical line (a coin, never a mic). */
function CoinOutline({ size, color, stroke }: { size: number; color: string; stroke: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5.5" />
      <line x1="12" y1="10" x2="12" y2="14" />
    </svg>
  );
}

/** The game's old outline icon: RPS scissors · Tic-Tac-Tile hash · Call It coin · Pass the Puzzle opposing arrows · Ghost ghost · Word Chain chain link. */
function OutlineGlyph({ kind, size, color, stroke }: { kind: FriendlyKind; size: number; color: string; stroke: number }) {
  const props = { width: size, height: size, color, strokeWidth: stroke, 'aria-hidden': true } as const;
  switch (kind) {
    case 'rps': return <Scissors {...props} />;
    case 'ttt': return <Hash {...props} />;
    case 'coin': return <CoinOutline size={size} color={color} stroke={stroke} />;
    case 'pass': return <ArrowLeftRight {...props} />;
    case 'ghost': return <Ghost {...props} />;
    case 'chain': return <LinkChain {...props} />;
  }
}

/**
 * The game's glossy 3D icon (docs/ART_SPEC.md §9: game-pocket-<kind>, rock
 * fist · X+O · star coin · puzzle piece · little ghost · chain links). `size`
 * is the old outline glyph's slot; the art fills its chip at GAME_ART_FILL
 * times it (same rule as the game icons, §3). The outline glyph stays as the
 * fallback when the art is missing. Decorative.
 */
export function GameGlyph({ kind, size = 16, color = '#ffffff', stroke = 2.4 }: { kind: FriendlyKind; size?: number; color?: string; stroke?: number }) {
  return (
    <PocketArt
      kind={kind}
      size={Math.round(size * GAME_ART_FILL)}
      fallback={<OutlineGlyph kind={kind} size={size} color={color} stroke={stroke} />}
    />
  );
}

/** The game's 3D icon filling a rounded chip in its color's tint (the outline fallback draws in that color). */
export function GameIconSquare({ kind, size = 34 }: { kind: FriendlyKind; size?: number }) {
  const color = KIND_COLOR[kind];
  return (
    <span
      className="flex items-center justify-center shrink-0"
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.28), background: `${color}1f` }}
    >
      <GameGlyph kind={kind} size={Math.round(size * 0.5)} color={color} />
    </span>
  );
}

/** A player's avatar (picture, chosen emoji, or initial) with the green on-now ring + dot. */
export function FriendAvatar({ name, url, emoji, size = 34, online = false, pulse = false }: {
  name: string; url?: string | null; emoji?: string | null; size?: number; online?: boolean; pulse?: boolean;
}) {
  const e = emoji?.trim();
  const dot = Math.max(8, Math.round(size * 0.26));
  return (
    <span className="relative shrink-0 inline-flex" style={{ width: size, height: size }}>
      {online && pulse && (
        <span className="absolute rounded-full animate-pulse" style={{ inset: -4, background: `${FR.online}33` }} aria-hidden="true" />
      )}
      <span
        className="relative rounded-full overflow-hidden flex items-center justify-center font-black"
        style={{
          width: size, height: size, background: FR.soft, color: FR.solid, fontSize: e ? size * 0.5 : size * 0.42,
          boxShadow: online ? `0 0 0 2px ${FR.online}` : undefined,
        }}
      >
        {url
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={url} alt={name} className="w-full h-full object-cover" />
          : (e || (name || '?').charAt(0).toUpperCase())}
      </span>
      {online && (
        <span
          className="absolute rounded-full"
          style={{ width: dot, height: dot, right: -1, bottom: -1, background: FR.online, boxShadow: '0 0 0 2px #ffffff' }}
          aria-label="On now"
        />
      )}
    </span>
  );
}

export function FlameCount({ days, label }: { days: number; label?: string }) {
  if (days <= 0) return null;
  return (
    <span className="flex items-center gap-0.5 text-[12px] font-black shrink-0" style={{ color: FR.flame }} aria-label={`${days}-day friend streak`}>
      <Icon3D name="flame" size={14} />
      {label ?? days}
    </span>
  );
}

/** Solid pink or soft pink pill. */
export function Pill({ children, onClick, solid = false, disabled = false, label }: {
  children: React.ReactNode; onClick?: () => void; solid?: boolean; disabled?: boolean; label?: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      disabled={disabled}
      aria-label={label}
      className="shrink-0 px-3 font-black text-[11px] rounded-full transition-transform active:scale-95 disabled:opacity-50"
      style={{ height: 28, background: solid ? FR.solid : FR.soft, color: solid ? '#ffffff' : FR.mid }}
    >
      {children}
    </button>
  );
}

/** The one bottom sheet (page color, grabber). Tapping the scrim or Escape closes it. */
export function Sheet({ onClose, children, label }: { onClose: () => void; children: React.ReactNode; label: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(15,23,42,0.35)' }} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="w-full max-w-md overflow-y-auto"
        style={{ background: FR.page, borderRadius: '20px 20px 0 0', maxHeight: '88vh', padding: '8px 16px max(20px, env(safe-area-inset-bottom))', boxShadow: '0 -8px 30px rgba(15,23,42,0.18)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3" style={{ width: 38, height: 5, borderRadius: 999, background: '#d1d5db' }} />
        {children}
      </div>
    </div>
  );
}
