'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';

interface UserRow {
  id: string;
  username: string;
  avatar_url: string | null;
  level: number;
  coins: number;
  is_pro: boolean;
  is_banned: boolean;
  last_played_at: string | null;
  created_at: string;
  role: string;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(async (q: string, p: number) => {
    setLoading(true);
    const res = await fetch(`/api/admin/users?q=${encodeURIComponent(q)}&page=${p}&limit=20`);
    const data = await res.json();
    setUsers(data.users || []);
    setTotal(data.total || 0);
    setTotalPages(data.totalPages || 1);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUsers(search, page);
  }, [page]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers(search, 1);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-gray-900">Users</h1>
        <span className="text-sm text-gray-400 font-bold">{total.toLocaleString()} total</span>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by username..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-bold hover:bg-purple-700 transition-colors"
        >
          Search
        </button>
      </form>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 font-bold text-gray-500 text-xs uppercase tracking-wide">User</th>
              <th className="text-left px-4 py-3 font-bold text-gray-500 text-xs uppercase tracking-wide">Level</th>
              <th className="text-left px-4 py-3 font-bold text-gray-500 text-xs uppercase tracking-wide">Coins</th>
              <th className="text-left px-4 py-3 font-bold text-gray-500 text-xs uppercase tracking-wide">Status</th>
              <th className="text-left px-4 py-3 font-bold text-gray-500 text-xs uppercase tracking-wide">Last Active</th>
              <th className="text-left px-4 py-3 font-bold text-gray-500 text-xs uppercase tracking-wide">Joined</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-gray-50">
                  <td colSpan={6} className="px-4 py-3"><div className="h-5 bg-gray-100 rounded animate-pulse" /></td>
                </tr>
              ))
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400 font-medium">No users found.</td>
              </tr>
            ) : (
              users.map(user => (
                <tr
                  key={user.id}
                  onClick={() => router.push(`/admin/users/${user.id}`)}
                  className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center text-xs font-black text-purple-600">
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-bold text-gray-900">{user.username}</span>
                      {user.role === 'admin' && (
                        <span className="text-[10px] font-extrabold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">ADMIN</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 font-medium">{user.level}</td>
                  <td className="px-4 py-3 text-gray-600 font-medium">{user.coins.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {user.is_pro && <span className="text-[10px] font-extrabold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">PRO</span>}
                      {user.is_banned && <span className="text-[10px] font-extrabold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">BANNED</span>}
                      {!user.is_pro && !user.is_banned && <span className="text-gray-400 text-xs">Free</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs font-medium">
                    {user.last_played_at ? new Date(user.last_played_at).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs font-medium">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-400 font-medium">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
