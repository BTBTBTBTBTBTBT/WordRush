'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, Gamepad2, FileText, Shield, ArrowLeft } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/games', label: 'Games', icon: Gamepad2 },
  { href: '/admin/content', label: 'Content', icon: FileText },
  { href: '/admin/moderation', label: 'Moderation', icon: Shield },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 border-r border-gray-200 bg-white flex flex-col h-full">
      <div className="p-4 border-b border-gray-200">
        <h1 className="text-lg font-black text-gray-900">Admin Panel</h1>
        <p className="text-xs text-gray-400 font-medium">Spellstrike</p>
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
          Back to Spellstrike
        </Link>
      </div>
    </aside>
  );
}
