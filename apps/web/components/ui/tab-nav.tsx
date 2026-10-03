'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Icon3DName } from '@/components/ui/icon3d';
import { CandyButton } from '@/components/ui/candy-button';
import { popupCard, PopupBar } from '@/components/ui/soft-popup';
import { prefersReducedMotion } from '@/lib/motion';
import { closeAllOverlays, leaveGuard, setLeaveGuard, tabTapAction } from '@/lib/nav-home';

// The four tabs (D1 of the Stats + Friends redesign) and their tap rules,
// shared by the docked bottom bar (components/ui/bottom-nav.tsx, phones and
// game screens) and the desktop top bar's candy pill tabs
// (components/ui/desktop-tabs.tsx), so both rows behave identically.

export const NAV_ITEMS: { href: string; label: string; icon: Icon3DName }[] = [
  { href: '/', label: 'Home', icon: 'tab-home' },
  { href: '/daily', label: 'Leaderboard', icon: 'tab-leaderboard' },
  { href: '/stats', label: 'Stats', icon: 'tab-stats' },
  { href: '/friends', label: 'Friends', icon: 'tab-friends' },
];

/** The bar's tint follows the page (A4): Leaderboard + Records warm, Stats blue, Friends pink, the rest lilac. */
export function tabTint(pathname: string | null): 'home' | 'leaderboard' | 'stats' | 'friends' {
  const p = pathname ?? '/';
  if (p.startsWith('/daily') || p.startsWith('/records')) return 'leaderboard';
  if (p.startsWith('/stats') || p.startsWith('/profile')) return 'stats';
  if (p.startsWith('/friends')) return 'friends';
  return 'home';
}

/**
 * FINISH_SPEC AJ: a tab tap from ANY depth lands on that tab's root at the top
 * and closes every overlay; the one exception (a live VS match) asks first.
 * Returns the click handler and the "Leave the match?" confirm to render.
 */
export function useTabTap(): { onTabTap: (e: React.MouseEvent, href: string) => void; confirm: React.ReactNode } {
  const pathname = usePathname();
  const router = useRouter();
  const [confirmHref, setConfirmHref] = useState<string | null>(null);
  const onTabTap = (e: React.MouseEvent, href: string) => {
    const action = tabTapAction({ pathname: pathname ?? '/', search: typeof window !== 'undefined' ? window.location.search : '', href, guarded: !!leaveGuard() });
    if (action === 'confirm') { e.preventDefault(); setConfirmHref(href); return; }
    closeAllOverlays();
    if (action === 'scrollTop') {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    }
  };
  const confirm = confirmHref ? (
    // AJ: leaving a live VS match counts as a forfeit, so ask (never silently forfeit).
    <div className="fixed inset-0 z-[95] flex items-end sm:items-center justify-center p-4" style={{ background: 'rgba(30, 15, 60, 0.45)' }} onClick={() => setConfirmHref(null)}>
      <div role="alertdialog" aria-modal="true" aria-label="Leave the match?" className="relative w-full max-w-xs text-center" style={popupCard('#0d9488', { radius: 22 })} onClick={(e) => e.stopPropagation()}>
        <PopupBar accent="#0d9488" />
        <div className="px-4 pt-3 pb-4">
          <p className="m-0 text-[15px] font-black" style={{ color: 'var(--color-text)' }}>{leaveGuard() ?? 'Leave the match? It counts as a forfeit.'}</p>
          <div className="mt-3 flex justify-center gap-2">
            <CandyButton color="teal" size="md" onClick={() => setConfirmHref(null)}>Stay</CandyButton>
            <CandyButton color="peach" size="md" onClick={() => { const href = confirmHref; setConfirmHref(null); setLeaveGuard(null); closeAllOverlays(); router.push(href); }}>Leave</CandyButton>
          </div>
        </div>
      </div>
    </div>
  ) : null;
  return { onTabTap, confirm };
}
