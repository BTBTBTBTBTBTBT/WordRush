'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Trophy, User, Crown } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/daily', label: 'Leaderboard', icon: Trophy },
  { href: '/profile', label: 'Profile', icon: User },
  { href: '/records', label: 'Records', icon: Crown },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around px-4 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      style={{
        backgroundColor: '#f8f7ff',
        borderTop: '1.5px solid #ede9f6',
      }}
    >
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href;
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-col items-center gap-0.5 py-1 px-3 min-w-[60px]"
          >
            <Icon
              className="w-5 h-5 transition-colors"
              style={{ color: isActive ? '#7c3aed' : '#9ca3af' }}
              fill={isActive ? '#7c3aed' : 'none'}
            />
            <span
              className="text-[10px] font-extrabold transition-colors"
              style={{ color: isActive ? '#7c3aed' : '#9ca3af' }}
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
