'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Theme = 'default' | 'ocean' | 'forest';

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

  useEffect(() => {
    const stored = localStorage.getItem('wordle-duel-theme');
    if (stored) setTheme(stored as Theme);

    const storedColorblind = localStorage.getItem('wordle-duel-colorblind');
    if (storedColorblind) setColorblindMode(storedColorblind === 'true');

    const storedMotion = localStorage.getItem('wordle-duel-reduced-motion');
    if (storedMotion) setReducedMotion(storedMotion === 'true');
  }, []);

  useEffect(() => {
    localStorage.setItem('wordle-duel-theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('wordle-duel-colorblind', String(colorblindMode));
    document.documentElement.setAttribute('data-colorblind', String(colorblindMode));
  }, [colorblindMode]);

  useEffect(() => {
    localStorage.setItem('wordle-duel-reduced-motion', String(reducedMotion));
    if (reducedMotion) {
      document.documentElement.style.setProperty('--transition-duration', '0ms');
    } else {
      document.documentElement.style.removeProperty('--transition-duration');
    }
  }, [reducedMotion]);

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
