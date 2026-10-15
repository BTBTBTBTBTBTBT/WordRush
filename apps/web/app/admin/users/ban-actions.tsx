'use client';

import { useState } from 'react';

/**
 * Ban / unban writes shared by the Users & Moderation tabs. Every ban records a
 * reason (stored as the profile's ban_reason and written to the admin audit
 * log) and asks for a confirm first; a failed request is surfaced, never
 * swallowed.
 */

// Preset ban reasons. Free text is the fallback.
export const BAN_REASONS = ['Inappropriate username', 'Harassment or abuse', 'Spam or advertising', 'Cheating', 'Underage'];

export function useBanActions(onDone: () => Promise<void> | void) {
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const send = async (userId: string, ban: boolean, reason?: string): Promise<boolean> => {
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/ban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ban, reason: ban ? reason : undefined }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error ?? `Request failed (${res.status})`);
      }
      await onDone();
      return true;
    } catch (e: any) {
      setActionError(`${ban ? 'Ban' : 'Unban'} failed: ${e?.message || 'unknown error'}`);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const unban = (u: { id: string; username: string }) => {
    if (!window.confirm(`Unban ${u.username}?`)) return;
    void send(u.id, false);
  };

  return { busy, actionError, setActionError, send, unban };
}
