'use client';

import { useEffect, useState } from 'react';
import { Megaphone, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';

interface Announcement {
  id: string;
  title: string;
  body: string;
  type: string;
  active: boolean;
  expires_at: string | null;
  created_at: string;
}

export default function AdminContentPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formBody, setFormBody] = useState('');
  const [formType, setFormType] = useState('info');
  const [formExpiry, setFormExpiry] = useState('');

  // Daily seed override
  const [seedDay, setSeedDay] = useState('');
  const [seedMode, setSeedMode] = useState('DUEL');
  const [seedWord, setSeedWord] = useState('');
  const [seedStatus, setSeedStatus] = useState('');

  const fetchAnnouncements = async () => {
    const res = await fetch('/api/admin/announcements');
    const data = await res.json();
    setAnnouncements(data.announcements || []);
    setLoading(false);
  };

  useEffect(() => { fetchAnnouncements(); }, []);

  const createAnnouncement = async () => {
    if (!formTitle || !formBody) return;
    await fetch('/api/admin/announcements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: formTitle, body: formBody, type: formType,
        expires_at: formExpiry || null,
      }),
    });
    setFormTitle(''); setFormBody(''); setFormExpiry(''); setShowForm(false);
    fetchAnnouncements();
  };

  const toggleAnnouncement = async (id: string, active: boolean) => {
    await fetch(`/api/admin/announcements/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !active }),
    });
    fetchAnnouncements();
  };

  const deleteAnnouncement = async (id: string) => {
    await fetch(`/api/admin/announcements/${id}`, { method: 'DELETE' });
    fetchAnnouncements();
  };

  const overrideSeed = async () => {
    if (!seedDay || !seedWord) return;
    const seed = `daily-${seedDay}-${seedMode}-override`;
    const res = await fetch('/api/admin/games/seeds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        day: seedDay, game_mode: seedMode, seed,
        solutions: [seedWord.toUpperCase()],
      }),
    });
    if (res.ok) {
      setSeedStatus(`Seed set for ${seedDay} (${seedMode}): ${seedWord.toUpperCase()}`);
      setSeedWord('');
    } else {
      setSeedStatus('Failed to set seed');
    }
    setTimeout(() => setSeedStatus(''), 3000);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black text-gray-900">Content</h1>

      {/* Announcements */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
            <Megaphone className="w-4 h-4" /> Announcements
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
              type="text" value={formTitle} onChange={e => setFormTitle(e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Title"
            />
            <textarea
              value={formBody} onChange={e => setFormBody(e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 h-20 resize-none"
              placeholder="Body"
            />
            <div className="flex gap-2">
              <select
                value={formType} onChange={e => setFormType(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-medium"
              >
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="event">Event</option>
              </select>
              <input
                type="date" value={formExpiry} onChange={e => setFormExpiry(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-medium"
                placeholder="Expires (optional)"
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

        {loading ? (
          <div className="h-20 bg-gray-100 rounded animate-pulse" />
        ) : announcements.length === 0 ? (
          <p className="text-sm text-gray-400">No announcements yet.</p>
        ) : (
          <div className="space-y-2">
            {announcements.map(a => (
              <div key={a.id} className={`flex items-start gap-3 p-3 rounded-lg border ${a.active ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'}`}>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-gray-900">{a.title}</span>
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
                <button onClick={() => toggleAnnouncement(a.id, a.active)} className="p-1 text-gray-400 hover:text-gray-600">
                  {a.active ? <ToggleRight className="w-5 h-5 text-green-500" /> : <ToggleLeft className="w-5 h-5" />}
                </button>
                <button onClick={() => deleteAnnouncement(a.id)} className="p-1 text-gray-400 hover:text-red-500">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Daily Seed Override */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-3">Daily Word Override</h2>
        <p className="text-xs text-gray-500 mb-3">Override the daily puzzle word for a future date. This upserts into the daily_seeds table.</p>
        <div className="flex gap-2 flex-wrap">
          <input
            type="date" value={seedDay} onChange={e => setSeedDay(e.target.value)}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-medium"
          />
          <select
            value={seedMode} onChange={e => setSeedMode(e.target.value)}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-medium"
          >
            <option value="DUEL">Classic</option>
            <option value="QUORDLE">QuadWord</option>
            <option value="OCTORDLE">OctoWord</option>
            <option value="SEQUENCE">Succession</option>
            <option value="RESCUE">Deliverance</option>
            <option value="GAUNTLET">Gauntlet</option>
            <option value="PROPERNOUNDLE">ProperNoundle</option>
          </select>
          <input
            type="text" value={seedWord} onChange={e => setSeedWord(e.target.value)}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-medium uppercase"
            placeholder="WORD"
            maxLength={5}
          />
          <button
            onClick={overrideSeed}
            disabled={!seedDay || !seedWord}
            className="px-4 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-bold hover:bg-purple-700 disabled:opacity-50"
          >
            Override
          </button>
        </div>
        {seedStatus && <p className="text-xs text-green-600 font-medium mt-2">{seedStatus}</p>}
      </div>
    </div>
  );
}
