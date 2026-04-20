'use client';

import { useEffect } from 'react';
import { io } from 'socket.io-client';

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
  useEffect(() => {
    const socket = io(SERVER_URL, {
      // WebSocket first, fall back to long-polling if the edge blocks WS.
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
    });
    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, []);

  return <>{children}</>;
}
