'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useDesktopStage } from '@/hooks/use-desktop-stage';

// The wide game stage (GameBackground `wide`, globals.css `.page-col.game-wide`) is opt-in
// per screen. GameBackground wraps its children in this provider when it opts in, so shared
// pieces (FinishedScreen) can lay out two columns ONLY under a stage that has the grid for it.
const WideStageContext = createContext(false);

export function WideStageProvider({ children }: { children: ReactNode }) {
  return <WideStageContext.Provider value={true}>{children}</WideStageContext.Provider>;
}

/** True when the nearest game root opted in to the wide stage. */
export function useWideStage(): boolean {
  return useContext(WideStageContext);
}

/** True on the desktop tier AND under a wide game root: the two-column finished layout applies. */
export function useDeskFinished(): boolean {
  const wide = useContext(WideStageContext);
  const desk = useDesktopStage();
  return wide && desk;
}

/** The wide desktop stage while PLAYING (same test as useDeskFinished): a big board with the controls in a right rail. */
export function useDeskWide(): boolean {
  return useDeskFinished();
}
