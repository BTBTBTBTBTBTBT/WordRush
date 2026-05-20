/**
 * Shared countdown hook that uses a single setInterval for all subscribers.
 *
 * Previously the home page ran 3 separate setInterval(1000) timers for
 * different countdown displays, causing 3x per-second React re-renders.
 * This module uses one global timer and notifies all mounted hooks via
 * a Set of callbacks — a single re-render per component per tick.
 */

import { useState, useEffect, useRef } from 'react';

type Listener = () => void;

const listeners = new Set<Listener>();
let intervalId: ReturnType<typeof setInterval> | null = null;

function startGlobalTimer() {
  if (intervalId !== null) return;
  intervalId = setInterval(() => {
    listeners.forEach(fn => fn());
  }, 1000);
}

function stopGlobalTimer() {
  if (intervalId === null) return;
  clearInterval(intervalId);
  intervalId = null;
}

/**
 * Returns the current value of `getSeconds()`, updated once per second
 * via a shared global timer. Multiple calls to this hook share one
 * setInterval — no matter how many countdown displays are on screen.
 */
export function useCountdown(getSeconds: () => number): number | null {
  const [secs, setSecs] = useState<number | null>(null);
  const getSecondsRef = useRef(getSeconds);
  getSecondsRef.current = getSeconds;

  useEffect(() => {
    // Initial read
    setSecs(getSecondsRef.current());

    const listener = () => setSecs(getSecondsRef.current());
    listeners.add(listener);
    startGlobalTimer();

    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) stopGlobalTimer();
    };
  }, []);

  return secs;
}
