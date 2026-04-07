export interface TileThemeConfig {
  correct: string;   // bg class for correct tile
  present: string;   // bg class for present tile
  absent: string;    // bg class for absent tile
  empty: string;     // bg class for empty tile
  text: string;      // text color class
  border: string;    // border class
}

export const DEFAULT_THEME: TileThemeConfig = {
  correct: 'bg-green-600',
  present: 'bg-yellow-600',
  absent: 'bg-zinc-700',
  empty: 'bg-zinc-800',
  text: 'text-white',
  border: 'border-zinc-600',
};

export const TILE_THEMES: Record<string, TileThemeConfig> = {
  tile_neon: {
    correct: 'bg-emerald-500 shadow-lg shadow-emerald-500/50',
    present: 'bg-amber-400 shadow-lg shadow-amber-400/50',
    absent: 'bg-slate-800',
    empty: 'bg-slate-900 border-cyan-500/30',
    text: 'text-white',
    border: 'border-cyan-400/40',
  },
  tile_pastel: {
    correct: 'bg-green-300',
    present: 'bg-amber-200',
    absent: 'bg-stone-300',
    empty: 'bg-stone-100',
    text: 'text-stone-800',
    border: 'border-stone-300',
  },
  tile_golden: {
    correct: 'bg-amber-500',
    present: 'bg-orange-400',
    absent: 'bg-stone-600',
    empty: 'bg-stone-700',
    text: 'text-white',
    border: 'border-amber-600/40',
  },
};

export function getTileTheme(themeId?: string): TileThemeConfig {
  if (!themeId) return DEFAULT_THEME;
  return TILE_THEMES[themeId] ?? DEFAULT_THEME;
}
