'use client';

import { useEffect, useState } from 'react';
import { startProWelcome } from '@/lib/pro-welcome';
import { useParams, useRouter } from 'next/navigation';
import { CandyButton } from '@/components/ui/candy-button';
import { StateCard } from '@/components/ui/soft-popup';
import {
  GIFT_BAR, GIFT_GOLD, INVITE_ACCENT, INVITE_BAR, InviteReceivedBody, InviteStateBody, ProUnlockedBody,
} from '@/components/friends/invite-screens';
import { UtilityPage } from '@/components/ui/utility-page';
import { useAuth } from '@/lib/auth-context';
import { logLandingVisit } from '@/lib/landing-visits';
import { ADS_SERVING } from '@wordle-duel/core';

// Referral landing — wordocious.com/join/<CODE>. Modeled on vs/join/[code]
// (same centered card) but for the Pro gift-trial program. Signed-out
// visitors get the pitch + a cookie that survives signup (including the
// OAuth round-trip); signed-in eligible users can claim directly.
export default function JoinReferralPage() {
  const params = useParams();
  const router = useRouter();
  const { user, session, loading, refreshProfile, exitGuest } = useAuth();
  const code = ((params?.code as string) || '').toUpperCase();

  const [status, setStatus] = useState<'loading' | 'ready' | 'notfound' | 'expired' | 'used'>('loading');
  const [inviterName, setInviterName] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimResult, setClaimResult] = useState<'claimed' | 'ineligible' | null>(null);

  useEffect(() => {
    if (!code) { setStatus('notfound'); return; }
    // Persist the code for the signup flow no matter where the visitor
    // wanders next. Not httpOnly — the redeemer nudge reads it client-side,
    // and a referral code is shareable by design, not a secret.
    document.cookie = `wr_ref=${code}; max-age=2592000; path=/; SameSite=Lax`;
    // Invite-link outcome tracking for the admin Marketing page: this open is
    // what turns a "link_invite shared" into "invite opened" (landing_visits).
    logLandingVisit('join', code);
    (async () => {
      try {
        const res = await fetch(`/api/referrals/lookup?code=${code}`);
        const data = await res.json();
        if (data.status === 'ok') {
          setInviterName(data.inviterName);
          setStatus('ready');
        } else {
          setStatus(data.status === 'used' ? 'used' : data.status === 'expired' ? 'expired' : 'notfound');
        }
      } catch {
        setStatus('notfound');
      }
    })();
  }, [code]);

  const handleClaim = async () => {
    if (!session) return;
    setClaiming(true);
    try {
      const res = await fetch('/api/referrals/redeem', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (data.ok) {
        // AP: the gifted week gets the Welcome to Pro moment (signal BEFORE the refresh, so the
        // host sees the not-Pro → Pro transition with it; it was marked silently before).
        if (user) startProWelcome(user.id, { kind: 'gift', proBefore: false });
        setClaimResult('claimed');
        await refreshProfile();
        setTimeout(() => router.replace('/'), 1800);
      } else {
        setClaimResult('ineligible');
      }
    } catch {
      setClaimResult('ineligible');
    }
    setClaiming(false);
  };

  // T2 / T4 (docs/FINISH_SPEC.md): every state is a tinted card with a cast
  // pose (or scene) and a candy button — never a bare text line. 2.8: on the friends wall under the live cast row. The pitch is
  // the invite in the Friends pink; Pro unlocked / not eligible sit in gold.
  const centered = (node: React.ReactNode, accent: string = INVITE_ACCENT, gradient: string = INVITE_BAR) => (
    <UtilityPage tint="friends">
      <StateCard accent={accent} gradient={gradient}>
        {node}
      </StateCard>
    </UtilityPage>
  );

  if (loading || status === 'loading') {
    return centered(
      <InviteStateBody pose="art-pose-u-meditate" title="Opening your invite…" busy>
        Just a moment.
      </InviteStateBody>,
    );
  }
  if (status === 'notfound') {
    return centered(
      <InviteStateBody scene="art-scene-o3-notfound" title="Invite not found">
        That link doesn&apos;t match an invite. Check it with your friend, or come play anyway.
      </InviteStateBody>,
    );
  }
  if (status === 'expired') {
    return centered(
      <InviteStateBody pose="art-pose-r-sleepwalk" title="This invite has expired">
        Ask your friend for a fresh one.
      </InviteStateBody>,
    );
  }
  if (status === 'used') {
    return centered(
      <InviteStateBody pose="art-pose-d-skeptic" title="Already used">
        This invite was already claimed. Ask your friend for a fresh one.
      </InviteStateBody>,
    );
  }

  if (claimResult === 'claimed') {
    return centered(
      <ProUnlockedBody onStart={() => router.replace('/')} note="Taking you to the game…" />,
      GIFT_GOLD,
      GIFT_BAR,
    );
  }
  if (claimResult === 'ineligible') {
    return centered(
      // T4: a kind pose (R with cocoa) on the tinted card.
      <InviteStateBody
        pose="art-pose-r-cocoa"
        title="Not eligible"
        action={(
          <CandyButton color="purple" size="lg" block icon="play" onClick={() => router.replace('/')}>
            Go to Wordocious
          </CandyButton>
        )}
      >
        Gift trials are for brand-new players. Accounts that have had Pro before (or already
        used an invite) can&apos;t claim one. The daily puzzles are still free!
      </InviteStateBody>,
      GIFT_GOLD,
      GIFT_BAR,
    );
  }

  // AN5: the inviter's own mascot, looked up by name (the lookup API returns only the username).
  const inviter = { name: inviterName ?? 'A friend', lookupByName: !!inviterName };
  const headline = inviterName ? <>{inviterName} wants to play with you!</> : <>You&apos;ve been invited!</>;
  const giftLine = (
    <>
      They sent you <span style={{ color: '#b45309' }}>7 days of Wordocious Pro</span>, free. {ADS_SERVING ? 'Ad-free play, unlimited' : 'Unlimited'} replays, VS in every mode, and more.
    </>
  );

  if (!user) {
    return centered(
      <>
        <InviteReceivedBody
          inviter={inviter}
          headline={headline}
          acceptLabel="Accept"
          declineLabel="No thanks"
          onAccept={() => { exitGuest(); router.push('/'); }}
          onDecline={() => router.replace('/')}
        >
          {giftLine}
        </InviteReceivedBody>
        <p className="text-[10px] font-bold mt-3" style={{ color: 'var(--color-text-muted)' }}>
          Create a free account to claim. Your gift is saved and applies automatically after you sign up.
        </p>
      </>,
    );
  }

  return centered(
    <InviteReceivedBody
      inviter={inviter}
      headline={headline}
      acceptLabel={claiming ? 'Claiming…' : 'Accept'}
      declineLabel="No thanks"
      onAccept={handleClaim}
      onDecline={() => router.replace('/')}
      busy={claiming}
    >
      {giftLine}
    </InviteReceivedBody>,
  );
}
