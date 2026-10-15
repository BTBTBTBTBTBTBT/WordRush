'use client';

import { useEffect, useState } from 'react';
import { Megaphone, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { TabIntro, ErrorNote } from '../components/admin-ui';

// Messaging & Push > Announcements: authored HERE, displayed by all three apps.
// Push reach and health are the Push health tab; campaign SENDING is Campaigns.
interface MessagingData {
  announcements: { id: string; title: string; body: string; type: string; state: 'live' | 'scheduled' | 'expired' | 'disabled'; starts_at: string | null; expires_at: string | null; created_at: string }[];
}

const STATE_STYLES: Record<string, string> = {
  live: 'text-green-700 bg-green-50',
  scheduled: 'text-blue-700 bg-blue-50',
  expired: 'text-gray-500 bg-gray-100',
  disabled: 'text-red-600 bg-red-50',
};

export default function AnnouncementsTab() {
  const [data, setData] = useState<MessagingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formBody, setFormBody] = useState('');
  const [formType, setFormType] = useState('info');
  const [formExpiry, setFormExpiry] = useState('');

  const [actionError, setActionError] = useState<string | null>(null);

  const load = () => {
    setLoadFailed(false);
    return fetch('/api/admin/messaging')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => { setLoadFailed(true); setLoading(false); });
  };

  // Writes: surface a failed request instead of reloading as if it worked.
  const write = async (url: string, init: RequestInit, what: string): Promise<boolean> => {
    setActionError(null);
    try {
      const res = await fetch(url, init);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setActionError(`Could not ${what}: ${j?.error ?? `request failed (${res.status})`}`);
        return false;
      }
      return true;
    } catch {
      setActionError(`Could not ${what}: the server could not be reached.`);
      return false;
    }
  };
  useEffect(() => { load(); }, []);

  const createAnnouncement = async () => {
    if (!formTitle || !formBody) return;
    const ok = await write('/api/admin/announcements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: formTitle, body: formBody, type: formType, expires_at: formExpiry || null }),
    }, 'create the announcement');
    if (!ok) return; // keep the form open so nothing typed is lost
    setFormTitle(''); setFormBody(''); setFormExpiry(''); setShowForm(false);
    load();
  };

  const toggleAnnouncement = async (id: string, disabled: boolean) => {
    const ok = await write(`/api/admin/announcements/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: disabled }),
    }, 'update the announcement');
    if (ok) load();
  };

  const deleteAnnouncement = async (id: string) => {
    const ok = await write(`/api/admin/announcements/${id}`, { method: 'DELETE' }, 'delete the announcement');
    if (ok) load();
  };

  if (loading) return <div className="h-60 bg-gray-100 rounded-xl animate-pulse" />;
  if (!data || loadFailed) return <ErrorNote>Could not load announcements. <button type="button" onClick={load} className="underline">Try again</button></ErrorNote>;

  const live = data.announcements.filter((a) => a.state === 'live');

  return (
    <div className="space-y-6">
      <TabIntro>Short notices shown inside all three apps. Push messages are on the Campaigns and Push health tabs.</TabIntro>
      {actionError && <p className="text-sm font-bold text-red-500">{actionError}</p>}

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
    </div>
  );
}
