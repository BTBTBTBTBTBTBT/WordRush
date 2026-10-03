'use client';

import { useEffect, useState } from 'react';
import { prefersReducedMotion } from '@/lib/motion';

// FINISH_SPEC BI5: a live finish's result popup waits until the finished board's
// last row has revealed (and a win's hop wave has played) plus a short beat —
// REVEAL.finishHoldMs (iOS RevealTiming.finishHold / Android
// TileMotion.finishHoldMs parity). True once `on` has held for `ms` (at once under
// Reduce Motion); false again when `on` drops.
export function useFinishHold(on: boolean, ms: number): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!on) { setReady(false); return; }
    if (ms <= 0 || prefersReducedMotion()) { setReady(true); return; }
    const t = setTimeout(() => setReady(true), ms);
    return () => clearTimeout(t);
  }, [on, ms]);
  return on && ready;
}
