'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Icon3D, type Icon3DName } from '@/components/ui/icon3d';
import { useAuth } from '@/lib/auth-context';
import { loadFriends, getIncoming, onFriendsChange } from '@/lib/friends-service';
import { loadGames, getActiveGames, onGamesChange } from '@/lib/friendly-games-client';
import { friendsBadgeCount } from '@/lib/friends-play';

// D1 of the Stats + Friends redesign (founder, 2026-09-26, "option 2"): Profile
// and Records merge into Stats; Friends gets its own tab. iOS RootTabView and
// Android MainScreen carry the same four.
// HEADER_SPEC §3: the 3D tab icons. Selected: full color and the label in
// #6d28d9 900 with a 3 px purple underline pill; unselected: 55% opacity, 60%
// saturation, muted label. The numeric Friends badge stays.
// FINISH_SPEC A4 (replaces the §18.3 floating pill): DOCKED — flush to the
// bottom edge, edge to edge, opaque, a soft page-tinted gradient (lilac Home,
// warm Leaderboard, blue Stats, pink Friends) with a faint top line; the
// home-indicator / safe area is part of the bar (globals.css .tab-dock) and the
// page content ends above it (--bottom-nav-h). Each tab icon squishes on tap
// (A9, components/ui/squish-host.tsx).
/** The bar's tint follows the page (A4): Leaderboard + Records warm, Stats blue, Friends pink, the rest lilac. */
export function tabTint(pathname: string | null): 'home' | 'leaderboard' | 'stats' | 'friends' {
  const p = pathname ?? '/';
  if (p.startsWith('/daily') || p.startsWith('/records')) return 'leaderboard';
  if (p.startsWith('/stats') || p.startsWith('/profile')) return 'stats';
  if (p.startsWith('/friends')) return 'friends';
  return 'home';
}

const NAV_ITEMS: { href: string; label: string; icon: Icon3DName }[] = [
  { href: '/', label: 'Home', icon: 'tab-home' },
  { href: '/daily', label: 'Leaderboard', icon: 'tab-leaderboard' },
  { href: '/stats', label: 'Stats', icon: 'tab-stats' },
  { href: '/friends', label: 'Friends', icon: 'tab-friends' },
];

export function BottomNav() {
  const pathname = usePathname();
  const ref = useRef<HTMLElement | null>(null);
  // Pending friend-request badge on Friends (Tier 1, Aug 11; moved from Profile
  // in D1): pushes were the only signal before — a missed push meant a request
  // nobody ever saw.
  // Friends overhaul §5: the badge = pending requests + pocket games where it's your turn.
  const { user } = useAuth();
  const [badge, setBadge] = useState(0);
  useEffect(() => {
    if (!user) { setBadge(0); return; }
    const sync = () => setBadge(friendsBadgeCount(getIncoming().length, getActiveGames()));
    loadFriends().then(sync);
    loadGames().then(sync);
    const offFriends = onFriendsChange(sync);
    const offGames = onGamesChange(sync);
    return () => { offFriends(); offGames(); };
  }, [user]);

  // Publish the room the nav takes at the bottom of the screen (the docked bar
  // including the safe area) as --bottom-nav-h on <html> so
  // the fixed AdBanner (mounted globally in layout.tsx) can stack directly
  // above the nav instead of covering it. ResizeObserver + resize keep it fresh
  // across safe-area/orientation changes; the cleanup resets to 0 on routes
  // that don't render a BottomNav.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const publish = () => {
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
            className="flex flex-col items-center gap-0.5 pt-0.5 pb-0.5 min-w-0"
            aria-current={isActive ? 'page' : undefined}
            aria-label={item.label}
          >
            <span className="relative">
              <span
                className="tab-squish block transition-[opacity,filter] duration-200"
                style={{
                  opacity: isActive ? 1 : 0.55,
                  filter: isActive ? 'none' : 'saturate(0.6)',
                }}
              >
                <Icon3D name={item.icon} size={30} priority />
              </span>
              {item.href === '/friends' && badge > 0 && (
                <span
                  className="absolute -top-1.5 -right-2.5 flex items-center justify-center rounded-full text-[9px] font-black text-white"
                  style={{ minWidth: 15, height: 15, padding: '0 4px', backgroundColor: '#7c3aed' /* win purple (founder, Aug 11) */, boxShadow: '0 0 0 2px var(--tab-pill-ring, var(--color-bg))' }}
                  aria-label={`${badge} waiting on you in Friends`}
                >
                  {badge > 9 ? '9+' : badge}
                </span>
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
  );
}
