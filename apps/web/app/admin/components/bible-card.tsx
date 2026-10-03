'use client';

import { useEffect, useState } from 'react';
import { BookOpen, Copy, Check, Download } from 'lucide-react';

/** "Latest Bible entry" card: view + copy §NNN, or copy the whole bible —
 *  for pasting into another Claude session without a repo checkout. */
export function BibleCard() {
  const [data, setData] = useState<{ latest: { number: number; text: string } | null; updated: string; entries: number; chars: number } | null>(null);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/bible').then((r) => (r.ok ? r.json() : null)).then(setData).catch(() => {});
  }, []);

  const copy = async (text: string, tag: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(tag);
    setTimeout(() => setCopied(null), 2000);
  };
  const copyFull = async () => {
    const r = await fetch('/api/admin/bible?full=1');
    if (r.ok) copy((await r.json()).full, 'full');
  };

  if (!data?.latest) return null;
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wide flex items-center gap-2">
          <BookOpen className="w-4 h-4" /> Engineering Bible
        </h2>
        <span className="text-xs font-bold text-gray-400">{data.entries} entries · {(data.chars / 1024).toFixed(0)}K</span>
      </div>
      <p className="text-sm font-black text-gray-900 mb-1">Latest: §{data.latest.number}</p>
      <p className="text-xs text-gray-500 line-clamp-3 mb-4">{data.latest.text.replace(/\*\*/g, '').slice(0, 240)}…</p>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setOpen(true)} className="text-xs font-extrabold px-3 py-1.5 rounded-lg bg-purple-600 text-white hover:bg-purple-700">
          View entry
        </button>
        <button onClick={() => copy(data.latest!.text, 'entry')} className="text-xs font-extrabold px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 inline-flex items-center gap-1.5">
          {copied === 'entry' ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />} Copy §{data.latest.number}
        </button>
        <button onClick={copyFull} className="text-xs font-extrabold px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 inline-flex items-center gap-1.5">
          {copied === 'full' ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />} Copy full bible
        </button>
        {/* Jasson's workflow: a real .md file he can attach from Files — his
            phone's share-sheet path uploads zero-byte files (bible §203 era). */}
        <a href="/api/admin/bible?download=1" download className="text-xs font-extrabold px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 inline-flex items-center gap-1.5">
          <Download className="w-3.5 h-3.5" /> Download .md
        </a>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="font-black text-gray-900">Bible §{data.latest.number}</h3>
              <div className="flex gap-2">
                <button onClick={() => copy(data.latest!.text, 'entry')} className="text-xs font-extrabold px-3 py-1.5 rounded-lg bg-purple-600 text-white inline-flex items-center gap-1.5">
                  {copied === 'entry' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} Copy
                </button>
                <button onClick={() => setOpen(false)} className="text-xs font-extrabold px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700">Close</button>
              </div>
            </div>
            <div className="overflow-y-auto p-4">
              <pre className="whitespace-pre-wrap text-xs text-gray-700 font-sans leading-relaxed">{data.latest.text}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
