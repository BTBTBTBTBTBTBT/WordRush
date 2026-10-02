'use client';

import * as React from 'react';

import { hexAlpha } from '@/lib/avatar-tile';
import { badgeSrc } from '@/lib/art';
import { avatarRadiusPx } from '@/lib/avatar-render';
import { PRO_AVATAR, proAvatarDecor } from '@/lib/pro-identity';
import { PlayerAvatar } from '@/components/avatar/player-avatar';

/**
 * The no-photo player avatar. FINISH_SPEC AN3 / AN5: the plain letter tile
 * (ART_SPEC §20) is retired — every player without a photo now wears their
 * build-your-own MASCOT with their initial as its body letter (the saved
 * avatar_config when the caller passes it, else the deterministic default in
 * their accent color). This keeps the old props so every caller switches over
 * at once; new code uses components/avatar/player-avatar.tsx directly.
 * AM2: `emoji` is accepted but never drawn (emoji avatars are retired).
 */
export interface LetterTileAvatarProps {
  /** Username — the initial, and (without a user id) the default mascot's seed. */
  name: string | null | undefined;
  /** Retired (AM2): an old emoji avatar is never drawn; the mascot shows instead. */
  emoji?: string | null;
  /** The player's chosen profile accent (`accent_color`) → the default mascot's color. */
  accent?: string | null;
  size: number;
  /** Outer box-shadow (e.g. a presence or white ring) — follows the rounded-square corners. */
  shadow?: string;
  /** A ring drawn as a rounded-square stroke inside the tile edge. */
  stroke?: { width: number; color: string };
  className?: string;
  style?: React.CSSProperties;
  /** FINISH_SPEC AA2: a Pro player's avatar — the gold Pro frame + the tiny crown on the top-right. */
  pro?: boolean;
  /** AN3: the row's user id (matches the signed-in player) and saved avatar_config, when known. */
  userId?: string | null;
  avatarConfig?: unknown;
}

/**
 * FINISH_SPEC AA2 → AN6: the Pro decoration for any avatar node — a thin gold
 * rounded-square frame just outside the avatar (never covering the face) and
 * the tiny gold crown sprite (≈35%) on its top-right corner. Absolutely
 * positioned — render it inside the avatar's relative, unclipped box.
 * Decorative. (Avatars drawn by MascotAvatar get this built in.)
 */
export function ProAvatarDecor({ size, radius }: { size: number; radius?: number | 'circle' }) {
  // AN6: avatars are rounded squares, never circles.
  const d = proAvatarDecor(size, typeof radius === 'number' ? radius : avatarRadiusPx(size));
  return (
    <>
      <span
        aria-hidden="true"
        className="absolute pointer-events-none"
        style={{
          inset: -d.ring.inset, borderRadius: d.ring.radius,
          border: `${d.ring.stroke}px solid ${PRO_AVATAR.gold}`,
          boxShadow: `0 0 4px ${hexAlpha(PRO_AVATAR.gold, 0.45)}`,
        }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={badgeSrc('pro-crown-sprite')}
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        width={d.crown.size}
        height={d.crown.size}
        draggable={false}
        className="absolute pointer-events-none select-none"
        style={{
          width: d.crown.size, height: d.crown.size, top: d.crown.top, right: d.crown.right, zIndex: 1,
          transform: `rotate(${PRO_AVATAR.tilt}deg)`, filter: 'drop-shadow(0 1px 1.5px rgba(146, 64, 14, 0.35))',
        }}
      />
    </>
  );
}

/**
 * AA2 for any other avatar node: wraps `children` (a `size` box) and adds the
 * Pro frame + crown when `pro`.
 */
export function ProAvatarFrame({ pro, size, radius, className = '', children }: {
  pro: boolean;
  size: number;
  radius?: number | 'circle';
  className?: string;
  children: React.ReactNode;
}) {
  if (!pro) return <>{children}</>;
  return (
    <span className={`relative inline-flex shrink-0 ${className}`} style={{ width: size, height: size }}>
      {children}
      <ProAvatarDecor size={size} radius={radius} />
    </span>
  );
}

/** Corner radius in px for an avatar of `size` (for rings / halos / overlays that hug it; AN6 ≈ 22%). */
export function letterTileRadius(size: number): number {
  return avatarRadiusPx(size);
}

export function LetterTileAvatar({ name, accent, size, shadow, stroke, className = '', style, pro, userId, avatarConfig }: LetterTileAvatarProps) {
  const avatar = (
    <PlayerAvatar
      name={name}
      userId={userId}
      accent={accent}
      config={avatarConfig}
      pro={pro ? true : null}
      size={size}
      noPhoto
      shadow={shadow}
      className={stroke ? '' : className}
      style={stroke ? undefined : style}
    />
  );
  if (!stroke) return avatar;
  return (
    <span className={`relative inline-block shrink-0 ${className}`} style={{ width: size, height: size, ...style }}>
      {avatar}
      <span
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{ borderRadius: avatarRadiusPx(size), border: `${stroke.width}px solid ${stroke.color}` }}
      />
    </span>
  );
}
