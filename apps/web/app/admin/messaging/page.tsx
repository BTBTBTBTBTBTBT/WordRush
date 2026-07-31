'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Megaphone, BellRing, Send } from 'lucide-react';

// Monitoring for the two outbound channels: announcements (authored on the
// Content page, displayed by all three apps) and push notifications (APNs/FCM,
// sent by the daily-reminder cron). This page answers "what are users seeing
// right now, and who can we actually reach" — plus the self-targeted APNs test.
interface MessagingData {
  announcements: { id: string; title: string; body: string; type: string; state: 'live' | 'scheduled' | 'expired' | 'disabled'; starts_at: string | null; expires_at: string | null; created_at: string }[];
  push: {
    totalTokens: number;
    totalUsers: number;
    byPlatform: Record<string, { tokens: number; users: number }>;
    latestRegistration: string | null;
    apnsConfigured: boolean;
    fcmConfigured: boolean;
  };
}

const STATE_STYLES: Record<string, string> = {
  live: 'text-green-700 bg-green-50',
  scheduled: 'text-blue-700 bg-blue-50',
  expired: 'text-gray-500 bg-gray-100',
  disabled: 'text-red-600 bg-red-50',
};

export default function AdminMessagingPage() {
  const [data, setData] = useState<MessagingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    fetch('/api/admin/messaging')
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const sendTest = async () => {
    setTesting(true); setTestResult(null);
    try {
      const res = await fetch('/api/admin/push/test', { method: 'POST' });
      const json = await res.json();
      setTestResult(res.ok ? 'Test push sent to your devices.' : json.error || 'Failed.');
    } catch { setTestResult('Failed to reach the push API.'); }
    setTesting(false);
  };

  if (loading) return <div className="h-60 bg-gray-100 rounded-xl animate-pulse" />;
  if (!data) return <p className="text-sm text-gray-400">Failed to load messaging.</p>;

  const live = data.announcements.filter((a) => a.state === 'live');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black text-gray-900">Messaging</h1>

      {/* Push reachability */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
          <BellRing className="w-4 h-4" /> Push Reach
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-2xl font-black text-gray-900">{data.push.totalUsers}</p>
            <p className="text-xs font-bold text-gray-400">reachable users</p>
          </div>
          <div>
            <p className="text-2xl font-black text-gray-900">{data.push.totalTokens}</p>
            <p className="text-xs font-bold text-gray-400">devices</p>
          </div>
          {Object.entries(data.push.byPlatform).map(([platform, v]) => (
            <div key={platform}>
              <p className="text-2xl font-black text-gray-900">{v.users}</p>
              <p className="text-xs font-bold text-gray-400 uppercase">{platform} users ({v.tokens} devices)</p>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-center gap-3 text-xs font-medium">
          <span className={data.push.apnsConfigured ? 'text-green-700' : 'text-red-600'}>
            APNs (iOS): {data.push.apnsConfigured ? 'configured' : 'NOT configured'}
          </span>
          <span className={data.push.fcmConfigured ? 'text-green-700' : 'text-amber-600'}>
            FCM (Android): {data.push.fcmConfigured ? 'configured' : 'not configured — set FCM_SERVICE_ACCOUNT in Vercel'}
          </span>
          {data.push.latestRegistration && (
            <span className="text-gray-400">last registration {new Date(data.push.latestRegistration).toLocaleString()}</span>
          )}
          <span className="text-gray-400">Daily reminder cron: 14:00 UTC.</span>
          <button
            onClick={sendTest}
            disabled={testing}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" /> {testing ? 'Sending…' : 'Send test to my devices'}
          </button>
        </div>
        {testResult && <p className="mt-2 text-xs font-bold text-gray-600">{testResult}</p>}
      </div>

      {/* Announcements */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
          <Megaphone className="w-4 h-4" /> Announcements — {live.length} live
          <Link href="/admin/content" className="ml-auto text-purple-600 hover:underline normal-case font-bold">Author on Content →</Link>
        </h2>
        {data.announcements.length === 0 ? (
          <p className="text-sm text-gray-400">No announcements yet.</p>
        ) : (
          <div className="space-y-2">
            {data.announcements.map((a) => (
              <div key={a.id} className="text-xs py-2 border-b border-gray-50">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-900">{a.title}</span>
                  <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded uppercase ${STATE_STYLES[a.state]}`}>{a.state}</span>
                  <span className="ml-auto text-gray-400">
                    {a.expires_at ? `expires ${new Date(a.expires_at).toLocaleDateString()}` : 'no expiry'}
                  </span>
                </div>
                <p className="text-gray-500 mt-0.5">{a.body}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
