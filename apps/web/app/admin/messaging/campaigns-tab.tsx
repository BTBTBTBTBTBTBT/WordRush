'use client';

import { useEffect, useState } from 'react';
import { BellRing } from 'lucide-react';
import { TabIntro, Section } from '../components/admin-ui';

// Messaging & Push > Campaigns: the composer over the live push plumbing
// (moved here from Marketing). Sending keeps its confirm and its audit entry
// (POST /api/admin/push/campaign).
const SEGMENT_LABELS: Record<string, string> = {
  everyone: 'Everyone',
  lapsed7d: 'Lapsed 7d',
  pro: 'Pro',
  streak: 'Streak holders',
};

export default function CampaignsTab() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [history, setHistory] = useState<{ created_at: string; details: any }[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [segment, setSegment] = useState('everyone');
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const load = () =>
    fetch('/api/admin/push/campaign')
      .then((r) => r.json())
      .then((d) => { setCounts(d.counts ?? {}); setHistory(d.history ?? []); })
      .catch(() => {});
  useEffect(() => { load(); }, []);

  const send = async (test: boolean) => {
    if (!title.trim() || !body.trim()) { setStatus('Title and message are required.'); return; }
    if (!test && !window.confirm(
      `Send "${title.trim()}" to ${SEGMENT_LABELS[segment]} (${counts[segment] ?? '?'} reachable)? This cannot be unsent.`,
    )) return;
    setBusy(test ? 'test' : 'send');
    setStatus(null);
    try {
      const res = await fetch('/api/admin/push/campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body, segment, test }),
      });
      const d = await res.json();
      if (!res.ok) setStatus(d.error ?? 'Send failed.');
      else {
        setStatus(test
          ? `Test sent to you (${d.sent} delivered).`
          : `Campaign sent: ${d.sent} delivered, ${d.failed} failed, ${d.targeted} targeted.`);
        if (!test) { setTitle(''); setBody(''); }
        load();
      }
    } catch { setStatus('Send failed.'); }
    setBusy(null);
  };

  return (
    <div className="space-y-6">
    <TabIntro>Send a custom push to a segment of players. Test it on your own devices first: a sent campaign cannot be unsent. Each send is written to the admin audit log.</TabIntro>
    <Section title="Push campaigns" icon={BellRing} className="max-w-2xl">
      <div className="space-y-2">
        <input
          value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60}
          placeholder="Title… e.g. NEW PUZZLES!"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-violet-300"
        />
        <textarea
          value={body} onChange={(e) => setBody(e.target.value)} maxLength={240} rows={2}
          placeholder="Message… A fresh set just dropped."
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none"
        />
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(SEGMENT_LABELS).map(([key, label]) => (
            <button key={key} onClick={() => setSegment(key)}
              className={`text-[11px] font-black rounded-full px-2.5 py-1 border ${
                segment === key
                  ? 'border-violet-400 bg-violet-50 text-violet-700'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
              {label} ({counts[key] ?? '…'})
            </button>
          ))}
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={() => send(true)} disabled={busy !== null}
            className="text-xs font-black rounded-lg px-3 py-2 bg-violet-600 text-white disabled:opacity-50">
            {busy === 'test' ? 'Sending…' : 'Send test to me'}
          </button>
          <button onClick={() => send(false)} disabled={busy !== null}
            className="text-xs font-black rounded-lg px-3 py-2 border border-gray-300 text-gray-600 disabled:opacity-50">
            {busy === 'send' ? 'Sending…' : 'Send campaign'}
          </button>
        </div>
        {status && <p className="text-xs font-bold text-gray-600">{status}</p>}
        {history.length > 0 && (
          <div className="pt-2 border-t border-gray-100">
            <p className="text-[10px] font-black tracking-wider text-gray-400 mb-1">RECENT</p>
            {history.slice(0, 5).map((h, i) => (
              <div key={i} className="text-[11px] font-semibold text-gray-500 flex justify-between gap-2">
                <span className="truncate">{h.details?.title} · {SEGMENT_LABELS[h.details?.segment] ?? h.details?.segment}</span>
                <span className="tabular-nums shrink-0">{h.details?.sent ?? 0} sent</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Section>
    </div>
  );
}
