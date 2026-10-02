'use client';

import { useEffect } from 'react';
import { scheduleFeedback } from '@/lib/sound-events';
import { REVEAL } from '@/lib/tile-motion';

// FINISH_SPEC U: a revealing tile's sound + haptic, timed to its turn — `flip`
// (+ selection tick) as tile `index` turns over (REVEAL.stagger apart), and on
// the winning row the light "land" haptic once the last tile has landed.
// Rendered by LetterTile only while it flips (so it plays once per reveal);
// renders nothing. Simultaneous flips on several boards collapse into one.
export function RevealFeedback({ index, landAfterTiles }: { index: number; landAfterTiles?: number }) {
  useEffect(() => {
    const cancelFlip = scheduleFeedback('flip', index * REVEAL.stagger);
    const cancelLand = landAfterTiles != null ? scheduleFeedback('rowLand', REVEAL.end(landAfterTiles)) : null;
    return () => { cancelFlip(); cancelLand?.(); };
  }, [index, landAfterTiles]);
  return null;
}
