import { useEffect, useState } from 'react';
import { SEASON_IDS, currentSeason, isFeatureLive, seasonOptOutKey, type Season, type SwitchRow } from '@wordle-duel/core';
import { artSrc, halloweenSrc } from './art';
import { MASCOT_ART_SIZE, MASCOT_TRIM, boxAspect, boxTrimLayout, type TrimBox } from './cast-moves';
import { CAST, mascotSrc, type MascotId } from './mascots';
import { artTrimOverride } from './art-override';
import { SEASON_REGISTRY, seasonEntry } from './season-kit';
import type { CastRowLayout, CastSlot } from './share-fit';

// Seasonal cast skins (docs/FINISH_SPEC.md X). During the season (core
// currentSeason on the player's LOCAL date — Halloween runs Oct 9 – Oct 31)
// the ten art-halloween-<id> skins replace the hero cast in the living cast
// header, the cold-start intro + landing flourish, the share-image cast
// wordmark and the loading screen. Admin / QA preview on any page:
// `?season=<id>` (any registry season) forces it, `?season=none` forces it off,
// `?season=auto` clears the preview; the choice holds for the browser session.
// Admins also get Settings > Season preview (setSeasonPreview), which writes the
// same key. What each season swaps: lib/season-kit.ts (the registry).

export type { Season };
export type SeasonOverride = Season | 'none';

/** The query parameter and the sessionStorage key of the preview. */
export const SEASON_PARAM = 'season';
export const SEASON_PREVIEW_KEY = 'wordocious-season-preview';
/** Fired on window when the preview changes, so mounted headers re-read it. */
export const SEASON_EVENT = 'wordocious:season';

/**
 * The preview a URL query asks for: 'halloween' | 'none', 'auto' to clear the
 * stored preview, or null when the query doesn't mention the season (or names
 * an unknown one).
 */
export function parseSeasonParam(search: string): SeasonOverride | 'auto' | null {
  let v: string | null = null;
  try {
    v = new URLSearchParams(search).get(SEASON_PARAM);
  } catch {
    return null;
  }
  if (v == null) return null;
  const s = v.trim().toLowerCase();
  if ((SEASON_IDS as readonly string[]).includes(s)) return s as Season;
  if (s === 'none' || s === 'off') return 'none';
  if (s === 'auto') return 'auto';
  return null;
}

/** A stored preview value, validated (anything else reads as no preview). */
export function parseStoredSeason(v: string | null | undefined): SeasonOverride | null {
  if (v === 'none') return 'none';
  return v && (SEASON_IDS as readonly string[]).includes(v) ? (v as Season) : null;
}

/**
 * The admin Settings picker: a registry season id, or null = Off (by date). Writes the session's
 * preview key and tells every mounted season reader (SEASON_EVENT), so the page flips live.
 */
export function setSeasonPreview(season: Season | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (season) sessionStorage.setItem(SEASON_PREVIEW_KEY, season);
    else sessionStorage.removeItem(SEASON_PREVIEW_KEY);
  } catch { /* storage blocked: the URL param still works */ }
  // Drop a ?season= on this URL so it doesn't re-force the old choice on the next read.
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has(SEASON_PARAM)) {
      url.searchParams.delete(SEASON_PARAM);
      window.history.replaceState(window.history.state, '', url.toString());
    }
  } catch { /* ignore */ }
  window.dispatchEvent(new Event(SEASON_EVENT));
}

/** The stored preview for the picker (null = Off, by date). */
export function storedSeasonPreview(): Season | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = parseStoredSeason(sessionStorage.getItem(SEASON_PREVIEW_KEY));
    return v && v !== 'none' ? v : null;
  } catch {
    return null;
  }
}

/** The season to draw: the preview when there is one, else the calendar's. */
export function resolveSeason(date: string | Date, override: SeasonOverride | null): Season | null {
  if (override === 'none') return null;
  if (override) return override;
  return currentSeason(date);
}

/**
 * The session's preview (client only): a `?season=` on this page wins and is
 * remembered for the session; otherwise whatever an earlier page stored.
 */
export function readSeasonOverride(): SeasonOverride | null {
  if (typeof window === 'undefined') return null;
  const fromUrl = parseSeasonParam(window.location.search);
  try {
    if (fromUrl === 'auto') {
      sessionStorage.removeItem(SEASON_PREVIEW_KEY);
      return null;
    }
    if (fromUrl) {
      sessionStorage.setItem(SEASON_PREVIEW_KEY, fromUrl);
      return fromUrl;
    }
    return parseStoredSeason(sessionStorage.getItem(SEASON_PREVIEW_KEY));
  } catch {
    return fromUrl === 'auto' ? null : fromUrl;
  }
}

