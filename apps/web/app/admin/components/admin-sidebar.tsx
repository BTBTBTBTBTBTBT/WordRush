'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, X } from 'lucide-react';
import { ADMIN_NAV, isActiveNav } from './admin-nav';

/**
 * The admin sidebar: the ADMIN_NAV groups (Overview · Players · Games &
 * Puzzles · Competition · Social · Progression · Monetization · Growth ·
 * Content & Ops · System). Docked on desktop; a slide-over on phones, opened
 * from the layout's top bar (`open` / `onClose`).
 */
export function AdminSidebar({ open = false, onClose }: { open?: boolean; onClose?: () => void }) {
  const pathname = usePathname() ?? '';

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={onClose} aria-hidden="true" />}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-60 shrink-0 border-r border-gray-200 bg-white flex flex-col h-full transition-transform lg:static lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="px-4 py-4 border-b border-gray-200 flex items-center justify-between">
          <Link href="/admin" onClick={onClose} className="block">
            <h1 className="text-base font-black text-gray-900 leading-tight">Wordocious Admin</h1>
            <p className="text-[11px] text-gray-400 font-semibold">Operations portal</p>
          </Link>
          <button onClick={onClose} className="lg:hidden p-1 rounded-md text-gray-400 hover:bg-gray-100" aria-label="Close menu">
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
          {ADMIN_NAV.map((group) => (
            <div key={group.title}>
              <p className="px-3 mb-1 text-[10px] font-black uppercase tracking-wider text-gray-400">{group.title}</p>
              <div className="space-y-0.5">
                {group.items.map(({ href, label, icon: Icon }) => {
                  const active = isActiveNav(href, pathname);
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={onClose}
                      aria-current={active ? 'page' : undefined}
                      className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-colors ${
                        active ? 'bg-purple-50 text-purple-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${active ? 'text-purple-600' : 'text-gray-400'}`} />
                      {label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
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
    </>
  );
}
