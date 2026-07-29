'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Megaphone, X as XIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase-client';
import { useAuth } from '@/lib/auth-context';

interface Announcement {
  id: string;
  title: string;
  body: string;
  type: string;
}

const DISMISSED_KEY = 'wordocious-dismissed-announcements';

function dismissedIds(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? '[]'));
  } catch {
    return new Set();
  }
}

/**
 * The announcements system's first-ever reader: the table, RLS read policy
 * ("active + unexpired, anyone"), and admin authoring UI (admin > Content)
 * have existed since April with nothing displaying them. Shows the newest
 * active announcement as a dismissible brand-styled banner; dismissals are
 * per-announcement in localStorage.
 */
export function AnnouncementsBanner() {
  const { user, isGuest } = useAuth();
  const [dismissed, setDismissed] = useState<Set<string>>(dismissedIds);

  const { data: announcements } = useSWR(
    user || isGuest ? 'announcements-active' : null,
    async () => {
      const { data } = await (supabase as any)
        .from('announcements')
        .select('id, title, body, type')
        .order('created_at', { ascending: false })
        .limit(5);
      return (data ?? []) as Announcement[];
    },
    { revalidateOnFocus: false, dedupingInterval: 5 * 60_000 },
  );

  const current = (announcements ?? []).find((a) => !dismissed.has(a.id));
  if (!current) return null;

  const dismiss = () => {
    const next = new Set(dismissed);
    next.add(current.id);
    setDismissed(next);
    try {
      localStorage.setItem(DISMISSED_KEY, JSON.stringify([...next]));
    } catch {}
  };

  return (
    <div className="fixed top-0 inset-x-0 z-50 px-3 pt-2 pointer-events-none">
      <div
        className="max-w-md mx-auto flex items-start gap-2.5 p-3 pointer-events-auto"
        style={{
          background: 'var(--color-surface)',
          border: '1.5px solid #c4b5fd',
          borderRadius: '16px',
          boxShadow: '0 4px 24px rgba(124, 58, 237, 0.18)',
        }}
      >
        <Megaphone className="w-4 h-4 mt-0.5 shrink-0" style={{ color: '#7c3aed' }} />
        <div className="flex-1 min-w-0">
          <p
            className="text-sm font-black text-transparent bg-clip-text"
            style={{ backgroundImage: 'linear-gradient(135deg, #7c3aed, #ec4899)' }}
          >
            {current.title}
          </p>
          <p className="text-xs font-bold mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            {current.body}
          </p>
        </div>
        <button onClick={dismiss} aria-label="Dismiss announcement" className="p-0.5 shrink-0">
          <XIcon className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
        </button>
      </div>
    </div>
  );
}
