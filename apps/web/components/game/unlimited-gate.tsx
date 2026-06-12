'use client';

import Link from 'next/link';
import { Crown, Home } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

/**
 * Pro gate for non-daily (unlimited) play. The game routes (/quordle, /six,
 * …) take any seed when `?daily=true` is absent, and share pages link
 * straight to them — so without this gate any free user with the URL got
 * unlimited fresh puzzles, while the home cards (and both native apps)
 * enforce one daily per mode. Daily play passes through untouched.
 */
export function UnlimitedGate({ isDaily, modeSlug, children }: {
  isDaily: boolean;
  /** Route slug used to send the player to today's daily instead. */
  modeSlug: string;
  children: React.ReactNode;
}) {
  const { loading, isProActive } = useAuth();

  if (isDaily || isProActive) return <>{children}</>;
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg)' }}>
        <div className="text-lg font-black animate-pulse" style={{ color: 'var(--color-text)' }}>Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div
        className="w-full max-w-sm text-center p-6 space-y-4"
        style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '20px' }}
      >
        <div
          className="mx-auto w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
        >
          <Crown className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-xl font-black" style={{ color: 'var(--color-text)' }}>
          Unlimited play is a Pro perk
        </h1>
        <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
          Free players get a fresh daily puzzle in every mode. Go Pro for
          unlimited replays, no ads, and rematches.
        </p>
        <div className="space-y-2">
          <Link
            href="/pro"
            className="block w-full py-3 rounded-xl font-black text-white text-sm"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #ec4899)' }}
          >
            Go Pro
          </Link>
          <Link
            href={`/${modeSlug}?daily=true`}
            className="block w-full py-3 rounded-xl font-bold text-sm"
            style={{ background: 'var(--color-surface-alt)', color: 'var(--color-text)', border: '1.5px solid var(--color-border)' }}
          >
            Play today&apos;s daily
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 justify-center w-full py-2 text-xs font-bold"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <Home className="w-3.5 h-3.5" /> Home
          </Link>
        </div>
      </div>
    </div>
  );
}
