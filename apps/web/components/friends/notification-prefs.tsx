'use client';

import { useEffect, useRef, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase-client';

// Per-event notification preferences for the Friends pushes (Stats + Friends
// redesign D3.5, founder 2026-09-26). Stored in profiles.notification_prefs
// (jsonb; a missing key means ON) and honored server-side by
// lib/push/broadcast.ts for every friends push that names a category. Friend
// requests always arrive — they are not a category here.

export const PUSH_CATEGORIES = [
  { key: 'race', label: 'Race finish & overtakes', hint: "Monday's recap and when a friend passes you" },
  { key: 'challenge', label: 'Challenges', hint: 'A friend challenges you to a VS Battle' },
  { key: 'nudge', label: 'Nudges & taunts', hint: 'The canned one-liners' },
  { key: 'feed', label: 'Moments', hint: 'Shield gifts and other circle moments' },
] as const;
export type PushCategory = typeof PUSH_CATEGORIES[number]['key'];

export function NotificationPrefs() {
  const { profile, refreshProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const prefs = ((profile as { notification_prefs?: Record<string, boolean> } | null)?.notification_prefs) ?? {};

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [open]);

  if (!profile) return null;
  const anyOff = PUSH_CATEGORIES.some((c) => prefs[c.key] === false);

  const toggle = async (key: PushCategory) => {
    if (saving) return;
    setSaving(key);
    const next = { ...prefs, [key]: prefs[key] === false };
    try {
      await (supabase as any).from('profiles').update({ notification_prefs: next }).eq('id', profile.id);
      await refreshProfile();
    } finally {
      setSaving(null);
    }
  };

  return (
    <div ref={ref} className="relative ml-auto">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Friends notification settings"
        aria-expanded={open}
        className="w-7 h-7 rounded-full flex items-center justify-center active:scale-95 transition-transform"
        style={{ background: 'var(--color-surface-hover)', border: '1.5px solid var(--color-border)' }}
      >
        {anyOff ? <BellOff className="w-3.5 h-3.5" style={{ color: 'var(--color-text-muted)' }} /> : <Bell className="w-3.5 h-3.5" style={{ color: '#7c3aed' }} />}
      </button>
      {open && (
        <div
          className="absolute right-0 top-8 z-40 w-64 p-3 space-y-2"
          style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '14px', boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}
        >
          <div className="text-[10px] font-black uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Friends notifications</div>
          {PUSH_CATEGORIES.map((c) => {
            const on = prefs[c.key] !== false;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => toggle(c.key)}
                className="w-full flex items-center gap-2 text-left"
                style={{ opacity: saving === c.key ? 0.5 : 1 }}
              >
                <span
                  className="w-8 h-4.5 rounded-full relative shrink-0 transition-colors"
                  style={{ background: on ? '#7c3aed' : 'var(--color-border)', height: 18 }}
                  aria-hidden="true"
                >
                  <span className="absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-all" style={{ left: on ? 16 : 2 }} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[11px] font-extrabold" style={{ color: 'var(--color-text)' }}>{c.label}</span>
                  <span className="block text-[9px] font-bold truncate" style={{ color: 'var(--color-text-muted)' }}>{c.hint}</span>
                </span>
              </button>
            );
          })}
          <p className="text-[9px] font-bold" style={{ color: 'var(--color-text-muted)' }}>Friend requests always come through.</p>
        </div>
      )}
    </div>
  );
}
