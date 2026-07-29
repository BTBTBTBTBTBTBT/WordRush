'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Gift, Crown } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

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

  const centered = (node: React.ReactNode) => (
    <div className="min-h-screen-stable flex items-center justify-center px-5" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="w-full max-w-sm text-center p-6" style={{ background: 'var(--color-surface)', border: '1.5px solid #c4b5fd', borderRadius: '20px', boxShadow: '0 4px 24px rgba(124, 58, 237, 0.08)' }}>
        {node}
      </div>
    </div>
  );

  if (loading || status === 'loading') {
    return centered(<p className="text-sm font-bold animate-pulse" style={{ color: 'var(--color-text-muted)' }}>Loading invite…</p>);
  }
  if (status === 'notfound') return centered(<p className="text-sm font-black" style={{ color: '#dc2626' }}>Invite not found.</p>);
  if (status === 'expired') return centered(<p className="text-sm font-black" style={{ color: '#dc2626' }}>This invite has expired — ask your friend for a fresh one.</p>);
  if (status === 'used') return centered(<p className="text-sm font-black" style={{ color: 'var(--color-text-muted)' }}>This invite was already used — ask your friend for a fresh one.</p>);

  if (claimResult === 'claimed') {
    return centered(
      <>
        <Crown className="w-10 h-10 mx-auto mb-2" style={{ color: '#d97706' }} />
        <h1 className="text-lg font-black" style={{ color: 'var(--color-text)' }}>Pro unlocked!</h1>
        <p className="text-xs font-bold mt-1" style={{ color: 'var(--color-text-muted)' }}>
          7 days of Wordocious Pro are on your account. Taking you to the game…
        </p>
      </>,
    );
  }
  if (claimResult === 'ineligible') {
    return centered(
      <>
        <Gift className="w-8 h-8 mx-auto mb-2" style={{ color: '#7c3aed' }} />
        <h1 className="text-lg font-black mb-1" style={{ color: 'var(--color-text)' }}>Not eligible</h1>
        <p className="text-xs font-bold mb-4" style={{ color: 'var(--color-text-muted)' }}>
          Gift trials are for brand-new players — accounts that have had Pro before (or already
          used an invite) can&apos;t claim one. The daily puzzles are still free!
        </p>
        <button onClick={() => router.replace('/')} className="w-full py-2.5 rounded-xl text-sm font-black text-white btn-3d" style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', boxShadow: '0 4px 0 #4c1d95' }}>
          Play Wordocious
        </button>
      </>,
    );
  }

  const pitch = (
    <>
      <Gift className="w-10 h-10 mx-auto mb-2" style={{ color: '#7c3aed' }} />
      <h1 className="text-lg font-black" style={{ color: 'var(--color-text)' }}>
        {inviterName ? <>@{inviterName} sent you a gift!</> : <>You&apos;ve been gifted!</>}
      </h1>
      <p className="text-xs font-bold mt-1 mb-4" style={{ color: 'var(--color-text-muted)' }}>
        7 days of <span style={{ color: '#d97706' }}>Wordocious Pro</span> — free. Ad-free play,
        unlimited replays, VS battles on every mode, and more.
      </p>
    </>
  );

  if (!user) {
    return centered(
      <>
        {pitch}
        <button
          onClick={() => { exitGuest(); router.push('/'); }}
          className="w-full py-2.5 rounded-xl text-sm font-black text-white btn-3d"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', boxShadow: '0 4px 0 #4c1d95' }}
        >
          Create a free account to claim
        </button>
        <p className="text-[10px] font-bold mt-3" style={{ color: 'var(--color-text-muted)' }}>
          Your gift is saved — it applies automatically after you sign up.
        </p>
      </>,
    );
  }

  return centered(
    <>
      {pitch}
      <button
        onClick={handleClaim}
        disabled={claiming}
        className="w-full py-2.5 rounded-xl text-sm font-black text-white btn-3d disabled:opacity-50"
        style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', boxShadow: '0 4px 0 #4c1d95' }}
      >
        {claiming ? 'Claiming…' : 'Claim 7 days of Pro'}
      </button>
    </>,
  );
}
