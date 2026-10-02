'use client';

import { useEffect, useState } from 'react';
import { MOTION } from '@/lib/motion-tokens';
import { prefersReducedMotion } from '@/lib/motion';

// FINISH_SPEC AZ: matching exits — a popup that closes keeps rendering for
// MOTION.exitMs with `leaving` set (globals.css `.motion-leaving` plays the
// shared exit), instead of vanishing in one frame. Reduce Motion: at once.
export function useExit(open: boolean, ms: number = MOTION.exitMs): { shown: boolean; leaving: boolean } {
  const [shown, setShown] = useState(open);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    if (open) { setShown(true); setLeaving(false); return; }
    if (!shown) return;
    if (prefersReducedMotion()) { setShown(false); return; }
    setLeaving(true);
    const t = setTimeout(() => { setShown(false); setLeaving(false); }, ms);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  return { shown: open || shown, leaving: !open && leaving };
}
