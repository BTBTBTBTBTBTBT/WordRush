'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

// Shared "guide sheet is open" signal — the in-game "?" guide pauses the clock
// while it's open (reading shouldn't count). Set by GameGuideButton; every
// active-play timer reads it and treats guide-open like a backgrounded tab.
let guidePaused = false;
const guideListeners = new Set<() => void>();
export function setGuidePaused(open: boolean) {
  if (guidePaused === open) return;
  guidePaused = open;
  guideListeners.forEach((l) => l());
}
function subscribeGuide(cb: () => void) {
  guideListeners.add(cb);
  return () => { guideListeners.delete(cb); };
}

/**
 * Counts only active-play time for a solo game. Pauses on tab hide /
 * pagehide (so backgrounding the tab, switching apps, locking the phone,
 * or navigating to another site no longer counts toward the game clock)
 * and resumes on visibility return. Returns elapsed seconds; the hook
 * also exposes `reset(toSeconds)` for restart handlers.
 *
 * The old pattern stored a single `startTimeRef = Date.now() - saved*1000`
 * and computed `Date.now() - startTimeRef` on every tick. That quietly
 * counted every away-from-screen minute as play time (Octoword games
 * showing 148 min when the player had been elsewhere for two hours).
 * The accumulator-based pattern here only advances while the page is
 * visible.
 */
export function useActivePlayTimer(
  isPlaying: boolean,
  initialSeconds: number = 0,
): { elapsedSeconds: number; reset: (toSeconds?: number) => void } {
  const [elapsedSeconds, setElapsedSeconds] = useState(initialSeconds);
  const accumulatedMs = useRef(initialSeconds * 1000);
  const resumeAtMs = useRef<number | null>(null);
  // The in-game guide pauses the clock while open — fold it into the "playing"
  // condition so the existing pause/resume machinery handles it for free.
  const guideOpen = useSyncExternalStore(subscribeGuide, () => guidePaused, () => false);
  const active = isPlaying && !guideOpen;

  const flush = useCallback(() => {
    if (resumeAtMs.current !== null) {
      accumulatedMs.current += Date.now() - resumeAtMs.current;
      resumeAtMs.current = null;
      setElapsedSeconds(Math.floor(accumulatedMs.current / 1000));
    }
  }, []);

  const reset = useCallback(
    (toSeconds: number = 0) => {
      accumulatedMs.current = toSeconds * 1000;
      resumeAtMs.current = active && typeof document !== 'undefined' && document.visibilityState === 'visible'
        ? Date.now()
        : null;
      setElapsedSeconds(toSeconds);
    },
    [active],
  );

  useEffect(() => {
    if (!active) {
      flush();
      return;
    }

    if (typeof document !== 'undefined' && document.visibilityState === 'visible' && resumeAtMs.current === null) {
      resumeAtMs.current = Date.now();
    }

    const tick = () => {
      if (resumeAtMs.current === null) return;
      const totalMs = accumulatedMs.current + (Date.now() - resumeAtMs.current);
      setElapsedSeconds(Math.floor(totalMs / 1000));
    };
    const interval = setInterval(tick, 1000);

    const pause = () => flush();
    const resume = () => {
      if (resumeAtMs.current === null && active) {
        resumeAtMs.current = Date.now();
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') pause();
      else resume();
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', pause);
    window.addEventListener('pageshow', resume);
    window.addEventListener('blur', pause);
    window.addEventListener('focus', resume);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', pause);
      window.removeEventListener('pageshow', resume);
      window.removeEventListener('blur', pause);
      window.removeEventListener('focus', resume);
      flush();
    };
  }, [active, flush]);

  return { elapsedSeconds, reset };
}
