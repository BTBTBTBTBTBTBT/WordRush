'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Mail, Lock, User, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { validateUsername } from '@wordle-duel/core';

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

export function LoginScreen() {
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn, signUp, signInWithGoogle, resetPassword } = useAuth();
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (mode === 'signup') {
      // Confirm-password is checked HERE, not by the browser: a typo in a
      // masked field creates an account the user can never sign into, and
      // there is no reveal toggle to catch it by eye.
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        setLoading(false);
        return;
      }
      // Shape + content pre-check (the DB trigger on profiles is the
      // authority; this is the friendly message before the round trip).
      const check = validateUsername(username.trim());
      if (!check.ok) {
        setError(check.error ?? 'That username is not available.');
        setLoading(false);
        return;
      }
      const { error } = await signUp(email, password, username);
      if (error) {
        setError(error.message);
      } else {
        // Email confirmation is ON, so a successful sign-up looks EXACTLY
        // like a dead button: no session, no navigation, no message. The
        // founder hit this on his first real sign-up — "it gives zero
        // confirmation that anything happens". Say something.
        setSent(true);
      }
    } else if (mode === 'reset') {
      const { error } = await resetPassword(email);
      // Always report success: confirming which addresses exist would let
      // anyone probe the user list.
      if (error && !/rate limit/i.test(error.message)) setSent(true);
      else if (error) setError(error.message);
      else setSent(true);
    } else {
      const { error } = await signIn(email, password);
      if (error) {
        setError(error.message);
      }
    }

    setLoading(false);
  };

  const switchMode = (next: 'signin' | 'signup' | 'reset') => {
    setMode(next);
    setError('');
    setSent(false);
    setConfirmPassword('');
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    const { error } = await signInWithGoogle();
    if (error) {
      setError(error.message);
    }
    setLoading(false);
  };

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center px-6"
      style={{ backgroundColor: 'var(--color-bg)' }}
    >
      <div className="w-full max-w-sm space-y-6">
        {/* Branding */}
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

        {/* Card */}
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
            {mode === 'signin' ? 'Welcome Back!' : mode === 'signup' ? 'Join the Fun!' : 'Reset Password'}
          </h2>

          {mode === 'reset' && (
            <p className="text-xs font-bold text-center" style={{ color: 'var(--color-text-muted)' }}>
              Enter your email and we&apos;ll send you a link to set a new password. Works for
              Google and Apple accounts too.
            </p>
          )}

          {mode !== 'reset' && (
            <>
              {/* Google Sign-In */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 py-3 rounded-xl font-extrabold text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
                style={{ background: 'var(--color-bg)', border: '1.5px solid var(--color-border)', color: 'var(--color-text)' }}
              >
                <GoogleIcon className="w-5 h-5" />
                Continue with Google
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px" style={{ background: 'var(--color-border)' }} />
                <span className="text-[10px] font-extrabold" style={{ color: 'var(--color-text-muted)' }}>or</span>
                <div className="flex-1 h-px" style={{ background: 'var(--color-border)' }} />
              </div>
            </>
          )}

          {/* Email/Password Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === 'signup' && (
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold flex items-center gap-1.5" style={{ color: 'var(--color-text-muted)' }}>
                  <User className="w-3.5 h-3.5" />
                  Username
                </label>
                <input
                  type="text"
                  placeholder="Choose a username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  minLength={3}
                  maxLength={20}
                  className="w-full px-3 py-2.5 rounded-xl text-sm font-bold outline-none"
                  style={{
                    color: 'var(--color-text)',
                    background: 'var(--color-bg)',
                    border: '1.5px solid var(--color-border)',
                  }}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-extrabold flex items-center gap-1.5" style={{ color: 'var(--color-text-muted)' }}>
                <Mail className="w-3.5 h-3.5" />
                Email
              </label>
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2.5 rounded-xl text-sm font-bold outline-none"
                style={{
                  color: 'var(--color-text)',
                  background: 'var(--color-bg)',
                  border: '1.5px solid var(--color-border)',
                }}
              />
            </div>

            {mode !== 'reset' && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold flex items-center gap-1.5" style={{ color: 'var(--color-text-muted)' }}>
                    <Lock className="w-3.5 h-3.5" />
                    Password
                  </label>
                  {mode === 'signin' && (
                    <button
                      type="button"
                      onClick={() => switchMode('reset')}
                      className="text-xs font-bold transition-colors"
                      style={{ color: '#7c3aed' }}
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full px-3 py-2.5 pr-10 rounded-xl text-sm font-bold outline-none"
                    style={{
                      color: 'var(--color-text)',
                      background: 'var(--color-bg)',
                      border: '1.5px solid var(--color-border)',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {mode === 'signup' && (
                  <div className="space-y-1.5 pt-1.5">
                    <label className="text-xs font-extrabold flex items-center gap-1.5" style={{ color: 'var(--color-text-muted)' }}>
                      <Lock className="w-3.5 h-3.5" />
                      Confirm password
                    </label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={6}
                      className="w-full px-3 py-2.5 rounded-xl text-sm font-bold outline-none"
                      style={{
                        color: 'var(--color-text)',
                        background: 'var(--color-bg)',
                        border: `1.5px solid ${
                          confirmPassword && password !== confirmPassword
                            ? '#fca5a5'
                            : 'var(--color-border)'
                        }`,
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            {sent && (
              <div
                className="p-3 rounded-xl text-xs font-bold"
                style={{ background: 'var(--color-win-bg, #ecfdf5)', border: '1px solid #a7f3d0', color: '#047857' }}
              >
                {mode === 'signup'
                  ? 'Account created. Check your email for a confirmation link, then sign in.'
                  : 'Check your email — if an account exists for that address, a reset link is on its way.'}
              </div>
            )}

            {error && (
              <div
                className="p-3 rounded-xl text-xs font-bold"
                style={{ background: 'var(--color-loss-bg)', border: '1px solid #fecaca', color: 'var(--color-loss-text)' }}
              >
                {error}
              </div>
            )}

            {/*
              `sent` is only ever true after a reset or a sign-up, and switchMode
              clears it — so disabling on it covers exactly the two cases where
              pressing again is a mistake. Sign-up without this returns
              "User already registered" for the account you just made.
            */}
            <button
              type="submit"
              disabled={loading || sent}
              className="w-full py-3 rounded-xl text-white font-black text-sm btn-3d disabled:opacity-50"
              style={{
                background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                boxShadow: '0 4px 0 #4c1d95',
              }}
            >
              {loading ? 'Loading...' : mode === 'signin' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Send Reset Link'}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
                className="text-xs font-bold transition-colors"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {mode === 'signin' ? "Don't have an account? Sign up"
                  : mode === 'signup' ? 'Already have an account? Sign in'
                  : 'Back to sign in'}
              </button>
            </div>
          </form>
        </div>

        {/* Legal links */}
        <div className="flex items-center justify-center gap-4">
          <Link href="/privacy" className="text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
            Privacy Policy
          </Link>
          <span className="text-[10px]" style={{ color: 'var(--color-border-light)' }}>|</span>
          <Link href="/terms" className="text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
            Terms of Service
          </Link>
        </div>
      </div>
    </div>
  );
}
