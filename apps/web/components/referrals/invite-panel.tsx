'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { Gift, Copy, Check, Crown, Trophy, X as XIcon } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase-client';
import { logShareEvent } from '@/lib/share-events';
import { confirmDialog } from '@/components/ui/confirm-dialog';

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
  converted: { text: 'Subscribed! Reward earned', color: '#d97706' },
  expired: { text: 'Expired', color: 'var(--color-text-muted)' },
  revoked: { text: 'Cancelled', color: 'var(--color-text-muted)' },
};

/** "29d left" / "12h left" for a pending invite's expiry. */
function timeLeft(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 'expired';
  const days = Math.floor(ms / 86_400_000);
  if (days >= 1) return `${days}d left`;
  return `${Math.max(1, Math.floor(ms / 3_600_000))}h left`;
}

/**
 * Profile "Gift Pro to friends" panel — the referral program's home.
 * Mechanics borrowed from Viral Loops' best-converting templates
 * (milestones + leaderboard) rendered natively: create up to 3 open
 * invite links, watch their status, see the monthly Top Inviters.
 */
export function InvitePanel() {
  const { user, session, isProActive } = useAuth();
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

  // Gifting Pro is a Pro benefit — a free account must never see this panel.
  // `isProActive` is false while the profile is still loading, so the panel
  // fades in for subscribers rather than flashing for everyone. The real gate
  // is server-side in /api/referrals/create; this only keeps the UI honest.
  if (!user || !isProActive) return null;

  const openInvites = (invites ?? []).filter(
    (i) => i.status === 'pending' && new Date(i.expires_at).getTime() > Date.now(),
  );
  const slotsLeft = Math.max(0, 3 - openInvites.length);
  const redemptions = (invites ?? []).filter((i) => i.status === 'redeemed' || i.status === 'converted').length;
  // Dead invites (cancelled / expired) disappear entirely — a spent random
  // code is noise to the player. The rows live on in the DB for the admin
  // Referrals tab's history.
  const visibleInvites = (invites ?? []).filter(
    (i) => i.status !== 'revoked'
      && !(i.status === 'pending' && new Date(i.expires_at).getTime() < Date.now()),
  );

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

  const cancelInvite = async (id: string, code: string) => {
    if (!session) return;
    const ok = await confirmDialog({
      title: `Cancel invite ${code}?`,
      message: 'The link stops working immediately and your invite slot frees up.',
      confirmText: 'Cancel invite',
      cancelText: 'Keep it',
    });
    if (!ok) return;
    await fetch('/api/referrals/cancel', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    await mutate();
  };

  const copyLink = async (code: string) => {
    const url = `https://wordocious.com/join/${code}`;
    const text = `I'm gifting you 7 days of Wordocious Pro — daily word puzzles, battles, the works.`;
    try {
      if (navigator.share) {
        // Pass url SEPARATELY from text: iOS then renders the share-sheet
        // preview as a link (site touch icon — the W) instead of the generic
        // plain-text "A|" glyph, and Messages unfurls the branded OG card.
        await navigator.share({ text, url });
      } else {
        await navigator.clipboard.writeText(`${text} Claim it here: ${url}`);
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
        <h3
          className="text-base font-black tracking-tight text-transparent bg-clip-text"
          style={{ backgroundImage: 'linear-gradient(135deg, #7c3aed, #ec4899)' }}
        >
          GIFT PRO TO FRIENDS
        </h3>
      </div>

      <p className="text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>
        Each friend gets <span style={{ color: '#d97706' }}>7 days of Pro</span> free. You get
        +3 days when they join, a <span style={{ color: '#d97706' }}>free month</span> if they
        subscribe — and <span style={{ color: '#d97706' }}>3 free months</span> if they go
        annual. {redemptions >= 3 ? null : <>3 friends = +4 streak shields.</>}
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

      {visibleInvites.length > 0 && (
        <div className="space-y-1.5">
          {visibleInvites.slice(0, 6).map((inv) => {
            const label = STATUS_LABEL[inv.status] ?? STATUS_LABEL.pending;
            const open = inv.status === 'pending';
            return (
              <div key={inv.id} className="flex items-center gap-2 text-xs font-bold">
                <span className="font-mono tracking-widest" style={{ color: 'var(--color-text)' }}>{inv.code}</span>
                <span className="flex-1" style={{ color: label.color }}>
                  {label.text}
                  {open && (
                    <span style={{ color: 'var(--color-text-muted)' }}> · {timeLeft(inv.expires_at)}</span>
                  )}
                </span>
                {open && (
                  <>
                    <button onClick={() => copyLink(inv.code)} aria-label="Share invite link" className="p-1">
                      {copiedCode === inv.code
                        ? <Check className="w-3.5 h-3.5" style={{ color: '#059669' }} />
                        : <Copy className="w-3.5 h-3.5" style={{ color: '#7c3aed' }} />}
                    </button>
                    <button
                      onClick={() => cancelInvite(inv.id, inv.code)}
                      aria-label="Cancel invite"
                      className="p-1"
                    >
                      <XIcon className="w-3.5 h-3.5" style={{ color: 'var(--color-text-muted)' }} />
                    </button>
                  </>
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