/** DEBUG: `?surfaces=off` turns the season's surfaces off (wall + art stay) for a perf / contrast A/B (remembered for the session; '' = on). */
export const SURFACES_PARAM = 'surfaces';
export const SURFACES_PREVIEW_KEY = 'wordocious-season-surfaces';

export function readSurfacesChoice(): string | null {
  if (typeof window === 'undefined') return null;
  let v: string | null = null;
  try {
    v = new URLSearchParams(window.location.search).get(SURFACES_PARAM);
  } catch {
    v = null;
  }
  try {
    if (v != null) {
      if (v === '' || v === 'auto') sessionStorage.removeItem(SURFACES_PREVIEW_KEY);
      else sessionStorage.setItem(SURFACES_PREVIEW_KEY, v);
      return v || null;
    }
    return sessionStorage.getItem(SURFACES_PREVIEW_KEY);
  } catch {
    return v;
  }
}

// ── Seasonal row (items 24 + 25) ────────────────────────────────────────────

/** Where the player's "no Seasonal for this season" choice lives ("<season>:<year>"); synced to the account by theme-context. */
export const SEASON_OPT_OUT_KEY = 'wordocious-season-optout';
/** use-flags.ts caches the app_flags table here (indexed by key). */
const FLAGS_CACHE_KEY = 'wordocious-app-flags';

