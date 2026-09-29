'use client';

import { useCallback, useEffect, useRef, type DependencyList } from 'react';

/**
 * Local save for a More Games session (founder, 2026-09-29). The save effects
 * used to depend on the ticking clock, so every game JSON-stringified its whole
 * state into localStorage once a second. Now: save at once when `deps` change
 * (a move, a restore, a new puzzle), and for clock-only progress at most every
 * 10 s, plus when the page is hidden or unloaded and when the game unmounts.
 * `save` is null while nothing may be written (no state yet, or the
 * other-device check is holding the board); it receives the live elapsed time.
 */
export function useThrottledSave(save: ((elapsedSeconds: number) => void) | null, getElapsed: () => number, deps: DependencyList) {
  const saveRef = useRef(save);
  saveRef.current = save;
  const lastRef = useRef<number | null>(null);
  const run = useCallback((force: boolean) => {
    const f = saveRef.current;
    if (!f) return;
    const e = getElapsed();
    if (!force && e === lastRef.current) return;
    lastRef.current = e;
    f(e);
  }, [getElapsed]);

  useEffect(() => { run(true); }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const id = setInterval(() => run(false), 10_000);
    const onVisibility = () => { if (document.visibilityState === 'hidden') run(false); };
    const onPageHide = () => run(false);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      run(false);
    };
  }, [run]);
}
