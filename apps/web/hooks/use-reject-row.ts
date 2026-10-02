'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { REVEAL } from '@/lib/tile-motion';

// FINISH_SPEC AQ1: a not-a-word reject never blocks typing. `reject(tiles)`
// shows the red row and clears it after REVEAL.rejectMs; a key pressed while
// it runs calls `cutShort()`, which clears the row at once so the key lands in
// a fresh row (see keyDuringReject in lib/tile-motion.ts).
export function useRejectRow(clearRow: () => void) {
  const [isShaking, setIsShaking] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearRef = useRef(clearRow);
  clearRef.current = clearRow;

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const reject = useCallback((tiles: number) => {
    if (timer.current) clearTimeout(timer.current);
    setIsShaking(true);
    timer.current = setTimeout(() => {
      timer.current = null;
      clearRef.current();
      setIsShaking(false);
    }, REVEAL.rejectMs(tiles));
  }, []);

  /** End a running reject now (clears the row). */
  const cutShort = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    clearRef.current();
    setIsShaking(false);
  }, []);

  return { isShaking, reject, cutShort };
}
