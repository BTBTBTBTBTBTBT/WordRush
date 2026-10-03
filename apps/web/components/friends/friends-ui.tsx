'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MOTION } from '@/lib/motion-spec';
import { prefersReducedMotion } from '@/lib/motion';
import { Hash, Scissors, ArrowLeftRight, Ghost, Link as LinkChain } from 'lucide-react';
import { Icon3D } from '@/components/ui/icon3d';
import { PocketArt } from '@/components/ui/game-art';
import { PlayerAvatar } from '@/components/avatar/player-avatar';
import { avatarRadiusPx } from '@/lib/avatar-render';
import { CandyButton } from '@/components/ui/candy-button';
import { GAME_ART_FILL } from '@/lib/art';
import type { FriendlyKind } from '@wordle-duel/core';
import { FR, KIND_COLOR } from '@/lib/friends-play';
import { FR_LOOK, frBar, frSurface } from '@/lib/friends-look';
import { softMix } from '@/lib/soft-surface';

// Shared pieces of the Friends tab and the pocket-game screens (Friends
// overhaul §0; finishing build C4, docs/FINISH_SPEC.md): tinted cards with a
// top bar (A1 — the page is light-only, so the washes mix over white), caps
// section labels, the 3D game icons in tinted chips, letter-tile avatars with
// the green on-now dot, the flame streak, candy pills (A8) and one tinted
// bottom sheet.

/** FINISH_SPEC A1 / WHITE_AUDIT lever 2: a Friends card takes a soft wash of the Friends pink (over white: the page is light-only). */
export const cardStyle: React.CSSProperties = frSurface(FR_LOOK.pink, { radius: 16 });

/**
 * A tinted Friends card (C4): the accent's wash, its border, the mockup
 * shadow and (optionally) the 10 px top bar in `bar`.
 */
export function FrCard({ accent, bar, children, className = '', style, barHeight }: {
  accent: string;
  /** Top bar fill (a color or gradient); omit for no bar. */
  bar?: string;
  barHeight?: number;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={`relative overflow-hidden ${className}`} style={{ ...frSurface(accent), ...style }}>
      {bar && <div aria-hidden="true" style={frBar(bar, barHeight)} />}
      {children}
    </div>
  );
}

export function SectionLabel({ children, right, color = FR.label }: { children: React.ReactNode; right?: React.ReactNode; color?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 pt-1">
      <span className="text-[11px] font-black uppercase flex items-center gap-1.5" style={{ letterSpacing: 1.2, color }}>{children}</span>
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
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.28), background: softMix(color, 0.14), border: `1.5px solid ${softMix(color, 0.32)}` }}
    >
      <GameGlyph kind={kind} size={Math.round(size * 0.5)} color={color} />
    </span>
  );
}

/**
 * A player's avatar with the green on-now ring + dot (FINISH_SPEC AN5 / AN6):
 * their photo or their mascot, always a rounded square in their frame — the
 * ring, pulse halo and dot follow its corners. AM2: `emoji` is never drawn.
 */
