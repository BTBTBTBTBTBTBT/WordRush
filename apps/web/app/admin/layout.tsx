'use client';

import { AdminSidebar } from './components/admin-sidebar';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen flex bg-gray-50">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
