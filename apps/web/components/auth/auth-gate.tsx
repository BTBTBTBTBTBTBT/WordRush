'use client';

import { useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { usePathname } from 'next/navigation';
import { Landing } from './landing';
import { ensureDictionaryInitialized } from '@/lib/init-dictionary';

// Public (no login) so AdSense / search crawlers can index real content —
// not just the login wall. These are static content pages.
const PUBLIC_PATHS = ['/privacy', '/terms', '/support', '/auth/callback', '/how-to-play', '/about', '/faq'];

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    ensureDictionaryInitialized();
  }, []);

  // Let public pages through without auth
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return <>{children}</>;
  }

  // Seamless loading screen — matches the real app layout so the
  // transition from loading → authenticated is invisible.
  if (loading) {
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

  // Not authenticated — show the public marketing landing (content-rich, with a
  // "Sign in to play" CTA that reveals the login form). Gives crawlers/AdSense
  // real content instead of a bare login wall.
  if (!user) {
    return <Landing />;
  }

  // Authenticated — render app
  return <>{children}</>;
}
