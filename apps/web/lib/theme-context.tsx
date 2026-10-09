'use client';

import { parseBaseTheme } from '@wordle-duel/core';
import { createContext, useCallback, useContext, useState, useEffect, ReactNode } from 'react';
import { currentSeason, pickTheme as pickThemeChoice, seasonalActive, showSeasonalRow, type BaseTheme } from '@wordle-duel/core';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase-client';
import { SEASON_EVENT, SEASON_OPT_OUT_KEY, localDateString, readSeasonOptOut, seasonSwitchOn } from '@/lib/season';

export type Theme = BaseTheme;

interface ThemeContextType {
  /** The player's own (base) theme: never overwritten by a season. */
  theme: Theme;
  /** Settings > Theme row tap: a base theme (inside a season window this opts out of Seasonal for the season) or 'seasonal'. */
  setTheme: (theme: Theme | 'seasonal') => void;
  /** The calendar's season right now (null outside a window or with the season_halloween off-switch off). */
  seasonRow: string | null;
  /** Seasonal is on (the row is selected): inside a window and not opted out. */
  seasonalOn: boolean;
  colorblindMode: boolean;
  setColorblindMode: (enabled: boolean) => void;
  reducedMotion: boolean;
  setReducedMotion: (enabled: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('default');
  const [seasonOptOut, setSeasonOptOut] = useState<string | null>(null);
  // The calendar's season for the Settings row (the admin preview never moves it).
  const [seasonRow, setSeasonRow] = useState<string | null>(null);
  const { user, profile } = useAuth();
  const [colorblindMode, setColorblindMode] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  // Don't write the defaults back before the stored values are read: under React
  // StrictMode (dev) the write-back effects ran first and the remount then read
  // 'default', so a saved Dark theme never applied locally.
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('wordle-duel-theme');
    if (stored) setThemeState(parseBaseTheme(stored));
    setSeasonOptOut(readSeasonOptOut());
    const readRow = () => {
      const s = currentSeason(new Date());
      setSeasonRow(s && seasonSwitchOn() ? s : null);
    };
    readRow();
    window.addEventListener(SEASON_EVENT, readRow);
    document.addEventListener('visibilitychange', readRow);

    const storedColorblind = localStorage.getItem('wordle-duel-colorblind');
    if (storedColorblind) setColorblindMode(storedColorblind === 'true');

    const storedMotion = localStorage.getItem('wordle-duel-reduced-motion');
    if (storedMotion) setReducedMotion(storedMotion === 'true');
    setLoaded(true);
    return () => {
      window.removeEventListener(SEASON_EVENT, readRow);
      document.removeEventListener('visibilitychange', readRow);
    };
  }, []);

  // Items 24 + 25: the Seasonal row's rules live in core (pickTheme / seasonalActive, pinned by fixtures).
  const setTheme = useCallback((picked: Theme | 'seasonal') => {
    const next = pickThemeChoice({ theme, seasonOptOut }, picked, seasonRow, localDateString());
    setThemeState(next.theme);
    setSeasonOptOut(next.seasonOptOut);
    try {
      if (next.seasonOptOut) localStorage.setItem(SEASON_OPT_OUT_KEY, next.seasonOptOut);
      else localStorage.removeItem(SEASON_OPT_OUT_KEY);
    } catch { /* storage blocked */ }
    window.dispatchEvent(new Event(SEASON_EVENT));   // season-aware art flips now
    // Synced to the account (profiles.season_opt_out, manual migration 20261009000007); a missing column is ignored.
    if (user) {
      void Promise.resolve((supabase as any).from('profiles').update({ season_opt_out: next.seasonOptOut }).eq('id', user.id)).catch(() => {});
    }
  }, [theme, seasonOptOut, seasonRow, user]);

  // Another device's choice arrives with the profile: adopt it once when this device has none.
  const remoteOptOut = (profile as { season_opt_out?: string | null } | null)?.season_opt_out ?? null;
  useEffect(() => {
    if (!loaded || !remoteOptOut || seasonOptOut) return;
    setSeasonOptOut(remoteOptOut);
    try { localStorage.setItem(SEASON_OPT_OUT_KEY, remoteOptOut); } catch { /* storage blocked */ }
    window.dispatchEvent(new Event(SEASON_EVENT));
  }, [loaded, remoteOptOut, seasonOptOut]);

  const seasonalOn = showSeasonalRow(seasonRow, true) && seasonalActive({ theme, seasonOptOut }, seasonRow, true, localDateString());

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem('wordle-duel-theme', theme);
    // Season surfaces with a dark tone (SeasonDocument, html[data-season-tone="dark"]) wear the dark
    // theme while the season shows (iOS ThemeManager parity); the stored choice is untouched.
    const seasonDark = document.documentElement.getAttribute('data-season-tone') === 'dark';
    document.documentElement.setAttribute('data-theme', seasonDark ? 'dark' : theme);
  }, [theme, loaded]);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem('wordle-duel-colorblind', String(colorblindMode));
    document.documentElement.setAttribute('data-colorblind', String(colorblindMode));
  }, [colorblindMode, loaded]);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem('wordle-duel-reduced-motion', String(reducedMotion));
    // Drive the global [data-reduced-motion] kill-switch in globals.css. (The
    // old --transition-duration var wasn't referenced anywhere, so the toggle
    // had no effect; keep setting it too in case future styles read it.)
    document.documentElement.setAttribute('data-reduced-motion', String(reducedMotion));
    if (reducedMotion) {
      document.documentElement.style.setProperty('--transition-duration', '0ms');
    } else {
      document.documentElement.style.removeProperty('--transition-duration');
    }
  }, [reducedMotion, loaded]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, seasonRow, seasonalOn, colorblindMode, setColorblindMode, reducedMotion, setReducedMotion }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}

/**
 * The theme for surfaces that can render OUTSIDE ThemeProvider (the 13+ age check sits above it in AuthGate):
 * the provider's values when there is one, else the default theme with motion on.
 */
export function useThemeOrDefault(): Pick<ThemeContextType, 'theme' | 'reducedMotion'> {
  const context = useContext(ThemeContext);
  return context ?? { theme: 'default', reducedMotion: false };
}
