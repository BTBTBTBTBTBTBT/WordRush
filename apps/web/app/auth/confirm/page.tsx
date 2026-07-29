'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { supabase } from '@/lib/supabase-client';

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
    <div className="fixed inset-0 flex items-center justify-center px-6" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div
        className="w-full max-w-sm text-center p-6"
        style={{ background: 'var(--color-surface)', border: '1.5px solid #c4b5fd', borderRadius: '20px', boxShadow: '0 4px 24px rgba(124, 58, 237, 0.08)' }}
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
            <button
              onClick={() => router.replace('/')}
              className="w-full py-2.5 rounded-xl text-sm font-black text-white btn-3d"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', boxShadow: '0 4px 0 #4c1d95' }}
            >
              Go to Wordocious
            </button>
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
