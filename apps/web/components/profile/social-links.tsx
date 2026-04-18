'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase-client';
import { Pencil, Check, X as XIcon, Globe } from 'lucide-react';

export type SocialLinks = {
  twitter?: string;
  instagram?: string;
  tiktok?: string;
  threads?: string;
  discord?: string;
  website?: string;
};

// Inline brand SVGs so we don't pull in another icon package. Keep them
// monochrome — the parent sets color via currentColor.
const SocialIcon = ({ platform, className }: { platform: keyof SocialLinks; className?: string }) => {
  switch (platform) {
    case 'twitter':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.25 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      );
    case 'instagram':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 1.366.062 2.633.326 3.608 1.301.975.975 1.24 2.242 1.301 3.608.058 1.266.07 1.646.07 4.85s-.012 3.584-.07 4.85c-.062 1.366-.326 2.633-1.301 3.608-.975.975-2.242 1.24-3.608 1.301-1.266.058-1.646.07-4.85.07s-3.584-.012-4.85-.07c-1.366-.062-2.633-.326-3.608-1.301-.975-.975-1.24-2.242-1.301-3.608C2.175 15.584 2.163 15.204 2.163 12s.012-3.584.07-4.85c.062-1.366.326-2.633 1.301-3.608.975-.975 2.242-1.24 3.608-1.301C8.416 2.175 8.796 2.163 12 2.163zm0 1.837c-3.155 0-3.507.012-4.744.068-.933.043-1.44.2-1.775.332-.446.173-.766.38-1.101.715-.335.335-.542.655-.715 1.1-.133.336-.29.843-.332 1.776-.056 1.237-.068 1.59-.068 4.744s.012 3.507.068 4.744c.043.933.2 1.44.332 1.775.173.446.38.766.715 1.101.335.335.655.542 1.1.715.336.133.843.29 1.776.332 1.237.056 1.59.068 4.744.068s3.507-.012 4.744-.068c.933-.043 1.44-.2 1.775-.332.446-.173.766-.38 1.101-.715.335-.335.542-.655.715-1.1.133-.336.29-.843.332-1.776.056-1.237.068-1.59.068-4.744s-.012-3.507-.068-4.744c-.043-.933-.2-1.44-.332-1.775-.173-.446-.38-.766-.715-1.101-.335-.335-.655-.542-1.1-.715-.336-.133-.843-.29-1.776-.332C15.507 4.012 15.155 4 12 4zm0 3.131a4.869 4.869 0 1 1 0 9.738 4.869 4.869 0 0 1 0-9.738zm0 8.031a3.162 3.162 0 1 0 0-6.324 3.162 3.162 0 0 0 0 6.324zm6.406-8.231a1.137 1.137 0 1 1-2.274 0 1.137 1.137 0 0 1 2.274 0z" />
        </svg>
      );
    case 'tiktok':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43V9.01a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.84-.44z" />
        </svg>
      );
    case 'threads':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
          <path d="M17.28 11.13c-.09-.04-.18-.08-.27-.12-.16-2.93-1.77-4.62-4.46-4.64h-.04c-1.6 0-2.94.68-3.76 1.93l1.48 1.01c.61-.93 1.57-1.13 2.28-1.13h.03c.89.01 1.56.27 2 .77.31.37.53.88.63 1.52-.76-.13-1.58-.17-2.46-.12-2.48.14-4.08 1.6-3.97 3.62.05.99.57 1.85 1.46 2.4.75.47 1.72.7 2.72.64 1.33-.07 2.37-.58 3.1-1.51.55-.7.9-1.61 1.05-2.76.63.38.97.88 1.16 1.49.32 1.04.34 2.76-1.06 4.16-1.22 1.22-2.69 1.75-4.91 1.77-2.47-.02-4.33-.81-5.54-2.35C4.89 16.6 4.31 14.66 4.3 12c.01-2.66.58-4.6 1.71-5.79 1.21-1.54 3.08-2.33 5.54-2.35 2.5.02 4.4.82 5.65 2.38.61.76 1.07 1.72 1.38 2.85l1.78-.47c-.37-1.39-.95-2.58-1.74-3.56C16.95 3.02 14.59 2.02 11.55 2h-.01c-3.03.02-5.35 1.02-6.91 2.96C3.19 6.68 2.48 9.11 2.47 12v.01c.02 2.89.72 5.32 2.16 7.04 1.56 1.94 3.88 2.94 6.91 2.96h.01c2.7-.02 4.61-.73 6.17-2.28 2.07-2.07 2-4.67 1.32-6.26-.49-1.15-1.43-2.08-2.76-2.34zm-4.24 3.88c-1.11.06-2.27-.44-2.33-1.48-.04-.77.55-1.63 2.4-1.73.21-.01.42-.02.62-.02.67 0 1.3.07 1.87.19-.21 2.62-1.44 3-2.56 3.04z" />
        </svg>
      );
    case 'discord':
      return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
          <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.245.197.372.291a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.893.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
        </svg>
      );
    case 'website':
      return <Globe className={className} />;
  }
};

