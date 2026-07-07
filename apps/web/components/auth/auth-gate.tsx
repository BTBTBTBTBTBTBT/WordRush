'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { usePathname } from 'next/navigation';
import { Landing } from './landing';
import { ensureDictionaryInitialized } from '@/lib/init-dictionary';

// Public (no login) so AdSense / search crawlers can index real content —
// not just the login wall. These are static content pages.
const PUBLIC_PATHS = ['/privacy', '/terms', '/support', '/auth/callback', '/how-to-play', '/about', '/faq', '/guides', '/pro', '/word', '/strategy'];

/**
 * Returning-user heuristic: a persisted Supabase session token (`sb-*-auth-token`)
 * or a prior "Play without an account" choice in localStorage means we can render
 * the app shell immediately while auth resolves in the background — so returning
 * users land straight on the menu instead of watching the skeleton. Mirrors the
 * native optimistic home render (AuthService.hadPersistedSession).
 */
function hasPersistedSession(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (localStorage.getItem('wordocious-guest') === '1') return true;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('sb-') && k.endsWith('-auth-token')) return true;
    }
  } catch {}
  return false;
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading, isGuest } = useAuth();
  const pathname = usePathname();
  // Gate the localStorage read behind mount so server + first client render
  // agree (both skeleton) — avoids a hydration mismatch. After mount, returning
  // users swap to the app within a frame, long before auth actually resolves.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    ensureDictionaryInitialized();
  }, []);

  // Let public pages through without auth
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return <>{children}</>;
  }

  // While auth resolves: returning users (persisted session/guest) skip the
  // skeleton and get the real app immediately; everyone else sees the
  // layout-matched skeleton until we know who they are.
  if (loading) {
    if (mounted && hasPersistedSession()) {
      return <>{children}</>;
    }
    // On the homepage, the pre-auth render is the public Landing, not the
    // skeleton — it's what a signed-out visitor lands on anyway, and it's the
    // only render crawlers index (AdSense rejected the site as "low value
    // content" because the served HTML was a 7-word skeleton). The static
    // #app-loader overlay covers this until hydration, so signed-in users
    // never see it flash. Depends only on pathname → no hydration mismatch.
    if (pathname === '/') {
      return <Landing />;
    }
    return (
      <div
        className="fixed inset-0 flex flex-col"
        style={{ backgroundColor: 'var(--color-bg)' }}
      >
        {/* Mimic AppHeader height so content doesn't shift */}
        <div
          className="flex items-center justify-center px-4"
          style={{
            height: '52px',
            borderBottom: '1.5px solid var(--color-border)',
            background: 'var(--color-surface)',
          }}
        >
          <h1
            className="text-base font-black tracking-tight"
            style={{
              background: 'linear-gradient(135deg, #7c3aed, #ec4899)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            WORDOCIOUS
          </h1>
        </div>
        {/* Skeleton placeholders that match the home page layout */}
        <div className="px-4 pt-2 space-y-2 animate-pulse" style={{ opacity: 0.4 }}>
          {/* Hero banner skeleton */}
          <div style={{ height: '68px', background: 'var(--color-border)', borderRadius: '14px' }} />
          {/* Section header skeleton */}
          <div style={{ height: '14px', width: '100px', background: 'var(--color-border)', borderRadius: '6px', marginTop: '12px' }} />
          {/* Game mode cards skeleton - 2x2 grid */}
          <div className="grid grid-cols-2 gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} style={{ height: '88px', background: 'var(--color-border)', borderRadius: '14px' }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Not authenticated and not a guest — show the public marketing landing
  // (content-rich, with a "Sign in to play" CTA that reveals the login form).
  // Gives crawlers/AdSense real content instead of a bare login wall.
  if (!user && !isGuest) {
    return <Landing />;
  }

  // Authenticated, or a guest playing the daily without an account — render app.
  // (Account surfaces — leaderboard, VS, profile, records, unlimited, Pro — gate
  // themselves on `user` and prompt a guest to sign in.)
  return <>{children}</>;
}
