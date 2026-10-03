'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Icon3D } from '@/components/ui/icon3d';
import { CandyBadge } from '@/components/ui/candy-badge';
import { candyClass } from '@/components/ui/candy-button';
import { useAuth } from '@/lib/auth-context';
import { friendsTabLabel } from '@/lib/friends-badge';
import { useFriendsBadge } from '@/hooks/use-friends-badge';
import { NAV_ITEMS, useTabTap } from '@/components/ui/tab-nav';

// The desktop website's tabs (≥ 1024 px, lib/desktop-layout.ts): Home /
// Leaderboard / Stats / Friends as candy pill tabs in the middle of the sticky
// top bar (components/ui/app-header.tsx), in place of the docked bottom bar on
// the tab pages. The selected tab is the purple candy, the others the quiet
// peach candy (A8), each with its 3D tab icon; the Friends pill wears the
// candy count badge (M). Small pills from 1024 px, medium from 1280 px (CSS).
// Same tabs, tap rules and badge state as the bottom bar
// (components/ui/tab-nav.tsx, hooks/use-friends-badge.ts). Hidden below
// 1024 px (globals.css .dk-tabs), so phones never see it.

export function DesktopTabs() {
  const pathname = usePathname();
  const { onTabTap, confirm } = useTabTap();
  const { user } = useAuth();
  const onFriends = (pathname ?? '').startsWith('/friends');
  const badge = useFriendsBadge(user?.id ?? null, onFriends);
  const navRef = useRef<HTMLElement | null>(null);
  const [pop, setPop] = useState(0);
  const prevBadge = useRef(0);
  useEffect(() => {
    if (badge > prevBadge.current) {
      setPop((n) => n + 1);
      // FINISH_SPEC U: `notify` once, from the tab row that is on screen.
      // BI7: silent — a background arrival is not something the player did.
    }
    prevBadge.current = badge;
  }, [badge]);

  return (
    <>
      <nav ref={navRef} className="dk-tabs" aria-label="Main navigation">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={(e) => onTabTap(e, item.href)}
              className={candyClass({ color: isActive ? 'purple' : 'peach', size: 'sm', extra: 'dk-tab' })}
              aria-current={isActive ? 'page' : undefined}
              aria-label={item.href === '/friends' ? friendsTabLabel(badge) : item.label}
            >
              <Icon3D name={item.icon} size={22} priority />
              <span className="candy-label">{item.label}</span>
              {item.href === '/friends' && badge > 0 && (
                <CandyBadge key={pop} count={badge} pop pulse className="dk-tab-badge" />
              )}
            </Link>
          );
        })}
      </nav>
      {confirm}
    </>
  );
}
