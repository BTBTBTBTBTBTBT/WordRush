'use client';

import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { usePresenceId } from '@/lib/presence-id';

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

  useEffect(() => {
    // Wait until we have an id — on SSR / first paint we skip, and on
    // sign-in/out the id changes and this effect re-runs with a fresh
    // socket tagged with the new id.
    if (!presenceId) return;

    const socket = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      // Server dedupes /presence by this id — see apps/server/src/index.ts.
      auth: { presenceId },
    });
    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [presenceId]);

  return <>{children}</>;
}
