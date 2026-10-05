'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { HeaderCircle } from '@/components/ui/page-header';
import { PoseArt } from '@/components/ui/soft-popup';
import { alphaHex, cardBarStyle, softBackground, softBorder } from '@/lib/soft-surface';
import { supabase } from '@/lib/supabase-client';
import { useAuth } from '@/lib/auth-context';
import { FamCloseGlyph } from '@/components/ui/family-button';

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

  // K1: a tinted notice card in the announcement's color with its top bar,
  // C peering through his telescope (news!), the Nunito Black headline and the
  // bare close X; slides in from above with a spring (off with Reduce Motion).
  const accent = ANNOUNCEMENT_ACCENT[current.type] ?? '#7c3aed';
  return (
    <div className="fixed top-0 inset-x-0 z-50 px-3 pt-2 pointer-events-none">
      <div
        className="relative max-w-md mx-auto flex items-center gap-2.5 p-2.5 pt-3.5 pr-10 pointer-events-auto overflow-hidden notice-in-top"
        style={{
          background: softBackground(accent, 0.14),
          border: softBorder(accent, 0.14),
          borderRadius: 20,
          boxShadow: `0 10px 28px ${alphaHex(accent, 0.24)}`,
        }}
      >
        <div aria-hidden="true" className="absolute left-0 right-0 top-0" style={cardBarStyle(accent, 6)} />
        <PoseArt pose="art-pose-c-telescope" size={46} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black leading-tight" style={{ color: 'var(--color-text)' }}>
            {current.title}
          </p>
          <p className="text-xs font-bold mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            {current.body}
          </p>
        </div>
        <HeaderCircle label="Dismiss announcement" onClick={dismiss} size={32} className="absolute top-2 right-1">
          <FamCloseGlyph />
        </HeaderCircle>
      </div>
    </div>
  );
}

/** An announcement's color by its admin-chosen type (unknown types read brand purple). */
const ANNOUNCEMENT_ACCENT: Record<string, string> = {
  info: '#7c3aed',
  update: '#3b82f6',
  feature: '#ec4899',
  event: '#ec4899',
  warning: '#f97316',
  maintenance: '#f97316',
  celebration: '#f5a524',
};
