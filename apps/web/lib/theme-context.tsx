'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Theme = 'default' | 'ocean' | 'forest' | 'dark';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  colorblindMode: boolean;
  setColorblindMode: (enabled: boolean) => void;
  reducedMotion: boolean;
  setReducedMotion: (enabled: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('default');
  const [colorblindMode, setColorblindMode] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  // Don't write the defaults back before the stored values are read: under React
  // StrictMode (dev) the write-back effects ran first and the remount then read
  // 'default', so a saved Dark theme never applied locally.
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('wordle-duel-theme');
    if (stored) setTheme(stored as Theme);

    const storedColorblind = localStorage.getItem('wordle-duel-colorblind');
    if (storedColorblind) setColorblindMode(storedColorblind === 'true');

    const storedMotion = localStorage.getItem('wordle-duel-reduced-motion');
    if (storedMotion) setReducedMotion(storedMotion === 'true');
    setLoaded(true);
  }, []);

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
    <ThemeContext.Provider value={{ theme, setTheme, colorblindMode, setColorblindMode, reducedMotion, setReducedMotion }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
