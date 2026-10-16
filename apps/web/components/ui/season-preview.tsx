'use client';

import Image, { type ImageProps } from 'next/image';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { TIME_OF_DAY_FADE_MS } from '@wordle-duel/core';
import { SURFACE_CSS_VARS, seasonPalette, seasonSurfaces, seasonalTitle, seasonalWall, surfaceCssVars } from '@/lib/season-kit';
import { readSurfacesChoice, useSeason } from '@/lib/season';
import { prewarmArt, upcomingTimeOfDay, useTimeOfDay } from '@/lib/time-of-day';

const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

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

/** The season's wallpaper over the page's own (inside .page-bg, under its dark overlay). Follows the time of day (10-16): when the
 *  slot changes the new wall fades in over the old one (600 ms, two static layers; the old is dropped afterwards). */
export function SeasonWallLayer({ wall }: { wall: string | null | undefined }) {
  const season = useSeason();
  const tod = useTimeOfDay();
  const time = season ? tod : 'night';
  const layerFor = (t: typeof tod) => {
    if (!wall || !season) return null;
    const dark = seasonalWall(wall, season, 'dark', t);
    // A dark-toned season's windows sit on its dark wall in every scheme (light on-wall ink).
    const light = seasonSurfaces(season, readSurfacesChoice())?.tone === 'dark' ? dark : seasonalWall(wall, season, 'light', t);
    if (!light && !dark) return null;
    const url = (n: string | null, wide: boolean) => (n ? `url('/art/${n}${wide ? '-wide' : ''}.webp')` : 'none');
    return {
      key: `${season}|${light}|${dark}`,
      dark, light,
      vars: {
        '--season-wall-light': url(light ?? dark, false),
        '--season-wall-dark': url(dark ?? light, false),
        '--season-wall-light-wide': url(light ?? dark, true),
        '--season-wall-dark-wide': url(dark ?? light, true),
      } as React.CSSProperties,
    };
  };
  const now = layerFor(time);
  // The layers on screen: [old, new] while a swap is fading, else just the current one.
  const [prev, setPrev] = useState<NonNullable<typeof now> | null>(null);
  const shown = useRef<NonNullable<typeof now> | null>(null);
  // A layout effect: the old wall must be on screen (and the new one fading) in the same frame the slot changes.
  useIsoLayoutEffect(() => {
    if (!now) { shown.current = null; setPrev(null); return; }
    const before = shown.current;
    shown.current = now;
    if (!before || before.key === now.key || before.key.split('|')[0] !== now.key.split('|')[0]) { setPrev(null); return; }
    setPrev(before);
    const t = setTimeout(() => setPrev(null), TIME_OF_DAY_FADE_MS + 80);
    return () => clearTimeout(t);
  }, [now?.key]);                                                       // eslint-disable-line react-hooks/exhaustive-deps
  // Prewarm the NEXT slot's wall (idle, off the main thread) before the boundary.
  useEffect(() => {
    if (!season || !wall) return;
    const next = upcomingTimeOfDay();
    const nl = next ? layerFor(next) : null;
    if (!nl || nl.key === now?.key) return;
    const wide = typeof window !== 'undefined' && window.matchMedia?.('(min-aspect-ratio: 1/1), (min-width: 1024px)').matches;
    prewarmArt([nl.dark, nl.light].filter((n, i, a): n is string => !!n && a.indexOf(n) === i).map((n) => `/art/${n}${wide ? '-wide' : ''}.webp`));
  }, [season, wall, now?.key]);                                         // eslint-disable-line react-hooks/exhaustive-deps
  if (!now) return null;
  return (
    <>
      {prev && prev.key !== now.key && <div className="season-wall" style={prev.vars} data-season-wall={season} />}
      <div key={now.key} className={prev && prev.key !== now.key ? 'season-wall season-wall-fade' : 'season-wall'} style={now.vars} data-season-wall={season} />
    </>
  );
}

/** Hands the active season to the document: html[data-season] + the palette's CSS variables. */
export function SeasonDocument() {
  const season = useSeason();
  const tod = useTimeOfDay();
  const lastTod = useRef<string | null>(null);
  useEffect(() => {
    const root = document.documentElement;
    // Time of day (10-16): when ONLY the slot changed, let the window colors ease over the same 600 ms as the wall
    // (html[data-tod-fade] turns the registered custom-property transitions on, globals.css).
    const slotOnly = !!season && lastTod.current != null && lastTod.current !== tod && root.getAttribute('data-season') === season;
    lastTod.current = tod;
    let fadeTimer: ReturnType<typeof setTimeout> | undefined;
    if (slotOnly) {
      root.setAttribute('data-tod-fade', '1');
      fadeTimer = setTimeout(() => root.removeAttribute('data-tod-fade'), TIME_OF_DAY_FADE_MS + 100);
    }
    if (season) root.setAttribute('data-tod', tod); else root.removeAttribute('data-tod');
    const p = seasonPalette(season);
    // Season surfaces: the windows' CSS variables + html[data-season-tone].
    for (const k of SURFACE_CSS_VARS) root.style.removeProperty(k);
    const wasDark = root.getAttribute('data-season-tone') === 'dark';
    root.removeAttribute('data-season-tone');
    const surfaces = seasonSurfaces(season, readSurfacesChoice(), season ? tod : 'night');
    if (surfaces) root.setAttribute('data-wall-ink', surfaces.wallInk ?? 'light'); else root.removeAttribute('data-wall-ink');
    if (surfaces) {
      for (const [k, v] of Object.entries(surfaceCssVars(surfaces))) root.style.setProperty(k, v);
      root.setAttribute('data-season-tone', surfaces.tone ?? 'light');
    }
    // A dark tone wears the dark theme while the season shows (iOS ThemeManager: tone dark flips
    // isDark — light ink, the dark tab bar / sheets); leaving it restores the stored theme.
    if (surfaces?.tone === 'dark') root.setAttribute('data-theme', 'dark');
    else if (wasDark) {
      let stored: string | null = null;
      try { stored = localStorage.getItem('wordle-duel-theme'); } catch { stored = null; }
      root.setAttribute('data-theme', stored || 'default');
    }
    if (!season || !p) {
      root.removeAttribute('data-season');
      root.style.removeProperty('--season-button-tint');
      root.style.removeProperty('--season-quiet-tint');
      root.style.removeProperty('--season-accent');
      return () => { if (fadeTimer) clearTimeout(fadeTimer); };
    }
    root.setAttribute('data-season', season);
    root.style.setProperty('--season-button-tint', p.buttonTint);
    root.style.setProperty('--season-quiet-tint', p.quietTint);
    root.style.setProperty('--season-accent', p.accent);
    return () => { if (fadeTimer) clearTimeout(fadeTimer); };
  }, [season, tod]);
  return null;
}
