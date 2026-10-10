'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { supabase } from '@/lib/supabase-client';
import { CastButton } from '@/components/ui/cast-button';
import { UtilityCard, UtilityPage } from '@/components/ui/utility-page';

// Email-confirmation landing. Signups (web AND native) set emailRedirectTo
// here; the page exchanges the one-time ?code for a session and drops the
// user into the game signed in. The native apps claim this same path as a
// universal/app link, so a phone with the app installed confirms in-app and
// this page is the no-app fallback.
function ConfirmInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    (async () => {
      // Device-independent link (?token_hash=…&type=signup|email|magiclink|email_change from the templates).
      const tokenHash = searchParams.get('token_hash');
      const otpType = searchParams.get('type');
      if (tokenHash && otpType) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: otpType as 'signup' | 'email' | 'magiclink' | 'email_change' | 'invite' });
        if (!error) {
          router.replace('/');
          return;
        }
        setFailed(true);
        return;
      }
      const code = searchParams.get('code');
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
          router.replace('/');
          return;
        }
      } else {
        // Hash-token (implicit) flow — detectSessionInUrl handles it; give it
        // a beat and check.
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          router.replace('/');
          return;
        }
      }
      setFailed(true);
    })();
  }, [searchParams, router]);

  // 2.8 look (founder 10-09): the page wall + the live cast row + one soft card (components/ui/utility-page.tsx).
  return (
    <UtilityPage>
      {failed ? (
        <UtilityCard
          pose="art-pose-r-sleepwalk"
          title="Link expired"
          line="This confirmation link is no longer valid. Sign in to request a fresh one."
        >
          <CastButton color="purple" size="lg" block onClick={() => router.replace('/')}>
            Go to Home
          </CastButton>
        </UtilityCard>
      ) : (
        <UtilityCard pose="art-pose-u-meditate" title="One moment" line="Confirming your email…" busy />
      )}
    </UtilityPage>
  );
}

export default function ConfirmPage() {
  return (
    <Suspense fallback={null}>
      <ConfirmInner />
    </Suspense>
  );
}
