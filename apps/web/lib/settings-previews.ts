// FINISH_SPEC BI25: the live previews on the Settings THEME / KEYBOARD tiles and the
// single-fire rule for the header buttons that open Settings / Help. Parity: iOS
// Core SettingsPreviews (SettingsPreviewsTests), Android data/SettingsPreviews.kt.

export interface PreviewTile { letter: string; hex: string }
export interface ThemePreview { page: string; tiles: PreviewTile[] }

export const PREVIEW_WORD = 'WORD';

/** Four mini glossy tiles in the theme's colors on its page wash. */
export function themePreview(theme: string): ThemePreview {
  let page: string;
  let colors: string[];
  switch (theme) {
    case 'dark': page = '#1a1a2e'; colors = ['#7c3aed', '#f59e0b', '#4c1d95', '#475569']; break;
    case 'ocean': page = '#e3f0f7'; colors = ['#0ea5e9', '#14b8a6', '#0369a1', '#67c6e3']; break;
    case 'forest': page = '#e8f2e4'; colors = ['#16a34a', '#b45309', '#166534', '#84a98c']; break;
    default: page = '#f3f0ff'; colors = ['#7c3aed', '#f59e0b', '#7c3aed', '#94a3b8'];
  }
  return { page, tiles: PREVIEW_WORD.split('').map((letter, i) => ({ letter, hex: colors[i] })) };
}

export const KEY_ENTER = 'ENTER';
export const KEY_DELETE = 'DEL';
export const KEY_SPACE = 'SPACE';

/** The mini key rows: where Enter and Delete sit (the Z row; Michael adds a 4th row). */
export function keyRows(layout: string): string[][] {
  const letters = ['Z', 'X', 'C', 'V'];
  switch (layout) {
    case 'flipped': return [[KEY_DELETE, ...letters, KEY_ENTER]];
    case 'michael': return [[KEY_DELETE, ...letters, KEY_DELETE], [KEY_ENTER, KEY_SPACE, KEY_ENTER]];
    default: return [[KEY_ENTER, ...letters, KEY_DELETE]];
  }
}

/** Repeat taps within this window are the same tap. */
export const SHEET_DEBOUNCE_MS = 600;

/** Whether a sheet-opening tap fires: never while one is open, never within the debounce. */
export function sheetTapFires(nowMs: number, lastFireMs: number | null, presenting: boolean): boolean {
  if (presenting) return false;
  if (lastFireMs == null) return true;
  const dt = nowMs - lastFireMs;
  return dt < 0 || dt >= SHEET_DEBOUNCE_MS;
}
