'use client';

import type { ReactNode } from 'react';
import { useCountdown } from '@/hooks/use-countdown';
import { getSecondsUntilMidnightLocal } from '@/lib/daily-service';

// The Home countdown to local midnight (HH:MM:SS), as a LEAF: only the text
// that shows the clock re-renders every second, not the whole Home page (the
// page used to hold the clock, so every card, grid and section re-rendered
// once a second — a main-thread hitch under the scroll and the cast moves).

/** HH:MM:SS from seconds. */
export function hms(secs: number | null): string {
  if (secs === null) return '--:--:--';
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), x = secs % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}`;
}

/** Renders `render(clock)` with the live clock; re-renders itself only. */
export function HomeClock({ render }: { render: (clock: string) => ReactNode }) {
  const clock = hms(useCountdown(getSecondsUntilMidnightLocal));
  return <>{render(clock)}</>;
}
