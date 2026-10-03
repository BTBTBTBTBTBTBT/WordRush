'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Icon3D } from '@/components/ui/icon3d';
import { useAuth } from '@/lib/auth-context';
import { friendsTabLabel } from '@/lib/friends-badge';
import { prefersReducedMotion } from '@/lib/motion';
import { CandyBadge } from '@/components/ui/candy-badge';
import { useFriendsBadge } from '@/hooks/use-friends-badge';
import { NAV_ITEMS, tabTint, useTabScrollMemory, useTabTap } from '@/components/ui/tab-nav';

// D1 of the Stats + Friends redesign (founder, 2026-09-26, "option 2"): Profile
// and Records merge into Stats; Friends gets its own tab. iOS RootTabView and
// Android MainScreen carry the same four.
// HEADER_SPEC §3: the 3D tab icons. Selected: full color and the label in
// #6d28d9 900 with a 3 px purple underline pill; unselected: 55% opacity, 60%
// saturation, muted label. The Friends tab wears the candy count badge (FINISH_SPEC M).
// FINISH_SPEC A4 (replaces the §18.3 floating pill): DOCKED — flush to the
// bottom edge, edge to edge, opaque, a soft page-tinted gradient (lilac Home,
// warm Leaderboard, blue Stats, pink Friends) with a faint top line; the
// home-indicator / safe area is part of the bar (globals.css .tab-dock) and the
// page content ends above it (--bottom-nav-h). Each tab icon squishes on tap
// (A9, components/ui/squish-host.tsx).
// Desktop website (≥ 1024 px, lib/desktop-layout.ts): on the tab pages the
// same four tabs ride in the top bar (components/ui/desktop-tabs.tsx) and this
// bar hides (globals.css); game screens keep it. The tabs, their tap rules and
// the Friends badge state are shared (components/ui/tab-nav.tsx,
// hooks/use-friends-badge.ts).

export { tabTint } from '@/components/ui/tab-nav';

export function BottomNav() {
  const pathname = usePathname();
  const { onTabTap, confirm } = useTabTap();
  // BI11: the window-scrolled tabs (Leaderboard, Stats, Friends) keep their position;
  // Home scrolls its own column and remembers it itself (app/page.tsx).
  useTabScrollMemory(pathname === '/' ? null : pathname);
  const ref = useRef<HTMLElement | null>(null);
  // FINISH_SPEC M: the Friends tab's candy badge (hooks/use-friends-badge.ts).
  // A new item springs the badge in and wiggles the tab icon; the badge's glow
  // pulses while unseen (CSS, off with Reduce Motion).
  const { user } = useAuth();
  const onFriends = (pathname ?? '').startsWith('/friends');
  const badge = useFriendsBadge(user?.id ?? null, onFriends);
  const [pop, setPop] = useState(0);
  const friendsIconRef = useRef<HTMLSpanElement | null>(null);

  // A new item: spring the badge in and wiggle the tab icon.
  const prevBadge = useRef(0);
  useEffect(() => {
    if (badge > prevBadge.current) {
      setPop((n) => n + 1);
      // FINISH_SPEC U: the Friends badge pops = `notify` + light haptic — once,
      // from the row the player can see (the desktop top bar plays it there).
      // BI7: silent — a background arrival is not something the player did.
      const icon = friendsIconRef.current;
      if (icon && !prefersReducedMotion()) {
        icon.classList.remove('tab-wiggle');
        void icon.offsetWidth;
        icon.classList.add('tab-wiggle');
        icon.addEventListener('animationend', () => icon.classList.remove('tab-wiggle'), { once: true });
      }
    }
    prevBadge.current = badge;
  }, [badge]);

  // Publish the room the nav takes at the bottom of the screen (the docked bar
  // including the safe area) as --bottom-nav-h on <html> so
  // the fixed AdBanner (mounted globally in layout.tsx) can stack directly
  // above the nav instead of covering it. ResizeObserver + resize keep it fresh
  // across safe-area/orientation changes; the cleanup resets to 0 on routes
  // that don't render a BottomNav. A hidden bar (the desktop tab pages) takes
  // no room.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const publish = () => {
      if (el.getClientRects().length === 0) { root.style.setProperty('--bottom-nav-h', '0px'); return; }
      const room = Math.max(el.offsetHeight, Math.round(window.innerHeight - el.getBoundingClientRect().top));
      root.style.setProperty('--bottom-nav-h', `${room}px`);
    };
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    window.addEventListener('resize', publish);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', publish);
      root.style.setProperty('--bottom-nav-h', '0px');
    };
  }, []);

  return (
    <>
    <nav
      ref={ref}
      className="tab-dock fixed left-0 right-0 bottom-0 z-40 grid grid-cols-4"
      data-tab-tint={tabTint(pathname)}
      aria-label="Main navigation"
    >
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            // BI11: no jump to the top on a tab switch — the tab restores its own position.
            scroll={false}
            onClick={(e) => onTabTap(e, item.href)}
            className="flex flex-col items-center gap-0.5 pt-0.5 pb-0.5 min-w-0"
            aria-current={isActive ? 'page' : undefined}
            aria-label={item.href === '/friends' ? friendsTabLabel(badge) : item.label}
          >
            <span className="relative" ref={item.href === '/friends' ? friendsIconRef : undefined}>
              <span
                className="tab-squish block transition-opacity duration-200"
                style={{
                  opacity: isActive ? 1 : 0.55,
                  filter: isActive ? 'none' : 'saturate(0.6)',
                }}
              >
                <Icon3D name={item.icon} size={30} priority />
              </span>
              {item.href === '/friends' && badge > 0 && (
                // The tab's label already says "Friends, N new".
                <CandyBadge key={pop} count={badge} pop pulse className="absolute" style={{ top: -6, right: -11 }} />
              )}
            </span>
            <span
              className={`text-[11px] transition-colors ${isActive ? 'font-black' : 'font-extrabold'}`}
              style={{ color: isActive ? '#6d28d9' : '#8a78ad' }}
            >
              {item.label}
            </span>
            {/* The selected tab's 3 px purple underline pill (space kept on every tab). */}
            <span
              aria-hidden="true"
              className="block rounded-full"
              style={{ width: 22, height: 3, background: '#7c3aed', opacity: isActive ? 1 : 0 }}
            />
          </Link>
        );
      })}
    </nav>
    {confirm}
    </>
  );
}