const PLATFORMS: Array<{ key: keyof SocialLinks; label: string; placeholder: string; color: string; buildUrl: (v: string) => string }> = [
  { key: 'twitter',   label: 'Twitter / X',  placeholder: 'username',              color: '#000000', buildUrl: (v) => `https://twitter.com/${encodeURIComponent(v)}` },
  { key: 'instagram', label: 'Instagram',    placeholder: 'username',              color: '#e1306c', buildUrl: (v) => `https://instagram.com/${encodeURIComponent(v)}` },
  { key: 'tiktok',    label: 'TikTok',       placeholder: 'username',              color: '#000000', buildUrl: (v) => `https://tiktok.com/@${encodeURIComponent(v)}` },
  { key: 'threads',   label: 'Threads',      placeholder: 'username',              color: '#000000', buildUrl: (v) => `https://threads.net/@${encodeURIComponent(v)}` },
  { key: 'discord',   label: 'Discord',      placeholder: 'username',              color: '#5865f2', buildUrl: (v) => `https://discord.com/users/${encodeURIComponent(v)}` },
  { key: 'website',   label: 'Website',      placeholder: 'https://example.com',   color: '#2563eb', buildUrl: (v) => v },
];

function sanitizeHandle(platform: keyof SocialLinks, raw: string): string {
  const v = raw.trim();
  if (!v) return '';
  if (platform === 'website') {
    // Only allow http(s) URLs; reject anything else to avoid javascript: etc.
    try {
      const u = new URL(v.startsWith('http') ? v : `https://${v}`);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
      return u.toString();
    } catch {
      return '';
    }
  }
  // Handle inputs: strip leading @, whitespace, and any URL-unsafe chars.
  return v.replace(/^@+/, '').replace(/\s+/g, '');
}

interface DisplayProps {
  links?: SocialLinks | null;
}

export function SocialLinksDisplay({ links }: DisplayProps) {
  const entries = PLATFORMS.filter((p) => links?.[p.key]);
  if (entries.length === 0) return null;
  return (
    <div className="flex items-center gap-2 flex-wrap justify-center">
      {entries.map((p) => {
        const value = links![p.key]!;
        const href = p.buildUrl(value);
        return (
          <a
            key={p.key}
            href={href}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="w-9 h-9 rounded-full flex items-center justify-center transition-transform active:scale-90"
            style={{ background: '#ffffff', border: '1.5px solid #ede9f6', color: p.color }}
            aria-label={p.label}
            title={p.label}
          >
            <SocialIcon platform={p.key} className="w-4 h-4" />
          </a>
        );
      })}
    </div>
  );
}

interface EditorProps {
  userId: string;
  initial?: SocialLinks | null;
  onSaved?: (links: SocialLinks) => void;
}

export function SocialLinksEditor({ userId, initial, onSaved }: EditorProps) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<SocialLinks>(initial ?? {});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setSaving(true);
    setError('');
    const cleaned: SocialLinks = {};
    for (const p of PLATFORMS) {
      const v = sanitizeHandle(p.key, values[p.key] ?? '');
      if (v) cleaned[p.key] = v;
    }
    try {
      const { error: updErr } = await (supabase as any)
        .from('profiles')
        .update({ social_links: cleaned })
        .eq('id', userId);
      if (updErr) throw updErr;
      onSaved?.(cleaned);
      setOpen(false);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <div className="flex items-center gap-2 flex-wrap justify-center">
        <SocialLinksDisplay links={initial} />
        <button
          onClick={() => { setValues(initial ?? {}); setOpen(true); }}
          className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-1 rounded-full"
          style={{ background: '#f3f0ff', border: '1.5px solid #ede9f6', color: '#7c3aed' }}
        >
          <Pencil className="w-3 h-3" />
          {initial && Object.keys(initial).length > 0 ? 'Edit socials' : 'Add socials'}
        </button>
      </div>
    );
  }

  return (
    <div
      className="w-full max-w-sm mx-auto p-4 space-y-2.5"
      style={{ background: '#ffffff', border: '1.5px solid #ede9f6', borderRadius: '16px' }}
    >
      {PLATFORMS.map((p) => (
        <div key={p.key} className="flex items-center gap-2">
          <span className="w-6 h-6 flex items-center justify-center flex-shrink-0" style={{ color: p.color }}>
            <SocialIcon platform={p.key} className="w-4 h-4" />
          </span>
          <input
            type="text"
            value={values[p.key] ?? ''}
            onChange={(e) => setValues((v) => ({ ...v, [p.key]: e.target.value }))}
            placeholder={p.placeholder}
            className="flex-1 text-xs font-bold px-2.5 py-1.5 outline-none"
            style={{ background: '#f8f7ff', border: '1.5px solid #ede9f6', borderRadius: '8px', color: '#1a1a2e' }}
          />
        </div>
      ))}
      {error && <p className="text-[10px] font-bold text-red-500">{error}</p>}
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => setOpen(false)}
          disabled={saving}
          className="flex-1 py-1.5 rounded-lg text-xs font-black"
          style={{ background: '#f8f7ff', border: '1.5px solid #ede9f6', color: '#1a1a2e' }}
        >
          <XIcon className="w-3 h-3 inline mr-1" />
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 py-1.5 rounded-lg text-xs font-black text-white disabled:opacity-50"
          style={{ background: '#7c3aed' }}
        >
          <Check className="w-3 h-3 inline mr-1" />
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}
