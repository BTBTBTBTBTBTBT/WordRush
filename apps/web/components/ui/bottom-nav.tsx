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
// HEADER_SPEC §3: the 3D tab icons at 28 px. Selected: full color, a −2 px
// lift and the label in #7c3aed 900; unselected: 45% opacity, 60% saturation,
// gray label. The numeric Friends badge stays.
// ART_SPEC §18.3: a frosted floating pill, inset 12 px from the sides and 12 px
// above the bottom safe area, radius 26, white at 78% with a background blur
// (solid white 94% where blur isn't supported; globals.css .tab-pill), soft
// shadow; the selected tab adds a 3 px purple underline pill under its label.
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

  // Publish the room the nav takes at the bottom of the screen (the floating
  // pill plus its inset above the safe area) as --bottom-nav-h on <html> so
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
      className="tab-pill fixed left-3 right-3 z-40 flex items-center justify-around px-2 py-1"
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 12px)', borderRadius: 26 }}
      aria-label="Main navigation"
    >
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-col items-center gap-0.5 pt-1 pb-0.5 px-3 min-w-[60px]"
            aria-current={isActive ? 'page' : undefined}
            aria-label={item.label}
          >
            <span className="relative">
              <span
                className="block transition-[transform,opacity,filter] duration-200"
                style={{
                  transform: isActive ? 'translateY(-2px)' : 'none',
                  opacity: isActive ? 1 : 0.45,
                  filter: isActive ? 'none' : 'saturate(0.6)',
                }}
              >
                <Icon3D name={item.icon} size={28} priority />
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
              className={`text-[10px] transition-colors ${isActive ? 'font-black' : 'font-extrabold'}`}
              style={{ color: isActive ? '#7c3aed' : 'var(--color-text-muted)' }}
            >
              {item.label}
            </span>
            {/* §18.3: the selected tab's 3 px purple underline pill (space kept on every tab). */}
            <span
              aria-hidden="true"
              className="block rounded-full"
              style={{ width: 18, height: 3, background: '#7c3aed', opacity: isActive ? 1 : 0 }}
            />
          </Link>
        );
      })}
    </nav>
  );
}
