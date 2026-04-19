'use client';

import { useEffect, useState } from 'react';

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3001';
const POLL_INTERVAL_MS = 10_000;

/**
 * Polls the matchmaking server's /presence endpoint for the number of
 * currently connected Socket.IO clients. Drives the "N players online"
 * label on the home LIVE banner.
 *
 * Returns null until the first successful fetch so callers can render a
 * placeholder without flashing a stale zero. Any error keeps the last
 * known value (also null if we've never succeeded) — a flaky server
 * shouldn't make the banner blink.
 */
export function useLivePlayerCount(): number | null {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(`${SERVER_URL}/presence`, { cache: 'no-store' });
        if (!res.ok) return;
        const body = await res.json();
        if (!cancelled && typeof body.online === 'number') {
          setCount(body.online);
        }
      } catch {
        // Offline / server down / CORS — swallow; the banner keeps
        // showing the last known value.
      }
    };

    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return count;
}
