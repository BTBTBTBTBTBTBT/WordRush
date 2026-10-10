// FINISH_SPEC AR: the live-lettering palettes + the fit rule for LiveHeadline
// (components/ui/live-headline.tsx). Pure, so the tests read the same numbers.

export type HeadlinePalette = 'home' | 'friends' | 'leaderboard' | 'vs' | 'stats' | 'celebrate' | 'menu';

export interface HeadlinePaletteSpec {
  /** Main lettering: vertical gradient top → bottom. */
  top: string;
  bottom: string;
  /** The 3D extrusion under the glyphs. */
  deep: string;
  /** Names: the accent gradient. */
  nameTop: string;
  nameBottom: string;
  /** Founder 10-09: numbers' own fill (default: the gold soft-number tint) and the atlas glyph rim (default: the warm rim). */
  numberTop?: string;
  numberBottom?: string;
  rim?: string;
}

/** The thin gold outline every palette shares. */
export const HEADLINE_OUTLINE = '#f5c542';
/** Numbers: gold soft numbers on every palette. */
export const HEADLINE_NUMBER = { top: '#ffe58a', bottom: '#f5a524', deep: '#a8560a' } as const;

export const HEADLINE_PALETTES: Record<HeadlinePalette, HeadlinePaletteSpec> = {
  home: { top: '#a66bff', bottom: '#d946ef', deep: '#4c1d95', nameTop: '#ff8fd8', nameBottom: '#e11d8f' },
  menu: { top: '#a66bff', bottom: '#7c3aed', deep: '#3b1a78', nameTop: '#ff8fd8', nameBottom: '#e11d8f' },
  friends: { top: '#ff7ab8', bottom: '#fb7c2c', deep: '#9a2b4f', nameTop: '#ffd166', nameBottom: '#f97316' },
  leaderboard: { top: '#ffd76a', bottom: '#f59e0b', deep: '#92400e', nameTop: '#c084fc', nameBottom: '#7c3aed' },
  vs: { top: '#2dd4bf', bottom: '#2563eb', deep: '#1e3a8a', nameTop: '#ffd166', nameBottom: '#f97316' },
  stats: { top: '#60a5fa', bottom: '#7c3aed', deep: '#312e81', nameTop: '#ff8fd8', nameBottom: '#db2777' },
  celebrate: { top: '#fff1a8', bottom: '#f5a524', deep: '#92400e', nameTop: '#c084fc', nameBottom: '#7c3aed' },
};

/** Auto-shrink before wrapping: never below this scale on one line. */
export const HEADLINE_MIN_SCALE = 0.72;

/**
 * How a headline that needs `need` px on one line fits in `avail` px: shrink
 * (down to HEADLINE_MIN_SCALE) on one line, else wrap (max 2 balanced lines)
 * at the minimum scale.
 */
export function headlineFit(need: number, avail: number, minScale = HEADLINE_MIN_SCALE): { scale: number; wrap: boolean } {
  if (!(need > 0) || !(avail > 0) || need <= avail) return { scale: 1, wrap: false };
  const s = avail / need;
  if (s >= minScale) return { scale: Math.floor(s * 1000) / 1000, wrap: false };
  return { scale: minScale, wrap: true };
}
