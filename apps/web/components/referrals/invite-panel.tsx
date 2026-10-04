'use client';

import { useEffect, useState } from 'react';
import { isCredit, readDismissed, showClearAll, visibleCreditRows, writeDismissed } from '@/lib/referral-credits';
import useSWR from 'swr';
import { X as XIcon } from 'lucide-react';
import { Icon3D } from '@/components/ui/icon3d';
import { CandyButton } from '@/components/ui/candy-button';
import { CastButton } from '@/components/ui/cast-button';
import { SoftNum } from '@/components/ui/soft-number';
import { GiftProCard, InviteCodeTiles, InviteSentCard, PendingPill } from '@/components/friends/invite-screens';
import { FR_LOOK, rowStripe } from '@/lib/friends-look';
import { GIFT_SLOTS, giftShareText, giftsLeft } from '@/lib/invite-screens';
import { softMix } from '@/lib/soft-surface';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase-client';
import { logShareEvent } from '@/lib/share-events';
import { confirmDialog } from '@/components/ui/confirm-dialog';
import { FeedbackPill } from '@/components/game/feedback-toast';

interface ReferralRow {
  id: string;
  code: string;
  status: 'pending' | 'redeemed' | 'converted' | 'expired' | 'revoked';
  created_at: string;
  expires_at: string;
  /** §251: who redeemed it — resolved to a username for settled rows. */
  invitee_id?: string | null;
  converted_plan?: string | null;
  inviteeName?: string | null;
}

// The panel lives on the light-only Friends page: light inks in every theme.
const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  pending: { text: 'Waiting', color: FR_LOOK.sub },
  redeemed: { text: 'Friend joined! +3 days', color: '#047857' },
  converted: { text: 'Subscribed! Reward earned', color: '#b45309' },
  expired: { text: 'Expired', color: FR_LOOK.sub },
  revoked: { text: 'Canceled', color: FR_LOOK.sub },
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
 * Finishing build T4 (docs/FINISH_SPEC.md): "GIFT A WEEK OF PRO" — O3 with
 * the crowned gift box on the gold card, the soft-number 7 DAYS badge, the
 * gifts-left counter, the gold candy "Send a gift"; open gifts show their code
 * on glossy letter tiles with a "Pending" pill; after sending, the T1
 * invite-sent screen.
 */
