'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import type { Socket } from 'socket.io-client';
import { usePresenceId } from '@/lib/presence-id';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase-client';
import { activityKeyForPath } from '@/lib/friends-play';

/** Friends "On now" heartbeat cadence (spec docs/FRIENDS_REDESIGN_SPEC.md §1). */
const HEARTBEAT_MS = 60_000;

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3001';

/**
 * Opens a lightweight Socket.IO connection for the lifetime of the tab so
 * every visitor — home, daily, profile, records, anywhere — is included in
 * the server's engine.io clientsCount. That count is what /presence returns
 * and what the home LIVE banner renders.
 *
 * Mounted at the root layout level so the socket survives client-side
 * navigation between routes (React keeps the provider instance alive; only
 * `children` rerenders on route change). The connection closes naturally
 * when the tab closes.
 *
 * VS match pages open their own Socket.IO connection via SocketIOMatchService,
 * which means a player actively in matchmaking/VS temporarily holds two
 * sockets. engine.io counts each separately; the small distortion is
 * acceptable since presence is a rough activity signal, not a unique-user
 * count.
 */
export function SitePresenceProvider({ children }: { children: React.ReactNode }) {
  const presenceId = usePresenceId();
  useFriendsHeartbeat();

  useEffect(() => {
    // Wait until we have an id — on SSR / first paint we skip, and on
    // sign-in/out the id changes and this effect re-runs with a fresh
    // socket tagged with the new id.
    if (!presenceId) return;

    // Defer the socket connection by 3 seconds so it doesn't compete
    // with the initial page load's critical network requests (auth,
    // profile fetch, daily completions). Presence is a background signal
    // — a few-second delay is invisible to the user.
    // socket.io-client loads with it, never in the page's first-load JS (founder, 2026-09-29).
    let socket: Socket | null = null;
    let cancelled = false;
    const timer = setTimeout(() => {
      import('socket.io-client').then(({ io }) => {
        if (cancelled) return;
        socket = io(SERVER_URL, {
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionDelay: 2000,
          reconnectionDelayMax: 10000,
          // Server dedupes /presence by this id — see apps/server/src/index.ts.
          auth: { presenceId },
        });
      }).catch(() => {});
    }, 3000);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (socket) {
        socket.removeAllListeners();
        socket.disconnect();
      }
    };
  }, [presenceId]);

  return <>{children}</>;
}

/**
 * Friends overhaul §1 ("On now"): while the tab is visible and someone is
 * signed in, stamp profiles.last_seen_at every 60 s with last_activity = the db
 * key of the game route on screen (or null). It also beats at once when the
 * player enters or leaves a game, and when the tab comes back into view.
 * Fire and forget: presence must never get in the way of play.
 */
function useFriendsHeartbeat() {
  const { user } = useAuth();
  const pathname = usePathname();
  const activity = activityKeyForPath(pathname);
  const activityRef = useRef<string | null>(activity);
  const beatRef = useRef<() => void>(() => {});
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!userId) { beatRef.current = () => {}; return; }
    const beat = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      (supabase as any)
        .from('profiles')
        .update({ last_seen_at: new Date().toISOString(), last_activity: activityRef.current })
        .eq('id', userId)
        .then(() => {}, () => {});
    };
    beatRef.current = beat;
    beat();
    const timer = setInterval(beat, HEARTBEAT_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') beat(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      beatRef.current = () => {};
    };
  }, [userId]);

  // Entering or leaving a game updates the line at once, not a minute later.
  useEffect(() => {
    if (activityRef.current === activity) return;
    activityRef.current = activity;
    beatRef.current();
  }, [activity]);
}
