'use client';

import { useState } from 'react';
import { Menu } from 'lucide-react';
import { AdminSidebar } from './components/admin-sidebar';
import { DrillProvider } from './components/drill-panel';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    // DrillProvider wraps every admin page so any number anywhere can open the
    // rows behind it without each page mounting its own panel.
    <DrillProvider>
      <div className="h-screen flex bg-gray-50 text-gray-900">
        <AdminSidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
        <main className="flex-1 min-w-0 overflow-y-auto">
          {/* Phone top bar: the sidebar is a slide-over below lg. */}
          <div className="lg:hidden sticky top-0 z-20 flex items-center gap-3 border-b border-gray-200 bg-white/95 backdrop-blur px-4 py-2.5">
            <button onClick={() => setMenuOpen(true)} className="p-1.5 -ml-1.5 rounded-md text-gray-600 hover:bg-gray-100" aria-label="Open menu">
              <Menu className="w-5 h-5" />
            </button>
            <span className="text-sm font-black text-gray-900">Wordocious Admin</span>
          </div>
          <div className="max-w-6xl mx-auto px-4 py-6 sm:px-6">
            {children}
          </div>
        </main>
      </div>
    </DrillProvider>
  );
}
