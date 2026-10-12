'use client';

import { useSyncExternalStore } from 'react';
import { DESKTOP_MIN, minWidthQuery } from '@/lib/desktop-layout';

/**
 * True on the desktop website tier (viewport ≥ 1024 px, lib/desktop-layout.ts).
 * Server render and the first client render say false (the phone layout), then
 * it follows the window — so a hydrating finished screen never mismatches.
 */
export function useDesktopStage(): boolean {
  return useSyncExternalStore(
    (notify) => {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
      const mq = window.matchMedia(minWidthQuery(DESKTOP_MIN));
      mq.addEventListener('change', notify);
      return () => mq.removeEventListener('change', notify);
    },
    () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(minWidthQuery(DESKTOP_MIN)).matches,
    () => false,
  );
}
