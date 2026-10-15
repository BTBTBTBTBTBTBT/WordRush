'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BellRing, Send } from 'lucide-react';
import { useDrill } from '../components/drill-panel';
import { TabIntro, ReloadButton, ErrorNote, LoadingGrid, useAdminData } from '../components/admin-ui';

// Messaging & Push > Push health: reachability + APNs/FCM health + a smoke test.
// The one home for "how many devices can we push" (Marketing's duplicate
// scorecard was removed).
interface PushData {
  push: {
    totalTokens: number;
    totalUsers: number;
    byPlatform: Record<string, { tokens: number; users: number }>;
    latestRegistration: string | null;
    apnsConfigured: boolean;
    fcmConfigured: boolean;
  };
}

export default function PushHealthTab() {
  const drill = useDrill();
  const { data, error, loading, reload } = useAdminData<PushData>('/api/admin/messaging');
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const sendTest = async () => {
    setTesting(true); setTestResult(null);
    try {
      const res = await fetch('/api/admin/push/test', { method: 'POST' });
      const json = await res.json();
      setTestResult(res.ok ? 'Test push sent to your devices.' : json.error || 'Failed.');
    } catch { setTestResult('Failed to reach the push API.'); }
    setTesting(false);
  };

  return (
    <div className="space-y-6">
      <TabIntro actions={<ReloadButton onClick={reload} loading={loading} />}>
        How many players and devices we can reach by push, whether Apple and Google delivery is set up, and a test to your own devices.
      </TabIntro>
      {error && <ErrorNote>{error}</ErrorNote>}
      {!data && loading && <LoadingGrid tiles={4} />}
      {data && (
      <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <BellRing className="w-4 h-4" /> Push Reach
            <Link href="/admin/messaging?tab=campaigns" className="ml-auto text-purple-600 hover:underline normal-case font-bold">
              Send a campaign →
            </Link>
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <button type="button" onClick={() => drill({ metric: 'tokens' })} className="rounded hover:bg-gray-50 py-1">
              <p className="text-2xl font-black text-gray-900">{data.push.totalUsers}</p>
              <p className="text-xs font-bold text-gray-400">reachable users</p>
            </button>
            <button type="button" onClick={() => drill({ metric: 'tokens' })} className="rounded hover:bg-gray-50 py-1">
              <p className="text-2xl font-black text-gray-900">{data.push.totalTokens}</p>
              <p className="text-xs font-bold text-gray-400">devices</p>
            </button>
            {Object.entries(data.push.byPlatform).map(([platform, v]) => (
              <button type="button" key={platform} onClick={() => drill({ metric: 'tokens', key: platform })} className="rounded hover:bg-gray-50 py-1">
                <p className="text-2xl font-black text-gray-900">{v.users}</p>
                <p className="text-xs font-bold text-gray-400 uppercase">{platform} users ({v.tokens} devices)</p>
              </button>
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
      )}
    </div>
  );
}
