'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Home, Trophy, User, Crown } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { loadFriends, getIncoming, onFriendsChange } from '@/lib/friends-service';

const NAV_ITEMS = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/daily', label: 'Leaderboard', icon: Trophy },
  { href: '/profile', label: 'Profile', icon: User },
  { href: '/records', label: 'Records', icon: Crown },
];

export function BottomNav() {
  const pathname = usePathname();
  const ref = useRef<HTMLElement | null>(null);
  // Pending friend-request badge on Profile (Tier 1, Aug 11): pushes were the
  // only signal before — a missed push meant a request nobody ever saw.
  const { user } = useAuth();
  const [pendingRequests, setPendingRequests] = useState(0);
  useEffect(() => {
    if (!user) { setPendingRequests(0); return; }
    loadFriends().then(() => setPendingRequests(getIncoming().length));
    return onFriendsChange(() => setPendingRequests(getIncoming().length));
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
              {item.href === '/profile' && pendingRequests > 0 && (
                <span
                  className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full"
                  style={{ backgroundColor: '#7c3aed' /* win purple (founder, Aug 11) */ }}
                  aria-label={`${pendingRequests} pending friend requests`}
                />
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
