'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Home, Trophy, BarChart3, Users } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { loadFriends, getIncoming, onFriendsChange } from '@/lib/friends-service';
import { loadGames, getActiveGames, onGamesChange } from '@/lib/friendly-games-client';
import { friendsBadgeCount } from '@/lib/friends-play';

// D1 of the Stats + Friends redesign (founder, 2026-09-26, "option 2"): Profile
// and Records merge into Stats; Friends gets its own tab. iOS RootTabView and
// Android MainScreen carry the same four.
const NAV_ITEMS = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/daily', label: 'Leaderboard', icon: Trophy },
  { href: '/stats', label: 'Stats', icon: BarChart3 },
  { href: '/friends', label: 'Friends', icon: Users },
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

  // Publish the nav's rendered height as --bottom-nav-h on <html> so the
  // fixed AdBanner (mounted globally in layout.tsx) can stack directly above
  // the nav instead of covering it — both are fixed bottom-0 otherwise.
  // ResizeObserver keeps it fresh across safe-area/orientation changes; the
  // cleanup resets to 0 on routes that don't render a BottomNav.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const publish = () => root.style.setProperty('--bottom-nav-h', `${el.offsetHeight}px`);
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.setProperty('--bottom-nav-h', '0px');
    };
  }, []);

  return (
    <nav
      ref={ref}
      className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around px-4 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      style={{
        backgroundColor: 'var(--color-bg)',
        borderTop: '1.5px solid var(--color-border)',
      }}
      aria-label="Main navigation"
    >
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href;
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-col items-center gap-0.5 py-1 px-3 min-w-[60px]"
            aria-current={isActive ? 'page' : undefined}
            aria-label={item.label}
          >
            <span className="relative">
              <Icon
                className="w-5 h-5 transition-colors"
                style={{ color: isActive ? '#7c3aed' : 'var(--color-text-muted)' }}
                fill={isActive ? '#7c3aed' : 'none'}
                aria-hidden="true"
              />
              {item.href === '/friends' && badge > 0 && (
                <span
                  className="absolute -top-1.5 -right-2.5 flex items-center justify-center rounded-full text-[9px] font-black text-white"
                  style={{ minWidth: 15, height: 15, padding: '0 4px', backgroundColor: '#7c3aed' /* win purple (founder, Aug 11) */, boxShadow: '0 0 0 2px var(--color-bg)' }}
                  aria-label={`${badge} waiting on you in Friends`}
                >
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </span>
            <span
              className="text-[10px] font-extrabold transition-colors"
              style={{ color: isActive ? '#7c3aed' : 'var(--color-text-muted)' }}
            >
              {item.label}
            </span>
            {isActive && (
              <div
                className="w-1 h-1 rounded-full"
                style={{ backgroundColor: '#7c3aed' }}
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
