'use client';

import { useSyncExternalStore, type ReactNode } from 'react';
import type { PlayTimer } from '@/hooks/use-active-play-timer';

/**
 * The ticking part of a game screen (founder, 2026-09-29): subscribes to a
 * `useActivePlayTimer(…, { tick: false })` timer so only this node re-renders
 * each second, not the board around it.
 */
export function PlayClock({ timer, children }: { timer: Pick<PlayTimer, 'subscribe' | 'getSnapshot'>; children: (seconds: number) => ReactNode }) {
  const seconds = useSyncExternalStore(timer.subscribe, timer.getSnapshot, timer.getSnapshot);
  return <>{children(seconds)}</>;
}
