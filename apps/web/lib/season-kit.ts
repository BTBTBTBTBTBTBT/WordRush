// The season registry on the web (docs/design/brand/seasons/README.md "How to add a season").
// One registry (packages/core/src/season-registry.json, copied to iOS + Android) says, per season,
// which shipped art replaces which normal art: the cast, a title per game / screen, the walls, the
// props pair, the Home banner, extras; plus a palette (button tints, wall fallback stops). Every
// lookup returns null when the slot is missing OR the file doesn't ship (season-art.generated.json,
// written by ship-art.py --seasons), so a partial season never leaves a hole: the normal art stays.
// Pure (no React); lib/season.ts decides WHICH season is active (the date or the admin preview).
import registryJson from '../../../packages/core/src/season-registry.json';
import generatedSizes from './season-art.generated.json';

export interface SeasonPalette {
  accent: string;
  buttonTint: string;
  quietTint: string;
  wallLight: [string, string, string];
  wallDark: [string, string, string];
}

export interface SeasonSlots {
  /** The cast skin pattern, `{id}` = the cast id (w, o1, r …). */
  cast?: string;
  /** The skins' square side (px) and each one's alpha box [x0, y0, x1, y1] (the cast row frames them). */
  castSize?: number;
  castTrim?: Record<string, [number, number, number, number]>;
  /** Normal art name → seasonal art name (titles). */
  titles?: Record<string, string>;
  /** Normal wall name (or `prefix*`) → seasonal wall; `<name>-light` wins in light mode. */
  walls?: Record<string, string>;
  props?: string[];
  banner?: string;
  extras?: Record<string, string>;
}

export interface SeasonEntry {
  id: string;
  title: string;
  palette: SeasonPalette;
  slots: SeasonSlots;
}

export const SEASON_REGISTRY: readonly SeasonEntry[] = (registryJson as unknown as { seasons: SeasonEntry[] }).seasons;

/** Shipped seasonal art: name → [width, height] (ship-art.py --seasons). Cast skins / props live in lib/art.ts. */
export const SEASON_ART_SIZE: Readonly<Record<string, readonly [number, number]>> = generatedSizes as unknown as Record<string, [number, number]>;

export function seasonEntry(id: string | null | undefined): SeasonEntry | null {
  return id ? SEASON_REGISTRY.find((s) => s.id === id) ?? null : null;
}

/** Does this seasonal art ship on the web? */
export function seasonArtShips(name: string): boolean {
  return name in SEASON_ART_SIZE;
}

/** A slot map lookup: the exact key first, then the longest `prefix*` key. */
export function slotLookup(map: Record<string, string> | undefined, name: string): string | null {
  if (!map) return null;
  if (map[name]) return map[name];
  let best: string | null = null;
  let len = -1;
  for (const [k, v] of Object.entries(map)) {
    if (k.endsWith('*') && name.startsWith(k.slice(0, -1)) && k.length > len) {
      best = v;
      len = k.length;
    }
  }
  return best;
}

/** The season's title that replaces `name` (an art-titlecast-* / art-game-* name), when it ships. */
export function seasonalTitle(name: string, season: string | null | undefined): { name: string; src: string; size: readonly [number, number] } | null {
  const s = seasonEntry(season);
  const swap = s ? slotLookup(s.slots.titles, name) : null;
  if (!swap || !seasonArtShips(swap)) return null;
  return { name: swap, src: `/art/${swap}.webp`, size: SEASON_ART_SIZE[swap] };
}

/**
 * The season's wallpaper for a normal wall name, per scheme: light mode takes `<wall>-light` when it
 * ships (dark-on-light text keeps reading), else the base wall; dark mode the base. Null = keep normal.
 */
export function seasonalWall(name: string, season: string | null | undefined, scheme: 'light' | 'dark'): string | null {
  const s = seasonEntry(season);
  const swap = s ? slotLookup(s.slots.walls, name) : null;
  if (!swap) return null;
  if (scheme === 'light' && seasonArtShips(`${swap}-light`)) return `${swap}-light`;
  return seasonArtShips(swap) ? swap : null;
}

/** The season's Home banner art (shipped), else null. */
export function seasonBanner(season: string | null | undefined): string | null {
  const b = seasonEntry(season)?.slots.banner;
  return b && seasonArtShips(b) ? b : null;
}

export function seasonPalette(season: string | null | undefined): SeasonPalette | null {
  return seasonEntry(season)?.palette ?? null;
}

/** "Halloween" for the picker. */
export function seasonLabel(id: string): string {
  return seasonEntry(id)?.title ?? id.charAt(0).toUpperCase() + id.slice(1).replace(/-/g, ' ');
}
