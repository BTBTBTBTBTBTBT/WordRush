// Themes as data (FRIDAY-QUEUE item 25): Default / Ocean / Forest / Dark read from
// packages/core/src/theme-registry.json (copied byte for byte to iOS + Android), the way season-kit.ts reads the
// season registry. A theme skins the same slots a season does: the wall (3 stops + a code-drawn glow), card wash,
// ink, accent, tab bar and the living wallpaper (ambient). Season skins layer on top when Seasonal is on.

import registryJson from '../../../packages/core/src/theme-registry.json';
import { mixHex, themeSurfaces, type BaseTheme } from '@wordle-duel/core';

export interface ThemeLook {
  wall: [string, string, string];
  glow: string;
  card: string;
  ink: string;
  inkSecondary: string;
  accent: string;
  tabBar: string;
}

export type AmbientKind = 'tiles' | 'bubbles' | 'leaves';

export interface ThemeAmbient {
  kind: AmbientKind;
  count: number;
  sprites: string[];
  size: [number, number];
  duration: [number, number];
  opacity: number;
}

export interface ThemeEntry {
  id: BaseTheme;
  title: string;
  subtitle: string;
  /** null = dark-only (the Dark theme). */
  /** Board tile colors (correct / present); colorblind mode still wins. */
  tiles: { correct: string; present: string };
  light: ThemeLook | null;
  dark: ThemeLook;
  ambient: ThemeAmbient;
}

export interface SeasonalAmbient {
  kind: 'halloween';
  bats: { count: number; sprite: string; size: [number, number]; duration: [number, number] };
  witch: { sprite: string; size: number; every: number; duration: number };
  fog: { sprite: string; opacity: number; duration: number };
  stars: { count: number; color: string };
}

export interface SeasonalEntry {
  title: string;
  subtitle: string;
  previewWall: [string, string, string];
  previewTiles: { letter: string; color: string }[];
  ambient: SeasonalAmbient;
}

const REGISTRY = registryJson as unknown as { themes: ThemeEntry[]; seasonal: Record<string, SeasonalEntry> };

export const THEME_REGISTRY: readonly ThemeEntry[] = REGISTRY.themes;

export function themeEntry(id: string): ThemeEntry {
  return THEME_REGISTRY.find((t) => t.id === id) ?? THEME_REGISTRY[0];
}

/** The Seasonal row's data for a season (null when the registry has none). */
export function seasonalEntry(season: string | null): SeasonalEntry | null {
  return (season && REGISTRY.seasonal[season]) || null;
}

/** The look a theme draws in the given scheme (Dark is always night). */
export function themeLook(id: string, dark: boolean): ThemeLook {
  const t = themeEntry(id);
  return dark || !t.light ? t.dark : t.light;
}

/** Public path of an ambient sprite (public/ambient/<name>.webp). */
export function ambientSrc(name: string): string {
  return `/ambient/${name}.webp`;
}

/**
 * The CSS custom properties that skin the page wall layer for a theme (components/ui/theme-wall.tsx reads
 * them; globals.css .theme-wall). All colors, no images: the wall is drawn in code at full resolution.
 */
export function themeWallVars(id: string): Record<string, string> {
  const t = themeEntry(id);
  const l = t.light ?? t.dark;
  return {
    '--tw-1': l.wall[0], '--tw-2': l.wall[1], '--tw-3': l.wall[2], '--tw-glow': l.glow,
    '--tw-d1': t.dark.wall[0], '--tw-d2': t.dark.wall[1], '--tw-d3': t.dark.wall[2], '--tw-dglow': t.dark.glow,
  };
}

/**
 * The skin of Ocean / Forest / Dark as CSS (item 25), generated from the registry and injected once in the root layout
 * (app/layout.tsx), so it paints on the server render with no flash. A STYLESHEET rule, not inline style, on purpose:
 * a season's surfaces (SeasonDocument sets them inline on <html>) and colorblind mode (the :not() below) both win over
 * it. Slots: card surfaces + borders + ink (the --color-* tokens), the board tiles (--tile-correct / --key-correct),
 * the button family tint, the tab dock and the headline accent.
 */
export function themeSkinCss(): string {
  const out: string[] = [];
  for (const t of THEME_REGISTRY) {
    if (t.id === 'default') continue;
    const l = t.light ?? t.dark;
    const s = themeSurfaces(l);
    const sel = `html[data-theme="${t.id}"]`;
    out.push(`${sel}{--color-surface:${s.surface};--color-surface-hover:${s.surfaceHover};--color-surface-alt:${s.surfaceAlt};--color-border:${s.border};--color-border-alt:${s.borderAlt};--color-border-light:${s.borderLight};--color-divider:${s.divider};--color-text:${s.text};--color-text-secondary:${s.textSecondary};--color-text-muted:${s.textMuted};--theme-accent:${l.accent}}`);
    out.push(`${sel}:not([data-colorblind="true"]){--tile-correct:${t.tiles.correct};--tile-correct-border:${t.tiles.correct};--tile-present:${t.tiles.present};--tile-present-border:${t.tiles.present};--key-correct:${mixHex(t.tiles.correct, '#000000', 0.12)}}`);
    out.push(`${sel}:not([data-season]) .candy{--fam-tint:${l.accent}}`);
    out.push(`${sel}:not([data-season]) .candy.candy-peach:not(.candy-on){--fam-fill:color-mix(in srgb,${l.accent} 18%,${l.card});--fam-fill-p:color-mix(in srgb,${l.accent} 25%,${l.card});--fam-ink:color-mix(in srgb,${l.accent} 70%,#000000)}`);
    out.push(`${sel}:not([data-season-tone]) .tab-dock{--tab-dock-1:${mixHex(s.tabBar, '#FFFFFF', t.id === 'dark' ? 0.06 : 0.35)};--tab-dock-2:${s.tabBar};--tab-pill-ring:${s.tabBar};border-top-color:${s.tabEdge}}`);
  }
  return out.join('\n');
}

/** The accent a theme gives page headlines (bubble lettering), or null for Default. */
export function themeHeadlineAccent(id: string): string | null {
  if (id === 'default') return null;
  const t = themeEntry(id);
  return (t.light ?? t.dark).accent;
}
