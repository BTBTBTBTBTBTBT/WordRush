'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, Gamepad2, FileText, Shield, Gift, BookOpen, CreditCard, BellRing, ArrowLeft, SpellCheck, TrendingUp, Puzzle, Activity, DollarSign } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/metrics', label: 'Metrics', icon: TrendingUp },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/games', label: 'Games', icon: Gamepad2 },
  { href: '/admin/payments', label: 'Payments', icon: CreditCard },
  { href: '/admin/revenue', label: 'Revenue', icon: DollarSign },
  { href: '/admin/referrals', label: 'Referrals', icon: Gift },
  { href: '/admin/content', label: 'Content', icon: FileText },
  { href: '/admin/moderation', label: 'Moderation', icon: Shield },
  { href: '/admin/messaging', label: 'Messaging', icon: BellRing },
  { href: '/admin/words', label: 'Words', icon: SpellCheck },
  { href: '/admin/puzzles', label: 'Puzzles', icon: Puzzle },
  { href: '/admin/ops', label: 'Ops', icon: Activity },
  { href: '/admin/portal', label: 'Portal', icon: BookOpen },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 border-r border-gray-200 bg-white flex flex-col h-full">
      <div className="p-4 border-b border-gray-200">
        <h1 className="text-lg font-black text-gray-900">Admin Panel</h1>
        <p className="text-xs text-gray-400 font-medium">Wordocious</p>
      </div>

      <nav className="flex-1 p-2 space-y-0.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = href === '/admin'
            ? pathname === '/admin'
            : pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                isActive
                  ? 'bg-purple-50 text-purple-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="p-2 border-t border-gray-200">
        <Link
          href="/"
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-semibold text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Wordocious
        </Link>
      </div>
    </aside>
  );
}
