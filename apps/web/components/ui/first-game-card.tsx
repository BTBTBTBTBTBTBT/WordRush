'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Sparkles, Play, X as XIcon } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

const DISMISS_KEY = 'first-game-card-dismissed';

/**
 * U2: one-time "start here" nudge for brand-new accounts — ten modes is a
 * lot to land on cold. Shown only while the account has zero games
 * (xp === 0 && level <= 1 proxy — flips off after the first recorded game)
 * and until dismissed. Matches the native apps' card.
 */
export function FirstGameCard() {
  const { profile } = useAuth();
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
  });

  const isNew = !!profile && (profile.xp ?? 0) === 0 && (profile.level ?? 1) <= 1;
  if (!isNew || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch {}
  };

  return (
    <div
      className="relative px-3 py-2.5 flex items-center gap-3"
      style={{
        background: 'var(--color-surface)',
        border: '1.5px solid var(--color-border)',
        borderRadius: '16px',
      }}
    >
      <span
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: '#7c3aed15' }}
      >
        <Sparkles className="w-4 h-4" style={{ color: '#7c3aed' }} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-black" style={{ color: 'var(--color-text)' }}>
          New here? Start with Classic
        </div>
        <div className="text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
          The original 5-letter challenge — a fresh puzzle every day.{' '}
          <Link href="/how-to-play" className="underline" style={{ color: '#7c3aed' }}>
            How to play
          </Link>
        </div>
      </div>
      <Link
        href="/practice?daily=true"
        className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-white font-black text-xs flex-shrink-0 active:scale-95 transition-transform"
        style={{ background: '#7c3aed' }}
      >
        <Play className="w-3 h-3" fill="currentColor" />
        Play
      </Link>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
        style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)' }}
      >
        <XIcon className="w-3 h-3" style={{ color: 'var(--color-text-muted)' }} />
      </button>
    </div>
  );
}
