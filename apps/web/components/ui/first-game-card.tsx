'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { CandyLink } from '@/components/ui/candy-button';
import { HeaderCircle } from '@/components/ui/page-header';
import { PoseArt } from '@/components/ui/soft-popup';
import { cardBarStyle, softCard } from '@/lib/soft-surface';
import { FamCloseGlyph } from '@/components/ui/family-button';

const DISMISS_KEY = 'first-game-card-dismissed';

/**
 * U2: one-time "start here" nudge for brand-new accounts — ten modes is a
 * lot to land on cold. Shown only while the account has zero recorded games
 * (profiles.total_wins + total_losses, bumped on every recorded game) and
 * until dismissed. Matches the native apps' card and gate.
 */
export function FirstGameCard() {
  const { profile } = useAuth();
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
  });

  const isNew = !!profile && ((profile.total_wins ?? 0) + (profile.total_losses ?? 0)) === 0;
  if (!isNew || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch {}
  };

  // G5: a tinted card with its top bar, O3 ready to go (A7: not the Home host
  // W, who also hosts Classic), the candy Play and the bare close X.
  return (
    <div
      className="relative px-3 pt-3.5 pb-2.5 pr-8 flex items-center gap-3 overflow-hidden"
      style={{ ...softCard('#7c3aed', { radius: 18 }), overflow: 'hidden' }}
    >
      <div aria-hidden="true" className="absolute left-0 right-0 top-0" style={cardBarStyle('#7c3aed', 6)} />
      <PoseArt pose="art-pose-o3-ready" size={44} />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-black" style={{ color: 'var(--color-text)' }}>
          New here? Start with Classic
        </div>
        <div className="text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
          The original 5-letter challenge — a fresh puzzle every day.{' '}
          <Link href="/how-to-play" className="underline" style={{ color: 'var(--color-win-text, #7c3aed)' }}>
            How to play
          </Link>
        </div>
      </div>
      <CandyLink href="/practice?daily=true" color="purple" size="sm" icon="play" className="flex-shrink-0">
        Play
      </CandyLink>
      <HeaderCircle label="Dismiss" onClick={dismiss} size={28} className="absolute top-1.5 right-0.5">
        <FamCloseGlyph size={18} />
      </HeaderCircle>
    </div>
  );
}
