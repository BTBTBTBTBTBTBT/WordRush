'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Lock } from 'lucide-react';
import { supabase } from '@/lib/supabase-client';
import { useAuth } from '@/lib/auth-context';

// Recovery landing for the password-reset email. Supabase links here either
// with ?code= (PKCE) or with tokens in the URL hash (implicit); we handle both:
// exchangeCodeForSession for the former, detectSessionInUrl covers the latter.
// Styling mirrors login-screen.tsx exactly — same card, fields, btn-3d CTA.
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

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center px-6"
      style={{ backgroundColor: 'var(--color-bg)' }}
    >
      <div className="w-full max-w-sm space-y-6">
        {/* Branding — identical to LoginScreen */}
        <div className="text-center space-y-2">
          <h1
            className="text-3xl font-black tracking-tight"
            style={{
              background: 'linear-gradient(135deg, #7c3aed, #ec4899)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            WORDOCIOUS
          </h1>
          <p className="text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>
            Epic Word Battles
          </p>
        </div>

        <div
          className="p-6 space-y-4"
          style={{
            background: 'var(--color-surface)',
            border: '1.5px solid #c4b5fd',
            borderRadius: '20px',
            boxShadow: '0 4px 24px rgba(124, 58, 237, 0.08)',
          }}
        >
          <h2 className="text-lg font-black text-center" style={{ color: 'var(--color-text)' }}>
            Set a New Password
          </h2>

          {!ready ? (
            <p className="text-xs font-bold text-center py-4" style={{ color: 'var(--color-text-muted)' }}>
              Checking your reset link...
            </p>
          ) : linkError ? (
            <div className="space-y-3">
              <div
                className="p-3 rounded-xl text-xs font-bold"
                style={{ background: 'var(--color-loss-bg)', border: '1px solid #fecaca', color: 'var(--color-loss-text)' }}
              >
                {linkError}
              </div>
              <button
                type="button"
                onClick={() => router.replace('/')}
                className="w-full py-3 rounded-xl text-white font-black text-sm btn-3d"
                style={{
                  background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                  boxShadow: '0 4px 0 #4c1d95',
                }}
              >
                Back to Wordocious
              </button>
            </div>
          ) : done ? (
            <div
              className="p-3 rounded-xl text-xs font-bold text-center"
              style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#047857' }}
            >
              Password updated! Taking you to the game...
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold flex items-center gap-1.5" style={{ color: 'var(--color-text-muted)' }}>
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
                  style={{
                    color: 'var(--color-text)',
                    background: 'var(--color-bg)',
                    border: '1.5px solid var(--color-border)',
                  }}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-extrabold flex items-center gap-1.5" style={{ color: 'var(--color-text-muted)' }}>
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
                  style={{
                    color: 'var(--color-text)',
                    background: 'var(--color-bg)',
                    border: '1.5px solid var(--color-border)',
                  }}
                />
              </div>

              {error && (
                <div
                  className="p-3 rounded-xl text-xs font-bold"
                  style={{ background: 'var(--color-loss-bg)', border: '1px solid #fecaca', color: 'var(--color-loss-text)' }}
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl text-white font-black text-sm btn-3d disabled:opacity-50"
                style={{
                  background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                  boxShadow: '0 4px 0 #4c1d95',
                }}
              >
                {loading ? 'Saving...' : 'Save New Password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordInner />
    </Suspense>
  );
}
