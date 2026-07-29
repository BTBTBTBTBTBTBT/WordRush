'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { Gift, Copy, Check, Crown, Trophy } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase-client';
import { logShareEvent } from '@/lib/share-events';

interface ReferralRow {
  id: string;
  code: string;
  status: 'pending' | 'redeemed' | 'converted' | 'expired' | 'revoked';
  created_at: string;
  expires_at: string;
}

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  pending: { text: 'Waiting', color: 'var(--color-text-muted)' },
  redeemed: { text: 'Friend joined! +3 days', color: '#059669' },
  converted: { text: 'Subscribed! Month earned', color: '#d97706' },
  expired: { text: 'Expired', color: 'var(--color-text-muted)' },
  revoked: { text: 'Revoked', color: '#dc2626' },
};

/**
 * Profile "Gift Pro to friends" panel — the referral program's home.
 * Mechanics borrowed from Viral Loops' best-converting templates
 * (milestones + leaderboard) rendered natively: create up to 3 open
 * invite links, watch their status, see the monthly Top Inviters.
 */
export function InvitePanel() {
  const { user, session } = useAuth();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const { data: invites, mutate } = useSWR(
    user ? ['referrals-mine', user.id] : null,
    async () => {
      const { data } = await (supabase as any)
        .from('referrals')
        .select('id, code, status, created_at, expires_at')
        .eq('inviter_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(20);
      return (data ?? []) as ReferralRow[];
    },
  );

  const { data: leaders } = useSWR('referrals-leaderboard', async () => {
    const res = await fetch('/api/referrals/leaderboard');
    const data = await res.json();
    return (data.leaders ?? []) as Array<{ username: string; count: number }>;
  });

  useEffect(() => {
    if (!copiedCode) return;
    const t = setTimeout(() => setCopiedCode(null), 2000);
    return () => clearTimeout(t);
  }, [copiedCode]);

  if (!user) return null;

  const openInvites = (invites ?? []).filter(
    (i) => i.status === 'pending' && new Date(i.expires_at).getTime() > Date.now(),
  );
  const slotsLeft = Math.max(0, 3 - openInvites.length);
  const redemptions = (invites ?? []).filter((i) => i.status === 'redeemed' || i.status === 'converted').length;

  const handleCreate = async () => {
    if (!session) return;
    setError('');
    setCreating(true);
    try {
      const res = await fetch('/api/referrals/create', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not create an invite.');
      } else {
        await mutate();
        await copyLink(data.code);
      }
    } catch {
      setError('Could not create an invite.');
    }
    setCreating(false);
  };

  const copyLink = async (code: string) => {
    const url = `https://wordocious.com/join/${code}`;
    const text = `I'm gifting you 7 days of Wordocious Pro — daily word puzzles, battles, the works. Claim it here: ${url}`;
    try {
      if (navigator.share) {
        await navigator.share({ text });
      } else {
        await navigator.clipboard.writeText(text);
      }
      setCopiedCode(code);
      logShareEvent('link_invite', '', 'referral');
    } catch {}
  };

  return (
    <div
      className="p-5 space-y-4"
      style={{ background: 'var(--color-surface)', border: '1.5px solid #c4b5fd', borderRadius: '20px' }}
    >
      <div className="flex items-center gap-2">
        <Gift className="w-5 h-5" style={{ color: '#7c3aed' }} />
        <h3 className="text-base font-black" style={{ color: 'var(--color-text)' }}>Gift Pro to Friends</h3>
      </div>

      <p className="text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>
        Each friend gets <span style={{ color: '#d97706' }}>7 days of Pro</span> free. You get
        +3 days when they join — and a <span style={{ color: '#d97706' }}>free month</span> if
        they subscribe. {redemptions >= 3 ? null : <>3 friends = +4 streak shields.</>}
      </p>

      <button
        onClick={handleCreate}
        disabled={creating || slotsLeft === 0}
        className="w-full py-2.5 rounded-xl text-sm font-black text-white btn-3d disabled:opacity-50"
        style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', boxShadow: '0 4px 0 #4c1d95' }}
      >
        {creating ? 'Creating…' : slotsLeft === 0 ? 'All 3 invites out — slots free when friends join' : `Create invite link (${slotsLeft} left)`}
      </button>
      {error && <p className="text-xs font-bold" style={{ color: '#dc2626' }}>{error}</p>}

      {(invites ?? []).length > 0 && (
        <div className="space-y-1.5">
          {(invites ?? []).slice(0, 6).map((inv) => {
            const label = STATUS_LABEL[inv.status] ?? STATUS_LABEL.pending;
            const expired = inv.status === 'pending' && new Date(inv.expires_at).getTime() < Date.now();
            return (
              <div key={inv.id} className="flex items-center justify-between gap-2 text-xs font-bold">
                <span className="font-mono tracking-widest" style={{ color: 'var(--color-text)' }}>{inv.code}</span>
                <span style={{ color: expired ? 'var(--color-text-muted)' : label.color }}>
                  {expired ? 'Expired' : label.text}
                </span>
                {inv.status === 'pending' && !expired && (
                  <button onClick={() => copyLink(inv.code)} aria-label="Copy invite link" className="p-1">
                    {copiedCode === inv.code
                      ? <Check className="w-3.5 h-3.5" style={{ color: '#059669' }} />
                      : <Copy className="w-3.5 h-3.5" style={{ color: '#7c3aed' }} />}
                  </button>
                )}
                {inv.status === 'converted' && <Crown className="w-3.5 h-3.5" style={{ color: '#d97706' }} />}
              </div>
            );
          })}
        </div>
      )}

      {(leaders ?? []).length > 0 && (
        <div className="pt-2" style={{ borderTop: '1px solid var(--color-border)' }}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Trophy className="w-3.5 h-3.5" style={{ color: '#d97706' }} />
            <span className="text-[11px] font-black uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
              Top Inviters this month
            </span>
          </div>
          {(leaders ?? []).map((l, i) => (
            <div key={l.username} className="flex items-center justify-between text-xs font-bold py-0.5">
              <span style={{ color: 'var(--color-text)' }}>{i + 1}. {l.username}</span>
              <span style={{ color: 'var(--color-text-muted)' }}>{l.count} joined</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
