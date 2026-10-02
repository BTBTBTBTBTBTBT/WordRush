'use client';

import Image from 'next/image';
import { useState } from 'react';
import { GAME_ART_FILL, gameArtSrc } from '@/lib/art';

// The glossy 3D game icons (docs/ART_SPEC.md §3): public/art/game-<mode id>.webp,
// 256 px square, in each game's own color. One web path draws them: MODE_CHROME's
// `icon` for every game is a `gameArtIcon(...)`, so every place that drew the
// mode's glyph (home cards, game tiles and squares, Leaderboard / Records / Stats
// selectors, Friends quick-play, More Games, guides, the VS mode strip) now draws
// the art. The old glyph stays only as the fallback when an image is missing or
// fails to load. Decorative: the tile / button around it carries the name.

interface GameArtProps {
  /** Mode id (MODE_CHROME / modes.json `id`). */
  id: string;
  /** Rendered box in CSS px (square). */
  size: number;
  /** Drawn when the game has no art or the file fails to load. */
  fallback?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function GameArt({ id, size, fallback = null, className = '', style }: GameArtProps) {
  const [failed, setFailed] = useState(false);
  const src = gameArtSrc(id);
  if (!src || failed) return <>{fallback}</>;
  return (
    <Image
      src={src}
      alt=""
      aria-hidden
      width={Math.round(size)}
      height={Math.round(size)}
      loading="lazy"
      draggable={false}
      onError={() => setFailed(true)}
      className={`block shrink-0 select-none pointer-events-none ${className}`}
      style={{ width: size, height: size, maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', ...style }}
    />
  );
}

/** Props an icon-table entry takes (lucide-compatible), so the art drops into MODE_CHROME unchanged. */
export interface GameArtIconProps {
  className?: string;
  style?: React.CSSProperties;
}

export type GameArtIcon = React.ComponentType<GameArtIconProps> & { gameArtId: string };

/** Tailwind size class → px: w-3.5 → 14, w-[18px] → 18. */
function sizeFromClass(className: string): number | null {
  const px = className.match(/(?:^|\s)w-\[(\d+(?:\.\d+)?)px\]/);
  if (px) return Number(px[1]);
  const scale = className.match(/(?:^|\s)w-(\d+(?:\.\d+)?)(?=\s|$)/);
  if (scale) return Number(scale[1]) * 4;
  return null;
}

/**
 * A lucide-compatible icon for a game: the slot's size comes from the w-* class
 * (or style.width) the old glyph used, and the art draws at GAME_ART_FILL times
 * it, so it fills the chip that glyph sat in. `Fallback` (the old glyph, given
 * the same props) draws when the art is missing.
 */
export function gameArtIcon(id: string, Fallback: React.ComponentType<GameArtIconProps> | null): GameArtIcon {
  function GameArtLike({ className = '', style }: GameArtIconProps) {
    const fromStyle = typeof style?.width === 'number' ? style.width : null;
    const slot = sizeFromClass(className) ?? fromStyle ?? 16;
    const rest = className.split(/\s+/).filter((c) => c && !/^(w|h)-/.test(c) && !/^text-/.test(c)).join(' ');
    const keep: React.CSSProperties = { ...style };
    delete keep.color;
    delete keep.width;
    delete keep.height;
    return (
      <GameArt
        id={id}
        size={slot * GAME_ART_FILL}
        className={rest}
        style={keep}
        fallback={Fallback ? <Fallback className={className} style={{ width: slot, height: slot, ...style }} /> : null}
      />
    );
  }
  GameArtLike.displayName = `GameArt(${id})`;
  return Object.assign(GameArtLike, { gameArtId: id });
}
