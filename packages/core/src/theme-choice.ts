// ============================================================
// Theme choice + the "Seasonal" row (FRIDAY-QUEUE items 24 + 25)
// ============================================================
// Settings > Theme lists Default / Ocean / Forest / Dark and, INSIDE a season window, a "Seasonal — <season>"
// row at the top. The rules (pinned by theme-choice-fixtures.json, ported 1:1 to ThemeChoice.swift /
// ThemeChoice.kt):
//   - the player's BASE theme is never overwritten by a season: it is what comes back when the season ends
//   - inside the window Seasonal is preset ON for everyone (even a player on Dark)
//   - picking any theme row inside the window opts out of Seasonal FOR THIS SEASON (and year): `seasonOptOut`
//   - picking the Seasonal row clears the opt-out
//   - outside a season the row is hidden and the base theme applies
//   - the `season_halloween` off-switch (feature-switches.ts) turns every season look off: row hidden, base theme
// `seasonOptOut` = "<season>:<year>" and is synced to the account (profiles.season_opt_out).

import { SEASON_WINDOWS } from './level-season';

export type BaseTheme = 'default' | 'ocean' | 'forest' | 'dark';
export const BASE_THEMES: readonly BaseTheme[] = ['default', 'ocean', 'forest', 'dark'];

export interface ThemeChoice {
  /** The player's own theme (default until they pick). */
  theme: BaseTheme;
  /** "<season>:<year>" the player opted out of, or null. */
  seasonOptOut: string | null;
}

export const DEFAULT_THEME_CHOICE: ThemeChoice = { theme: 'default', seasonOptOut: null };

/** "<season>:<year>" for a season and a local "YYYY-MM-DD" date. */
export function seasonOptOutKey(season: string, date: string): string {
  return `${season}:${date.slice(0, 4)}`;
}

/** Is the Seasonal look on right now? `season` is the calendar's (null outside a window). */
export function seasonalActive(choice: ThemeChoice, season: string | null, switchOn: boolean, date: string): boolean {
  if (!season || !switchOn) return false;
  return choice.seasonOptOut !== seasonOptOutKey(season, date);
}

/** Should Settings list the Seasonal row at all? (Inside a window with the switch on.) */
export function showSeasonalRow(season: string | null, switchOn: boolean): boolean {
  return !!season && switchOn;
}

/** What to draw: the base theme, and whether the season layers on top. */
export function effectiveTheme(choice: ThemeChoice, season: string | null, switchOn: boolean, date: string): { base: BaseTheme; seasonal: boolean } {
  return { base: choice.theme, seasonal: seasonalActive(choice, season, switchOn, date) };
}

/** The choice after a tap on a Settings theme row ('seasonal' or a base theme). */
export function pickTheme(choice: ThemeChoice, picked: BaseTheme | 'seasonal', season: string | null, date: string): ThemeChoice {
  if (picked === 'seasonal') return { theme: choice.theme, seasonOptOut: null };
  // A base theme inside a window opts out of the season (until next year's window); outside one it is just a pick.
  return { theme: picked, seasonOptOut: season ? seasonOptOutKey(season, date) : choice.seasonOptOut };
}

/** "Oct 31": the season window's last day, for the row's subtitle ("Black & orange · until Oct 31"). */
export function seasonEndLabel(season: string): string | null {
  const w = SEASON_WINDOWS.find((s) => s.id === season);
  if (!w) return null;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[w.end[0] - 1]} ${w.end[1]}`;
}

/** Tolerant read of a stored base theme (anything unknown = default). */
export function parseBaseTheme(v: unknown): BaseTheme {
  return typeof v === 'string' && (BASE_THEMES as readonly string[]).includes(v) ? (v as BaseTheme) : 'default';
}
