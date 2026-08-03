'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Megaphone, BellRing, Send, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { useDrill } from '../components/drill-panel';

// The one page for everything Wordocious says to players: announcements
// (authored HERE, displayed by all three apps) and push infrastructure
// (reachability + APNs/FCM health + smoke test). Campaign SENDING lives on
// Marketing — this page is the plumbing and the in-app channel.
// (Absorbed the old Content page 2026-08-02: authoring and monitoring were
// split across two pages for no reason once Content's word-override died.)
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
  const drill = useDrill();
  const [data, setData] = useState<MessagingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formBody, setFormBody] = useState('');
  const [formType, setFormType] = useState('info');
  const [formExpiry, setFormExpiry] = useState('');

  const load = () =>
    fetch('/api/admin/messaging')
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const sendTest = async () => {
    setTesting(true); setTestResult(null);
    try {
      const res = await fetch('/api/admin/push/test', { method: 'POST' });
      const json = await res.json();
      setTestResult(res.ok ? 'Test push sent to your devices.' : json.error || 'Failed.');
    } catch { setTestResult('Failed to reach the push API.'); }
    setTesting(false);
  };

  const createAnnouncement = async () => {
    if (!formTitle || !formBody) return;
    await fetch('/api/admin/announcements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: formTitle, body: formBody, type: formType, expires_at: formExpiry || null }),
    });
    setFormTitle(''); setFormBody(''); setFormExpiry(''); setShowForm(false);
    load();
  };

  const toggleAnnouncement = async (id: string, disabled: boolean) => {
    await fetch(`/api/admin/announcements/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: disabled }),
    });
    load();
  };

  const deleteAnnouncement = async (id: string) => {
    await fetch(`/api/admin/announcements/${id}`, { method: 'DELETE' });
    load();
  };

  if (loading) return <div className="h-60 bg-gray-100 rounded-xl animate-pulse" />;
  if (!data) return <p className="text-sm text-gray-400">Failed to load messaging.</p>;

  const live = data.announcements.filter((a) => a.state === 'live');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black text-gray-900">Messaging</h1>

      {/* Announcements: authored here, shown in all three apps */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
            <Megaphone className="w-4 h-4" /> Announcements — {live.length} live
          </h2>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-bold hover:bg-purple-700"
          >
            <Plus className="w-3 h-3" /> New
          </button>
        </div>

        {showForm && (
          <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-2">
            <input
              type="text" value={formTitle} onChange={(e) => setFormTitle(e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Title"
            />
            <textarea
              value={formBody} onChange={(e) => setFormBody(e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 h-20 resize-none"
              placeholder="Body"
            />
            <div className="flex gap-2">
              <select
                value={formType} onChange={(e) => setFormType(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-medium"
              >
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="event">Event</option>
              </select>
              <input
                type="date" value={formExpiry} onChange={(e) => setFormExpiry(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-medium"
              />
              <button
                onClick={createAnnouncement}
                className="px-4 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-bold hover:bg-purple-700"
              >
                Create
              </button>
            </div>
          </div>
        )}

        {data.announcements.length === 0 ? (
          <p className="text-sm text-gray-400">No announcements yet.</p>
        ) : (
          <div className="space-y-2">
            {data.announcements.map((a) => (
              <div key={a.id} className={`flex items-start gap-3 p-3 rounded-lg border ${a.state === 'disabled' ? 'border-gray-100 bg-gray-50 opacity-60' : 'border-gray-200 bg-white'}`}>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-gray-900">{a.title}</span>
                    <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded uppercase ${STATE_STYLES[a.state]}`}>{a.state}</span>
                    <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
                      a.type === 'warning' ? 'text-amber-600 bg-amber-50' :
                      a.type === 'event' ? 'text-blue-600 bg-blue-50' :
                      'text-gray-500 bg-gray-100'
                    }`}>{a.type}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{a.body}</p>
                  <p className="text-[10px] text-gray-400 mt-1">
                    Created {new Date(a.created_at).toLocaleDateString()}
                    {a.expires_at && ` · Expires ${new Date(a.expires_at).toLocaleDateString()}`}
                  </p>
                </div>
                <button onClick={() => toggleAnnouncement(a.id, a.state === 'disabled')} className="p-1 text-gray-400 hover:text-gray-600" aria-label="Toggle announcement">
                  {a.state !== 'disabled' ? <ToggleRight className="w-5 h-5 text-green-500" /> : <ToggleLeft className="w-5 h-5" />}
                </button>
                <button onClick={() => deleteAnnouncement(a.id)} className="p-1 text-gray-400 hover:text-red-500" aria-label="Delete announcement">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Push infrastructure: reachability + provider health + smoke test.
          Campaign composing/sending lives on Marketing. */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
          <BellRing className="w-4 h-4" /> Push Reach
          <Link href="/admin/marketing" className="ml-auto text-purple-600 hover:underline normal-case font-bold">
            Send a campaign on Marketing →
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
    </div>
  );
}