export function InvitePanel() {
  const { user, session, isProActive } = useAuth();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  /** T1: the gift just sent (its invite-sent screen shows until Done). */
  const [sentCode, setSentCode] = useState<string | null>(null);
  /** Founder 10-03: credit notices the player X'd (local list + the server flag), and the ones fading out. */
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(() => new Set());
  const [leaving, setLeaving] = useState<ReadonlySet<string>>(() => new Set());
  useEffect(() => {
    if (!user) return;
    setDismissed(readDismissed(user.id));
    if (!session) return;
    let alive = true;
    // Other devices' dismissals (referrals.inviter_dismissed_at); [] until that column ships.
    fetch('/api/referrals/dismiss', { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then((r) => r.json())
      .then((d) => { if (alive && Array.isArray(d?.ids) && d.ids.length) setDismissed(writeDismissed(user.id, d.ids)); })
      .catch(() => {});
    return () => { alive = false; };
  }, [user, session]);
  const dismissCredits = (ids: string[]) => {
    if (!user || !ids.length) return;
    setLeaving((prev) => new Set([...prev, ...ids]));
    // The row fades + collapses (opacity / height), then leaves the list for good.
    window.setTimeout(() => setDismissed(writeDismissed(user.id, ids)), 220);
    if (session) {
      void fetch('/api/referrals/dismiss', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      }).catch(() => {});
    }
  };

  const { data: invites, mutate } = useSWR(
    user ? ['referrals-mine', user.id] : null,
    async () => {
      const { data } = await (supabase as any)
        .from('referrals')
        .select('id, code, status, created_at, expires_at, invitee_id, converted_plan')
        .eq('inviter_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(20);
      const rows = (data ?? []) as ReferralRow[];
      // §251 (founder's sister: "she should be able to see what friends
      // correspond to those invites"): resolve redeemers to usernames —
      // profiles is world-readable, so one batched read names every row.
      const ids = [...new Set(rows.map((r) => r.invitee_id).filter(Boolean))] as string[];
      if (ids.length > 0) {
        const { data: profs } = await (supabase as any)
          .from('profiles').select('id, username').in('id', ids);
        const names = new Map((profs ?? []).map((p: { id: string; username: string }) => [p.id, p.username]));
        for (const r of rows) r.inviteeName = r.invitee_id ? (names.get(r.invitee_id) as string | undefined) ?? null : null;
      }
      return rows;
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
  const slotsLeft = giftsLeft(openInvites.length);
  const redemptions = (invites ?? []).filter((i) => i.status === 'redeemed' || i.status === 'converted').length;
  // Dead invites (canceled / expired) disappear entirely — a spent random
  // code is noise to the player. The rows live on in the DB for the admin
  // Referrals tab's history.
  // Settled rows ("X joined! +3 days", "X subscribed!") also retire once the
  // invite's own expiry has passed — a join is news for a week, not a
  // permanent line (founder, 2026-09-26).
  const visibleInvites = visibleCreditRows((invites ?? []).filter(
    (i) => i.status !== 'revoked' && new Date(i.expires_at).getTime() > Date.now(),
  ), dismissed);

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
        setSentCode(data.code);
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
    // FINISH_SPEC S4 / T4: the shared invite line (core shareCaption 'invite') plus the gift; the link rides separately.
    const text = giftShareText(url);
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

  if (sentCode) {
    return (
      <InviteSentCard
        code={sentCode}
        note="7 days of Pro are waiting for them. Share the link again from the gift card anytime."
        onSendAnother={slotsLeft > 0 ? () => { setSentCode(null); void handleCreate(); } : undefined}
        onDone={() => setSentCode(null)}
      />
    );
  }

  return (
    <GiftProCard
      giftsLeft={slotsLeft}
      slots={GIFT_SLOTS}
      onSend={handleCreate}
      sending={creating}
      sendDisabled={slotsLeft === 0}
      sendLabel={creating ? 'Sending…' : slotsLeft === 0 ? 'All 3 gifts out' : 'Send a gift'}
      footer={(leaders ?? []).length > 0 ? (
        <div className="pt-2" style={{ borderTop: `1px dashed ${softMix(FR_LOOK.gold, 0.4)}` }}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Icon3D name="trophy" size={14} />
            <span className="text-[11px] font-black uppercase tracking-wide" style={{ color: FR_LOOK.goldInk }}>
              Top Inviters this month
            </span>
          </div>
          {(leaders ?? []).map((l, i) => (
            <div key={l.username} className="flex items-center justify-between text-xs font-bold py-1 px-2 rounded-lg" style={{ background: rowStripe(i + 1) }}>
              <span style={{ color: FR_LOOK.ink }}><SoftNum size={12}>{i + 1}</SoftNum>. {l.username}</span>
              <span style={{ color: FR_LOOK.sub }}><SoftNum size={12}>{l.count}</SoftNum> joined</span>
            </div>
          ))}
        </div>
      ) : null}
    >
      <p className="m-0 text-xs font-bold" style={{ color: FR_LOOK.sub }}>
        Each friend gets <span style={{ color: '#b45309' }}>7 days of Pro</span> free. You get
        +3 days when they join, a <span style={{ color: '#b45309' }}>free month</span> if they
        subscribe, and <span style={{ color: '#b45309' }}>3 free months</span> if they go
        annual. {redemptions >= 3 ? null : <>3 friends = +4 streak shields.</>}
      </p>
      {slotsLeft === 0 && !creating && (
        <p className="m-0 text-[11px] font-bold text-center" style={{ color: FR_LOOK.sub }}>Slots free up when friends join.</p>
      )}
      {error && <div className="flex justify-center" role="alert"><FeedbackPill key={error} message={error} tone="error" /></div>}

      {showClearAll(visibleInvites) && (
        <div className="flex justify-end -mb-1">
          {/* Founder 10-03: a quiet Clear all once there are 2+ credit notices. */}
          <button
            type="button"
            onClick={() => dismissCredits(visibleInvites.filter((i) => isCredit(i.status)).map((i) => i.id))}
            className="text-[11px] font-extrabold px-2"
            style={{ color: FR_LOOK.sub, minHeight: 32 }}
          >
            Clear all
          </button>
        </div>
      )}
      {visibleInvites.length > 0 && (
        // No outline around the list (founder: no bordered boxes); the striped rows read as one block.
        <div className="overflow-hidden" style={{ borderRadius: 12 }}>
          {visibleInvites.slice(0, 6).map((inv, i) => {
            const label = STATUS_LABEL[inv.status] ?? STATUS_LABEL.pending;
            const open = inv.status === 'pending';
            // §251: settled rows lead with WHO — the code is noise once spent.
            const name = inv.inviteeName;
            const settledText = inv.status === 'converted'
              ? `${name ?? 'A friend'} subscribed! ${inv.converted_plan === 'annual' ? '+3 free months' : inv.converted_plan === 'monthly' ? '+1 free month' : 'Reward earned'}`
              : inv.status === 'redeemed'
                ? `${name ?? 'A friend'} joined! +3 days`
                : null;
            return (
              <div
                key={inv.id}
                className="credit-row flex items-center gap-2 px-3 py-2 text-xs font-bold"
                data-leaving={leaving.has(inv.id) ? 'true' : undefined}
                style={{ background: rowStripe(i + 1), borderTop: i === 0 ? undefined : `1px solid ${softMix(FR_LOOK.gold, 0.2)}`, minHeight: 44 }}
              >
                {open ? (
                  <span className="flex-1 min-w-0 flex flex-col items-start gap-1">
                    {/* T1: the open gift's code on glossy letter tiles, a Pending pill and its time left. */}
                    <InviteCodeTiles code={inv.code} tile={19} />
                    <span className="flex items-center gap-1.5">
                      <PendingPill />
                      <span style={{ color: FR_LOOK.sub }}>{timeLeft(inv.expires_at)}</span>
                    </span>
                  </span>
                ) : (
                  <span className="flex-1" style={{ color: label.color }}>{settledText ?? label.text}</span>
                )}
                {open && (
                  <>
                    <CastButton screen="pink"
                      size="sm"
                      color={copiedCode === inv.code ? 'teal' : 'peach'}
                      icon={copiedCode === inv.code ? 'check' : 'share'}
                      onClick={() => copyLink(inv.code)}
                      aria-label="Share invite link"
                      style={{ width: 32, padding: 0 }}
                    />
                    <CastButton screen="pink"
                      size="sm"
                      color="peach"
                      icon={<XIcon className="w-3.5 h-3.5" aria-hidden="true" />}
                      onClick={() => cancelInvite(inv.id, inv.code)}
                      aria-label="Cancel invite"
                      style={{ width: 32, padding: 0 }}
                    />
                  </>
                )}
                {inv.status === 'converted' && <Icon3D name="crown" size={14} />}
                {isCredit(inv.status) && (
                  // Founder 10-03: X a credit notice away (soft circle, no outline, 44 px tap area).
                  <button
                    type="button"
                    onClick={() => dismissCredits([inv.id])}
                    aria-label={`Dismiss: ${settledText ?? label.text}`}
                    className="shrink-0 -my-2 -mr-2 flex items-center justify-center"
                    style={{ width: 44, height: 44 }}
                  >
                    <span className="flex items-center justify-center rounded-full" style={{ width: 24, height: 24, background: softMix(FR_LOOK.gold, 0.22) }}>
                      <XIcon className="w-3.5 h-3.5" style={{ color: '#92400e' }} aria-hidden="true" />
                    </span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </GiftProCard>
  );
}
