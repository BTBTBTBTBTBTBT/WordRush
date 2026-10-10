'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Lock } from 'lucide-react';
import { supabase } from '@/lib/supabase-client';
import { useAuth } from '@/lib/auth-context';
import { CastButton } from '@/components/ui/cast-button';
import { softInput, softNotice } from '@/components/ui/soft-popup';
import { FIELD_LABEL, UtilityCard, UtilityPage } from '@/components/ui/utility-page';

// Recovery landing for the password-reset email. Supabase links here either
// with ?code= (PKCE) or with tokens in the URL hash (implicit); we handle both:
// exchangeCodeForSession for the former, detectSessionInUrl covers the latter.
// 2.8 look: the shared utility shell (wall + cast row + soft card), like the sign-in screen.
function ResetPasswordInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { updatePassword } = useAuth();

  const [ready, setReady] = useState(false);
  const [linkError, setLinkError] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Device-independent link (the email template sends ?token_hash=…&type=recovery): verified here with no
      // PKCE verifier, so a reset requested in the iOS / Android app opens fine in any browser (founder 10-09:
      // the app-started PKCE link failed in Mail's browser with "invalid or expired").
      const tokenHash = searchParams.get('token_hash');
      if (tokenHash) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' });
        if (cancelled) return;
        if (error) setLinkError('This reset link has expired or was already used. Request a new one and use the newest email.');
        setReady(true);
        return;
      }
      const code = searchParams.get('code');
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (cancelled) return;
        if (error) {
          setLinkError('This reset link is invalid or has expired. Please request a new one.');
          setReady(true);
          return;
        }
        setReady(true);
        return;
      }
      // Hash-token flow: give detectSessionInUrl a beat, then check for a session.
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!data.session) {
        setLinkError('This reset link is invalid or has expired. Please request a new one.');
      }
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    const { error } = await updatePassword(password);
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setDone(true);
    // The recovery session is a full session — land them in the game signed in.
    setTimeout(() => router.replace('/'), 1500);
  };

  // 2.8 look (founder 10-09): the page wall + the live cast row + one soft card (components/ui/utility-page.tsx).
  if (!ready) {
    return (
      <UtilityPage>
        <UtilityCard pose="art-pose-u-meditate" title="One moment" line="Checking your reset link…" busy />
      </UtilityPage>
    );
  }
  if (linkError) {
    return (
      <UtilityPage>
        <UtilityCard pose="art-pose-r-sleepwalk" title="Link expired" notice={{ kind: 'error', text: linkError }}>
          <CastButton color="purple" size="lg" block type="button" onClick={() => router.replace('/')}>
            Go to Home
          </CastButton>
        </UtilityCard>
      </UtilityPage>
    );
  }
  if (done) {
    return (
      <UtilityPage>
        <UtilityCard pose="art-pose-d-victory" title="Password updated" notice={{ kind: 'success', text: 'Password updated! Taking you to the game...' }} busy />
      </UtilityPage>
    );
  }
  return (
    <UtilityPage>
      <UtilityCard pose="art-pose-d-eureka" artSize={88} heading="newpassword" title="Set a New Password">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-extrabold flex items-center gap-1.5" style={FIELD_LABEL}>
              <Lock className="w-3.5 h-3.5" />
              New Password
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoFocus
              className="w-full px-3 py-2.5 rounded-xl text-sm font-bold outline-none"
              style={softInput()}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-extrabold flex items-center gap-1.5" style={FIELD_LABEL}>
              <Lock className="w-3.5 h-3.5" />
              Confirm Password
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={6}
              className="w-full px-3 py-2.5 rounded-xl text-sm font-bold outline-none"
              style={softInput()}
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl text-xs font-bold" role="alert" style={softNotice('error')}>
              {error}
            </div>
          )}

          <CastButton color="purple" size="lg" block type="submit" disabled={loading}>
            {loading ? 'Saving...' : 'Save New Password'}
          </CastButton>
        </form>
      </UtilityCard>
    </UtilityPage>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordInner />
    </Suspense>
  );
}