export function FriendAvatar({ name, url, accent, size = 34, online = false, pulse = false, pro, castId, level, userId, config, frame }: {
  name: string; url?: string | null;
  /** Retired (AM2): never drawn. */
  emoji?: string | null;
  accent?: string | null; size?: number; online?: boolean; pulse?: boolean;
  /** FINISH_SPEC AA2: the row's Pro flag when the data carries one (else the signed-in Pro player's own avatar is crowned). */
  pro?: boolean | null;
  /** FINISH_SPEC AH (legacy): the row's avatar_cast_id / avatar_frame when the data carries them. */
  castId?: string | null;
  frame?: string | null;
  level?: number | null;
  /** FINISH_SPEC AN3: the row's user id (matches the signed-in player) and saved avatar_config. */
  userId?: string | null;
  config?: unknown;
}) {
  const dot = Math.max(10, Math.round(size * 0.3));
  const ring = online ? `0 0 0 2px ${FR.online}` : undefined;
  const radius = avatarRadiusPx(size);
  return (
    <span className="relative shrink-0 inline-flex" style={{ width: size, height: size }}>
      {online && pulse && (
        <span
          className="absolute motion-safe:animate-pulse"
          style={{ inset: -4, background: `${FR.online}33`, borderRadius: radius + 4 }}
          aria-hidden="true"
        />
      )}
      <PlayerAvatar
        name={name}
        userId={userId}
        url={url}
        accent={accent}
        config={config}
        castId={castId}
        frame={frame}
        level={level}
        pro={pro}
        size={size}
        shadow={ring}
        label={name}
      />
      {online && (
        <span
          className="absolute rounded-full"
          style={{ width: dot, height: dot, right: -dot * 0.3, bottom: -dot * 0.3, background: FR.online, boxShadow: '0 0 0 2px #ffffff', zIndex: 2 }}
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

/**
 * A small candy action (A8): `solid` = the pink candy, otherwise the quiet
 * peach one (or `color`). Stops the row's own tap.
 */
export function Pill({ children, onClick, solid = false, disabled = false, label, color, icon }: {
  children: React.ReactNode; onClick?: () => void; solid?: boolean; disabled?: boolean; label?: string;
  color?: 'purple' | 'pink' | 'amber' | 'teal' | 'peach';
  icon?: React.ComponentProps<typeof CandyButton>['icon'];
}) {
  return (
    <CandyButton
      size="sm"
      color={color ?? (solid ? 'pink' : 'peach')}
      icon={icon}
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      disabled={disabled}
      aria-label={label}
      className="shrink-0"
    >
      {children}
    </CandyButton>
  );
}

/**
 * One of the six friend games (C4, mockup `.gt`): a small card tinted in the
 * game's color with its own 7 px top bar, the 3D pocket icon, the title and a
 * short line.
 */
export function PocketGameCard({ kind, title, sub, onClick }: { kind: FriendlyKind; title: string; sub: string; onClick: () => void }) {
  const color = KIND_COLOR[kind];
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative overflow-hidden flex flex-col text-left"
      style={{ ...frSurface(color, { radius: 16, shadow: false }), boxShadow: '0 6px 14px rgba(60, 30, 110, 0.08)' }}
    >
      <span aria-hidden="true" className="block w-full" style={frBar(color, 5)} />
      {/* BJ7: the card hugs its content — icon, a one-line name, the detail (2 lines
          reserved so a row's cards match). */}
      <span className="flex flex-col gap-[3px]" style={{ padding: 8 }}>
        <PocketArt kind={kind} size={32} fallback={<OutlineGlyph kind={kind} size={24} color={color} stroke={2.2} />} />
        <span className="text-[12px] font-black leading-tight truncate" style={{ color: FR_LOOK.ink }}>{title}</span>
        <span className="text-[10px] font-bold leading-tight line-clamp-2" style={{ color: FR_LOOK.sub, minHeight: '2.5em' }}>{sub}</span>
      </span>
    </button>
  );
}

/**
 * The one bottom sheet (page color, grabber). Tapping the scrim or Escape closes it.
 * BJ10: it soft-pops like every app sheet — the dim fades in and the sheet springs up
 * from its bottom center (0.94 → 1 + fade); closing plays the quick reverse
 * (MOTION.popDismissMs) before `onClose`. Reduce Motion closes at once.
 */
export function Sheet({ onClose, children, label, tint }: {
  onClose: () => void; children: React.ReactNode; label: string;
  /** A calmer sheet color for one state (BJ13: the friend picker's lavender). */
  tint?: string;
}) {
  const [closing, setClosing] = useState(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const close = useCallback(() => {
    if (prefersReducedMotion()) { closeRef.current(); return; }
    setClosing((was) => {
      if (!was) window.setTimeout(() => closeRef.current(), MOTION.popDismissMs);
      return true;
    });
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [close]);
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center animate-fade-in"
      style={{ background: 'rgba(42,22,80,0.35)', transition: `opacity ${MOTION.popDismissMs}ms ease-in`, opacity: closing ? 0 : 1 }}
      onClick={close}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={`w-full max-w-md overflow-y-auto ${closing ? 'soft-pop-out' : 'soft-pop'}`}
        style={{ background: tint ?? softMix(FR_LOOK.pink, 0.08), transition: 'background-color 220ms ease-out', borderTop: `1.5px solid ${softMix(FR_LOOK.pink, 0.32)}`, borderRadius: '20px 20px 0 0', maxHeight: '88vh', padding: '8px 16px max(20px, env(safe-area-inset-bottom))', boxShadow: '0 -8px 30px rgba(60,30,110,0.18)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3" style={{ width: 38, height: 5, borderRadius: 999, background: softMix(FR_LOOK.pink, 0.4) }} />
        {children}
      </div>
    </div>
  );
}
