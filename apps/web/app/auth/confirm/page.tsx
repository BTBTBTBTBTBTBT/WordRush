'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { supabase } from '@/lib/supabase-client';
import { CandyButton } from '@/components/ui/candy-button';
import { barCard } from '@/components/ui/soft-popup';
import { softBackground } from '@/lib/soft-surface';

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

  return (
    <div className="fixed inset-0 flex items-center justify-center px-6" style={{ background: softBackground('#7c3aed', 0.07) }}>
      <div
        className="w-full max-w-sm text-center p-6"
        style={barCard()}
      >
        <h1
          className="text-2xl font-black tracking-tight text-transparent bg-clip-text mb-2"
          style={{ backgroundImage: 'linear-gradient(135deg, #7c3aed, #ec4899)' }}
        >
          WORDOCIOUS
        </h1>
        {failed ? (
          <>
            <p className="text-sm font-black mb-1" style={{ color: 'var(--color-text)' }}>Link expired</p>
            <p className="text-xs font-bold mb-4" style={{ color: 'var(--color-text-muted)' }}>
              This confirmation link is no longer valid. Sign in to request a fresh one.
            </p>
            <CandyButton color="purple" size="lg" block onClick={() => router.replace('/')}>
              Go to Wordocious
            </CandyButton>
          </>
        ) : (
          <p className="text-sm font-bold animate-pulse" style={{ color: 'var(--color-text-muted)' }}>
            Confirming your email…
          </p>
        )}
      </div>
    </div>
  );
}

export default function ConfirmPage() {
  return (
    <Suspense fallback={null}>
      <ConfirmInner />
    </Suspense>
  );
}
