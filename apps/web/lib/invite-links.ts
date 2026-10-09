import type { InviteVariant } from '@wordle-duel/core';

/** Where "Accept" goes on the web: the existing flows keep doing the actual joining. */
export function acceptHrefFor(p: { variant: InviteVariant; code: string }): string {
  switch (p.variant) {
    case 'live': return `/vs/join/${p.code}`;
    case 'race': return `/vs/challenge/${p.code}`;
    case 'friend': return `/join/${p.code}`;
  }
}

/**
 * The link a sender shares. Branded (isLive('branded_invites')): ONE wordocious.com/vs/<CODE> link whose
 * preview is the per-invite image. Off: today's /vs/join/<CODE> or /vs/challenge/<CODE>.
 */
export function shareUrlFor(branded: boolean, variant: 'live' | 'race', code: string, origin = 'https://wordocious.com'): string {
  if (branded) return `https://wordocious.com/vs/${code}`;
  return `${origin}${variant === 'race' ? '/vs/challenge/' : '/vs/join/'}${code}`;
}
