import * as React from 'react';

import { TILE_RADIUS, hexAlpha, tileColors, tileInitials } from '@/lib/avatar-tile';

/**
 * The no-photo player avatar (docs/ART_SPEC.md §20): a glossy rounded-square
 * letter tile in the style of the cast's letters, drawn entirely in CSS so it
 * scales from 20 to 120 px. Body in `edge` (base −22%) showing as a thick
 * bottom lip, a face 7% shorter with a light → base → base −6% gradient, a
 * white gloss over the top of the face, and white Nunito 900 initials (or the
 * chosen emoji) centered on the face. Uploaded photos stay circles and bots
 * keep their own art — callers only render this when there is no photo.
 * Identical in dark mode (the tile is its own light source); no animation.
 */
export interface LetterTileAvatarProps {
  /** Username — the initials and (without an accent) the color come from it. */
  name: string | null | undefined;
  /** The player's chosen emoji fallback; drawn instead of the initials. */
  emoji?: string | null;
  /** The player's chosen profile accent (`accent_color`); wins over the letter color. */
  accent?: string | null;
  size: number;
  /** Outer box-shadow (e.g. a presence or white ring) — follows the tile's corners. */
  shadow?: string;
  /** A ring drawn as a rounded-square stroke inside the tile edge (replaces a circle border). */
  stroke?: { width: number; color: string };
  className?: string;
  style?: React.CSSProperties;
}

/** Corner radius in px for a tile of `size` (for rings / overlays that hug it). */
export function letterTileRadius(size: number): number {
  return size * TILE_RADIUS;
}

export function LetterTileAvatar({ name, emoji, accent, size, shadow, stroke, className = '', style }: LetterTileAvatarProps) {
  const { edge, light, base, bottom } = tileColors(name, accent);
  const e = emoji?.trim();
  const text = e || tileInitials(name);
  const radius = size * TILE_RADIUS;
  const lip = size * 0.07;
  const faceH = size - lip;
  const inset = size * 0.08;
  const twoLetters = !e && Array.from(text).length > 1;
  const fontSize = e ? size * 0.5 : size * (twoLetters ? 0.42 : 0.56);

  return (
    <span
      className={`relative inline-block shrink-0 select-none ${className}`}
      style={{ width: size, height: size, borderRadius: radius, background: edge, boxShadow: shadow, ...style }}
    >
      {/* Face: full width, flush with the top, 7% short of the bottom so the edge shows as a lip. */}
      <span
        className="absolute left-0 right-0 top-0"
        style={{ height: faceH, borderRadius: radius, background: `linear-gradient(180deg, ${light} 0%, ${base} 70%, ${bottom} 100%)` }}
        aria-hidden="true"
      />
      {/* Gloss over the top 42% of the face. */}
      <span
        className="absolute"
        style={{
          left: inset, right: inset, top: inset, height: faceH * 0.42,
          borderRadius: size * 0.18,
          background: 'linear-gradient(180deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0) 100%)',
        }}
        aria-hidden="true"
      />
      {/* Initials / emoji, centered on the face (not the whole box). */}
      <span
        className="absolute left-0 right-0 top-0 flex items-center justify-center whitespace-nowrap"
        style={{
          height: faceH,
          fontSize,
          lineHeight: 1,
          fontWeight: 900,
          color: '#ffffff',
          letterSpacing: e ? undefined : '-0.02em',
          textShadow: e ? undefined : `0 ${size * 0.03}px ${size * 0.02}px ${hexAlpha(edge, 0.45)}`,
        }}
      >
        {text}
      </span>
      {stroke && (
        <span
          className="absolute inset-0 pointer-events-none"
          style={{ borderRadius: radius, border: `${stroke.width}px solid ${stroke.color}` }}
          aria-hidden="true"
        />
      )}
    </span>
  );
}
