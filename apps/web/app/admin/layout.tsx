'use client';

import { AdminSidebar } from './components/admin-sidebar';
import { DrillProvider } from './components/drill-panel';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    // DrillProvider wraps every admin page so any number anywhere can open the
    // rows behind it without each page mounting its own panel.
    <DrillProvider>
      <div className="h-screen flex bg-gray-50">
        <AdminSidebar />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto p-6">
            {children}
          </div>
        </main>
      </div>
    </DrillProvider>
  );
}
