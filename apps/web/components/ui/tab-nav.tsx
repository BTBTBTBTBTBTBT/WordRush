'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { Icon3DName } from '@/components/ui/icon3d';
import { CandyButton } from '@/components/ui/candy-button';
import { popupCard, PopupBar } from '@/components/ui/soft-popup';
import { prefersReducedMotion } from '@/lib/motion';
import { TAB_SCROLL_TOP_EVENT, closeAllOverlays, isTabRoot, leaveGuard, rememberTabScroll, rememberedTabScroll, setLeaveGuard, tabTapAction } from '@/lib/nav-home';

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
      // BI11: the re-tap is the ONE thing that sends a tab to the top (Home scrolls an
      // inner column, which listens for this).
      rememberTabScroll(href, 0);
      window.dispatchEvent(new CustomEvent(TAB_SCROLL_TOP_EVENT, { detail: href }));
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

/**
 * FINISH_SPEC BI11: keep a tab root's scroll position across tab switches and
 * game round trips. Restores where the player left `pathname` (retrying for up to
 * ~1 s while its rows load; a touch or wheel stops it), remembers it as they
 * scroll, and scrolls to the top on a re-tap (`TAB_SCROLL_TOP_EVENT`). `scroller`
 * = the tab's own scrolling column (Home); omitted = the window (the other tabs —
 * their footer links pass `scroll={false}` so Next.js doesn't jump to the top).
 */
export function useTabScrollMemory(pathname: string | null, scroller?: React.RefObject<HTMLElement | null>): void {
  useEffect(() => {
    if (!pathname || !isTabRoot(pathname)) return;
    const el = scroller ? scroller.current : null;
    if (scroller && !el) return;
    const getY = () => (el ? el.scrollTop : window.scrollY);
    const setY = (y: number) => { if (el) el.scrollTop = y; else window.scrollTo(0, y); };
    const target = rememberedTabScroll(pathname);
    let restoring = true;
    let tries = 0;
    let raf = 0;
    const restore = () => {
      if (!restoring) return;
      setY(target);
      if (Math.abs(getY() - target) > 1 && tries++ < 60) raf = requestAnimationFrame(restore);
      else restoring = false;
    };
    restore();
    const stop = () => { restoring = false; cancelAnimationFrame(raf); };
    const onScroll = () => { if (!restoring) rememberTabScroll(pathname, getY()); };
    const onTop = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== pathname) return;
      stop();
      if (el) el.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    };
    const target$ = el ?? window;
    target$.addEventListener('scroll', onScroll, { passive: true });
    target$.addEventListener('touchstart', stop, { passive: true });
    target$.addEventListener('wheel', stop, { passive: true });
    window.addEventListener(TAB_SCROLL_TOP_EVENT, onTop);
    return () => {
      stop();
      target$.removeEventListener('scroll', onScroll);
      target$.removeEventListener('touchstart', stop);
      target$.removeEventListener('wheel', stop);
      window.removeEventListener(TAB_SCROLL_TOP_EVENT, onTop);
    };
  }, [pathname, scroller]);
}
