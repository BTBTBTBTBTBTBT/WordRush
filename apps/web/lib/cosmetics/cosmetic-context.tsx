'use client';

import { createContext, useContext, useMemo } from 'react';
import { useAuth } from '../auth-context';
import { getEquippedCosmetics } from './cosmetic-service';
import { getTileTheme, TileThemeConfig } from './tile-themes';

interface CosmeticContextType {
  tileTheme: TileThemeConfig;
  tileThemeId?: string;
  keyboardSkinId?: string;
  victoryAnimationId?: string;
}

const CosmeticContext = createContext<CosmeticContextType>({
  tileTheme: getTileTheme(),
});

export function CosmeticProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();

  const value = useMemo(() => {
    const equipped = getEquippedCosmetics(profile);
    return {
      tileTheme: getTileTheme(equipped.tile_theme),
      tileThemeId: equipped.tile_theme,
      keyboardSkinId: equipped.keyboard_skin,
      victoryAnimationId: equipped.victory_animation,
    };
  }, [profile]);

  return (
    <CosmeticContext.Provider value={value}>
      {children}
    </CosmeticContext.Provider>
  );
}

export function useCosmetics() {
  return useContext(CosmeticContext);
}
