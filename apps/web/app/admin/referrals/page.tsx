'use client';

import { useEffect, useState } from 'react';
import { Gift, Users, Crown, Percent, CalendarPlus, Ban } from 'lucide-react';
import { confirmDialog } from '@/components/ui/confirm-dialog';
import { useDrill } from '../components/drill-panel';

interface ReferralRow {
  id: string;
  code: string;
  status: string;
  inviter: string;
  invitee: string | null;
  created_at: string;
  redeemed_at: string | null;
  converted_at: string | null;
  converted_plan: string | null;
  expires_at: string;
  expired: boolean;
}

interface ReferralStats {
  total: number;
  openPending: number;
  redeemed: number;
  converted: number;
  conversionRate: number;
  proDaysGranted: number;
}

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600',
  redeemed: 'bg-green-50 text-green-700',
  converted: 'bg-amber-50 text-amber-700',
  expired: 'bg-gray-50 text-gray-400',
  revoked: 'bg-red-50 text-red-600',
};

export default function AdminReferralsPage() {
  const drill = useDrill();
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [rows, setRows] = useState<ReferralRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);

  const load = () =>
    fetch('/api/admin/referrals')
      .then((r) => r.json())
      .then((data) => {
        setStats(data.stats ?? null);
        setRows(data.referrals ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const handleRevoke = async (id: string, code: string) => {
    const ok = await confirmDialog({
      title: `Revoke invite ${code}?`,
      message: 'The link stops working immediately for whoever holds it.',
      confirmText: 'Revoke',
      cancelText: 'Keep it',
    });
    if (!ok) return;
    setRevoking(id);
    await fetch(`/api/admin/referrals/${id}/revoke`, { method: 'POST' });
    setRevoking(null);
    load();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-black text-gray-900">Referrals</h1>
        <div className="h-40 bg-gray-100 rounded animate-pulse" />
      </div>
    );
  }

  const statCards = stats ? [
    { label: 'Invites Created', value: stats.total, icon: Gift, color: 'text-purple-600 bg-purple-50', drill: { metric: 'referrals' } },
    { label: 'Open Invites', value: stats.openPending, icon: Users, color: 'text-blue-600 bg-blue-50', drill: { metric: 'referrals', key: 'pending' } },
    { label: 'Friends Joined', value: stats.redeemed, icon: Users, color: 'text-green-600 bg-green-50', drill: { metric: 'referrals', key: 'redeemed' } },
    { label: 'Subscribed', value: stats.converted, icon: Crown, color: 'text-amber-600 bg-amber-50', drill: { metric: 'referrals', key: 'converted' } },
    { label: 'Join → Sub Rate', value: `${stats.conversionRate}%`, icon: Percent, color: 'text-pink-600 bg-pink-50' },
    { label: 'Pro Days Granted', value: stats.proDaysGranted, icon: CalendarPlus, color: 'text-indigo-600 bg-indigo-50' },
  ] : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900">Referrals</h1>
        <p className="text-xs text-gray-400 font-medium mt-0.5">
          Gift-trial program — friends get 7 days of Pro; inviters earn +3 days per join
          (first 5), +4 shields at 3 joins, and a free month per monthly subscription —
          3 free months per annual.
        </p>
      </div>

      {/* Stat cards — same grid as the dashboard */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {statCards.map(({ label, value, icon: Icon, color, drill: dp }) => (
          <button
            type="button" key={label} disabled={!dp} onClick={() => dp && drill(dp)}
            className={`text-left bg-white rounded-xl border border-gray-200 p-4 transition ${dp ? 'hover:border-purple-300 hover:shadow-sm' : 'cursor-default'}`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${color}`}>
              <Icon className="w-4 h-4" />
            </div>
            <div className="text-2xl font-black text-gray-900">{value}</div>
            <div className="text-xs font-bold text-gray-400">{label}</div>
          </button>
        ))}
      </div>

      {/* All referrals */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-3">
          All Invites (latest 200)
        </h2>
        {rows.length === 0 ? (
          <p className="text-sm text-gray-400 font-medium">No invites yet — the profile page's
            "Gift Pro to Friends" panel creates them.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-bold text-gray-400 uppercase tracking-wide border-b border-gray-100">
                  <th className="py-2 pr-3">Code</th>
                  <th className="py-2 pr-3">Inviter</th>
                  <th className="py-2 pr-3">Friend</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Created</th>
                  <th className="py-2 pr-3">Converted Plan</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const status = r.expired ? 'expired' : r.status;
                  return (
                    <tr key={r.id} className="border-b border-gray-50">
                      <td className="py-2 pr-3 font-mono font-bold tracking-wider text-gray-900">{r.code}</td>
                      <td className="py-2 pr-3 font-bold text-gray-700">{r.inviter}</td>
                      <td className="py-2 pr-3 font-bold text-gray-700">{r.invitee ?? '—'}</td>
                      <td className="py-2 pr-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${STATUS_BADGE[status] ?? STATUS_BADGE.pending}`}>
                          {status}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-gray-500 font-medium">
                        {new Date(r.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-2 pr-3 text-gray-500 font-medium">{r.converted_plan ?? '—'}</td>
                      <td className="py-2 text-right">
                        {status === 'pending' && (
                          <button
                            onClick={() => handleRevoke(r.id, r.code)}
                            disabled={revoking === r.id}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold text-red-600 border border-red-200 hover:bg-red-50 disabled:opacity-50"
                          >
                            <Ban className="w-3 h-3" />
                            {revoking === r.id ? 'Revoking…' : 'Revoke'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