/** The local calendar date as YYYY-MM-DD. */
export function localDateString(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

export function readSeasonOptOut(): string | null {
  try { return localStorage.getItem(SEASON_OPT_OUT_KEY) || null; } catch { return null; }
}

/**
 * The `season_halloween` off-switch (core feature-switches, fail OPEN) from the cached flags table, so every season
 * resolver can honor it without a hook. Unreadable / no cache / no row = on.
 */
export function seasonSwitchOn(): boolean {
  return cachedSwitchOn('season_halloween');
}

/** Any 2.8 off-switch from the cached flags table (fail open), for code that can't use a hook. */
export function cachedSwitchOn(key: string): boolean {
  try {
    const raw = localStorage.getItem(FLAGS_CACHE_KEY);
    const flags = raw ? (JSON.parse(raw) as Record<string, SwitchRow>) : null;
    return isFeatureLive(key, flags, false);
  } catch {
    return true;
  }
}

/**
 * The season right now on this device (client only; null on the server). An admin / QA preview wins over
 * everything; otherwise the calendar's season, unless the `season_halloween` off-switch is off or this player
 * picked another theme for this season (Settings > Theme, "Seasonal" row).
 */
export function activeSeason(now: Date = new Date()): Season | null {
  if (typeof window === 'undefined') return null;
  const override = readSeasonOverride();
  const season = resolveSeason(now, override);
  if (override || !season) return season;
  if (!seasonSwitchOn()) return null;
  return readSeasonOptOut() === seasonOptOutKey(season, localDateString(now)) ? null : season;
}

/**
 * The season for a client component. Null on the server and in the first
 * client render (so hydration matches), then the real value; re-read when the
 * tab comes back (the day may have changed) and on client navigations that
 * carry a new `?season=` (SEASON_EVENT / popstate).
 */
export function useSeason(): Season | null {
  const [season, setSeason] = useState<Season | null>(null);
  useEffect(() => {
    const read = () => setSeason(activeSeason());
    read();
    const onVis = () => { if (document.visibilityState === 'visible') read(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener(SEASON_EVENT, read);
    window.addEventListener('popstate', read);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener(SEASON_EVENT, read);
      window.removeEventListener('popstate', read);
    };
  }, []);
  return season;
}

// ── Skin framing ────────────────────────────────────────────────────────────

/** The Halloween skins are 320 px squares (public/art/art-halloween-<id>.webp). */
export const SKIN_ART_SIZE = 320;

/**
 * Where each Halloween skin sits inside its 320 px square: the alpha bounding
 * box [x0, y0, x1, y1] (measured from the shipped webp files, alpha > 8).
 * The skins aren't trimmed like the hero mascots; drawing each one cut to its
 * box keeps the row reading WORDOCIOUS edge to edge at one height.
 * 10-05: re-measured for the on-model layered skins (seasons/halloween/header/).
 */
export const HALLOWEEN_TRIM: Record<MascotId, TrimBox> = {
  w: [6, 31, 313, 289],
  o1: [6, 9, 313, 310],
  r: [21, 6, 298, 313],
  d: [36, 6, 283, 313],
  o2: [45, 6, 274, 313],
  c: [33, 6, 287, 313],
  i: [59, 6, 261, 313],
  o3: [8, 6, 311, 313],
  u: [6, 38, 313, 281],
  s: [19, 6, 300, 313],
};

/** One cast member's art for a season: the image, its square size and art box. */
export interface CastArt {
  src: string;
  /** The square image's side (px). */
  artSize: number;
  trim: TrimBox;
  /** Width / height of the trimmed box (the row's flex weight). */
  aspect: number;
  /** The image's size + offset inside a box of `aspect` (percent strings). */
  layout: { width: string; left: string; top: string };
}

/** The hero (no season) or the season's skin for one cast member. */
export function castArt(id: MascotId, season: Season | null): CastArt {
  // Season preview registry (lib/season-kit.ts): the season's skin name + its measured alpha box.
  const slots = seasonEntry(season)?.slots;
  const skin = slots?.cast && slots.castTrim?.[id] ? slots.cast.replace('{id}', id) : null;
  // Admin Art Library preview only (lib/art-override.ts): a candidate costume framed by its own alpha box.
  const swap = artTrimOverride(skin ?? `mascot-${id}`);
  if (swap) {
    const src = skin ? artSrc(skin) : mascotSrc(id);
    return { src, artSize: swap.size, trim: swap.trim, aspect: boxAspect(swap.trim), layout: boxTrimLayout(swap.trim, swap.size) };
  }
  if (skin && slots?.castTrim) {
    const trim = slots.castTrim[id] as TrimBox;
    const size = slots.castSize ?? SKIN_ART_SIZE;
    return { src: artSrc(skin), artSize: size, trim, aspect: boxAspect(trim), layout: boxTrimLayout(trim, size) };
  }
  const trim = MASCOT_TRIM[id];
  return { src: mascotSrc(id), artSize: MASCOT_ART_SIZE, trim, aspect: boxAspect(trim), layout: boxTrimLayout(trim, MASCOT_ART_SIZE) };
}

/** The image paths a canvas tries for one cast member: the skin first, the hero as the fallback. */
export function castImageSources(id: MascotId, season: Season | null): string[] {
  return season ? [castArt(id, season).src, mascotSrc(id)] : [mascotSrc(id)];
}

/** Which art a loaded image is (by its path): a Halloween skin or the hero. */
export function seasonOfSrc(src: string): Season | null {
  for (const s of SEASON_REGISTRY) {
    const prefix = s.slots.cast?.split('{id}')[0];
    if (prefix && src.includes(`/${prefix}`)) return s.id as Season;
  }
  return null;
}

/**
 * The share wordmark row re-laid for characters of other aspects (the skins):
 * the same character height, lift, overlap and center as `row` (share-fit
 * castRowLayout, which is built from the hero boxes), each slot as wide as
 * its own art, so the skins still stand edge to edge spelling WORDOCIOUS.
 */
export function reflowCastRow(row: CastRowLayout, aspectOf: (id: MascotId) => number): CastRowLayout {
  const slots = row.slots;
  if (slots.length === 0) return row;
  const step = slots.length > 1 ? slots[0].x + slots[0].w - slots[1].x : 0;
  const cx = slots[0].x + row.rowW / 2;
  const widths = slots.map((s) => aspectOf(s.id) * row.charH);
  const rowW = widths.reduce((a, b) => a + b, 0) - step * (slots.length - 1);
  let x = cx - rowW / 2;
  const out: CastSlot[] = slots.map((s, i) => {
    const slot = { ...s, x, w: widths[i] };
    x += widths[i] - step;
    return slot;
  });
  return { ...row, rowW, slots: out };
}

/** The Halloween day-title / banner props (FINISH_SPEC X; not shipped yet — every slot hides when its file is missing). */
export const HALLOWEEN_PROPS = ['pumpkin', 'bat', 'candy', 'ghost'] as const;
export type HalloweenProp = (typeof HALLOWEEN_PROPS)[number];

/** Public path of a Halloween prop (art-halloween-prop-<name>.webp). Deliberately NOT in ART_SIZE until the files ship. */
export function halloweenPropSrc(name: HalloweenProp): string {
  return `/art/art-halloween-prop-${name}.webp`;
}

/** Public path of the Halloween Home banner art (not shipped yet). */
export const HALLOWEEN_BANNER_SRC = '/art/art-scene-banner-halloween.webp';

/** Every cast member, in WORDOCIOUS order, with its art for `season`. */
export function castRowArt(season: Season | null): { id: MascotId; art: CastArt }[] {
  return CAST.map((id) => ({ id, art: castArt(id, season) }));
}
