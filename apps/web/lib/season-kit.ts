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

/**
 * The season's windows (registry `surfaces`): page cards, the Home hero card, the game cards' drip
 * caps and the game board tray recolor so the whole screen reads seasonal. Every slot is optional.
 */
export interface SeasonSurfaces {
  /** 'dark' = light on-card + on-wall text, the dark wall in every scheme. */
  tone?: 'dark' | 'light';
  card?: string;
  cardOpacity?: number;
  hero?: string;
  heroOpacity?: number;
  raised?: string;
  /** The drip cap's stops, top lip → body → base; `capTint` mixes each game's color into the body. */
  cap?: [string, string, string];
  capTint?: number;
  glow?: string;
  text?: string;
  textMuted?: string;
  textSecondary?: string;
  /** The hero greeting lettering: top, bottom, deep, nameTop, nameBottom. */
  headline?: [string, string, string, string, string];
  bannerGlow?: string;
  cobweb?: string;
}

export interface SeasonEntry {
  id: string;
  title: string;
  palette: SeasonPalette;
  slots: SeasonSlots;
  surfaces?: SeasonSurfaces;
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

// ── Season surfaces ─────────────────────────────────────────────────────────

/**
 * The season's surfaces: the registry's `surfaces`, unless the DEBUG choice is 'off'. Null = the
 * normal look.
 */
export function seasonSurfaces(season: string | null | undefined, choice?: string | null): SeasonSurfaces | null {
  const s = seasonEntry(season);
  if (!s || choice === 'off') return null;
  return s.surfaces ?? null;
}

/** The hero greeting's lettering in the season's colors (registry `headline`: top, bottom, deep,
 *  nameTop, nameBottom); null = the normal palette. iOS SeasonKit.Look.headlinePalette. */
export function seasonHeadlineSpec(s: SeasonSurfaces | null | undefined): { top: string; bottom: string; deep: string; nameTop: string; nameBottom: string } | null {
  const h = s?.headline;
  if (!h || h.length !== 5) return null;
  return { top: h[0], bottom: h[1], deep: h[2], nameTop: h[3], nameBottom: h[4] };
}

function rgba(hex: string, a: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/**
 * The CSS variables a season's surfaces hand the document (SeasonDocument). The cards already
 * paint over `--color-card-base` and read `--color-text*`, so a translucent card base + the ink
 * recolor every card; the drip caps read `--season-cap-*` (card-trim seasonTrimStops).
 */
export function surfaceCssVars(s: SeasonSurfaces): Record<string, string> {
  const v: Record<string, string> = {};
  if (s.card) {
    v['--color-card-base'] = rgba(s.card, s.cardOpacity ?? 1);
    v['--color-surface'] = s.card;
  }
  if (s.hero ?? s.card) v['--season-hero-fill'] = rgba((s.hero ?? s.card)!, s.hero ? s.heroOpacity ?? 1 : s.cardOpacity ?? 1);
  if (s.raised) {
    v['--color-surface-alt'] = s.raised;
    v['--color-surface-hover'] = s.raised;
  }
  if (s.text) v['--color-text'] = s.text;
  if (s.textMuted) v['--color-text-muted'] = s.textMuted;
  if (s.textSecondary) {
    v['--color-text-secondary'] = s.textSecondary;
    v['--banner-ink'] = s.textSecondary;
  }
  if (s.cap) {
    v['--season-cap-0'] = s.cap[0];
    v['--season-cap-1'] = s.cap[1];
    v['--season-cap-2'] = s.cap[2];
    v['--season-cap-tint'] = `${Math.round((s.capTint ?? 0) * 100)}%`;
  }
  if (s.glow) v['--season-glow'] = rgba(s.glow, s.tone === 'dark' ? 0.32 : 0.22);
  if (s.bannerGlow) v['--season-banner-glow'] = rgba(s.bannerGlow, s.tone === 'dark' ? 0.34 : 0.26);
  if (s.cobweb) v['--season-cobweb'] = rgba(s.cobweb, s.tone === 'dark' ? 0.42 : 0.38);
  if (s.tone === 'dark') v['--banner-gloss'] = '0.04';
  // A finished daily on dark glass wears its game color (mode-card modeCardSurface, home-banner Tile).
  if (s.tone === 'dark' && s.card) {
    v['--season-done-pct'] = `${SEASON_DONE.wash * 100}%`;
    v['--season-idle-pct'] = `${SEASON_DONE.idle * 100}%`;
    v['--season-done-glow'] = `${SEASON_DONE.glow}px`;
    v['--season-tile-idle-pct'] = `${SEASON_DONE.idleTile * 100}%`;
    v['--season-tile-base'] = s.card;
  }
  return v;
}

/**
 * A finished daily under a DARK season's glass (founder 10-05): the game color's share over the
 * night card (finished / unplayed), the finished card's glow blur, and an unplayed hero progress
 * tile's hint of color. iOS SeasonDone, Android SeasonDone.
 */
export const SEASON_DONE = { wash: 0.355, idle: 0.05, glow: 12, idleTile: 0.1 } as const;

/** Every variable surfaceCssVars can set (SeasonDocument clears them out of season). */
export const SURFACE_CSS_VARS = [
  '--color-card-base', '--color-surface', '--season-hero-fill', '--color-surface-alt', '--color-surface-hover',
  '--color-text', '--color-text-muted', '--color-text-secondary', '--banner-ink',
  '--season-cap-0', '--season-cap-1', '--season-cap-2', '--season-cap-tint',
  '--season-glow', '--season-banner-glow', '--season-cobweb', '--banner-gloss',
  '--season-done-pct', '--season-idle-pct', '--season-done-glow', '--season-tile-idle-pct', '--season-tile-base',
] as const;
