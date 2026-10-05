'use client';

import Image, { type ImageProps } from 'next/image';
import { useEffect } from 'react';
import { seasonPalette, seasonalTitle, seasonalWall } from '@/lib/season-kit';
import { useSeason } from '@/lib/season';

// The season preview's client pieces (lib/season-kit.ts): a title image that swaps to the season's
// lettering, the season's wallpaper layer inside .page-bg, and the document hook that hands the
// palette to CSS (the button family's tints). All render the normal look on the server and in the
// first client render (useSeason is null until mounted), then flip; the admin picker flips them live.

/**
 * next/image for a title (`artName` = art-titlecast-* / art-game-*): in season, the seasonal lettering
 * at the same box rules — its own aspect ratio, and with `maxHeight` + `maxWidthCap` the width cap is
 * re-derived so it never draws taller than the normal title would.
 */
export function SeasonTitleImage({ artName, maxHeight, maxWidthCap, ...img }: ImageProps & { artName: string; maxHeight?: number; maxWidthCap?: number }) {
  const season = useSeason();
  const swap = seasonalTitle(artName, season);
  if (!swap) return <Image {...img} />;
  const [w, h] = swap.size;
  const style: React.CSSProperties = { ...img.style, aspectRatio: `${w} / ${h}` };
  if (maxHeight != null && maxWidthCap != null) style.maxWidth = Math.min(maxWidthCap, Math.round((maxHeight * w) / h));
  return <Image key={swap.name} {...img} src={swap.src} width={w} height={h} style={style} />;
}

/** The season's wallpaper over the page's own (inside .page-bg, under its dark overlay). */
export function SeasonWallLayer({ wall }: { wall: string | null | undefined }) {
  const season = useSeason();
  if (!wall || !season) return null;
  const light = seasonalWall(wall, season, 'light');
  const dark = seasonalWall(wall, season, 'dark');
  if (!light && !dark) return null;
  const url = (n: string | null, wide: boolean) => (n ? `url('/art/${n}${wide ? '-wide' : ''}.webp')` : 'none');
  const vars = {
    '--season-wall-light': url(light ?? dark, false),
    '--season-wall-dark': url(dark ?? light, false),
    '--season-wall-light-wide': url(light ?? dark, true),
    '--season-wall-dark-wide': url(dark ?? light, true),
  } as React.CSSProperties;
  return <div className="season-wall" style={vars} data-season-wall={season} />;
}

/** Hands the active season to the document: html[data-season] + the palette's CSS variables. */
export function SeasonDocument() {
  const season = useSeason();
  useEffect(() => {
    const root = document.documentElement;
    const p = seasonPalette(season);
    if (!season || !p) {
      root.removeAttribute('data-season');
      root.style.removeProperty('--season-button-tint');
      root.style.removeProperty('--season-quiet-tint');
      root.style.removeProperty('--season-accent');
      return;
    }
    root.setAttribute('data-season', season);
    root.style.setProperty('--season-button-tint', p.buttonTint);
    root.style.setProperty('--season-quiet-tint', p.quietTint);
    root.style.setProperty('--season-accent', p.accent);
  }, [season]);
  return null;
}
