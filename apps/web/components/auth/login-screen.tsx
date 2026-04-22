'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Mail, Lock, User } from 'lucide-react';
import Link from 'next/link';

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

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="#1877F2">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  );
}

export function LoginScreen() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp, signInWithGoogle, signInWithFacebook } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (mode === 'signup') {
      const { error } = await signUp(email, password, username);
      if (error) {
        setError(error.message);
      }
    } else {
      const { error } = await signIn(email, password);
      if (error) {
        setError(error.message);
      }
    }

    setLoading(false);
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

  const handleFacebookSignIn = async () => {
    setError('');
    setLoading(true);
    const { error } = await signInWithFacebook();
    if (error) {
      setError(error.message);
    }
    setLoading(false);
  };

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center px-6"
      style={{ backgroundColor: '#f8f7ff' }}
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
          <p className="text-xs font-bold" style={{ color: '#9ca3af' }}>
            Epic Word Battles
          </p>
        </div>

        {/* Card */}
        <div
          className="p-6 space-y-4"
          style={{
            background: '#ffffff',
            border: '1.5px solid #c4b5fd',
            borderRadius: '20px',
            boxShadow: '0 4px 24px rgba(124, 58, 237, 0.08)',
          }}
        >
          <h2 className="text-lg font-black text-center" style={{ color: '#1a1a2e' }}>
            {mode === 'signin' ? 'Welcome Back!' : 'Join the Fun!'}
          </h2>

          {/* Google Sign-In */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-3 rounded-xl font-extrabold text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
            style={{ background: '#f8f7ff', border: '1.5px solid #ede9f6', color: '#1a1a2e' }}
          >
            <GoogleIcon className="w-5 h-5" />
            Continue with Google
          </button>

          {/* Facebook Sign-In */}
          <button
            type="button"
            onClick={handleFacebookSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-3 rounded-xl font-extrabold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
            style={{ background: '#1877F2', border: '1.5px solid #1877F2', color: '#ffffff' }}
          >
            <FacebookIcon className="w-5 h-5 bg-white rounded-full" />
            Continue with Facebook
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px" style={{ background: '#ede9f6' }} />
            <span className="text-[10px] font-extrabold" style={{ color: '#9ca3af' }}>or</span>
            <div className="flex-1 h-px" style={{ background: '#ede9f6' }} />
          </div>

          {/* Email/Password Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === 'signup' && (
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold flex items-center gap-1.5" style={{ color: '#9ca3af' }}>
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
                    color: '#1a1a2e',
                    background: '#f8f7ff',
                    border: '1.5px solid #ede9f6',
                  }}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-extrabold flex items-center gap-1.5" style={{ color: '#9ca3af' }}>
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
                  color: '#1a1a2e',
                  background: '#f8f7ff',
                  border: '1.5px solid #ede9f6',
                }}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-extrabold flex items-center gap-1.5" style={{ color: '#9ca3af' }}>
                <Lock className="w-3.5 h-3.5" />
                Password
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-3 py-2.5 rounded-xl text-sm font-bold outline-none"
                style={{
                  color: '#1a1a2e',
                  background: '#f8f7ff',
                  border: '1.5px solid #ede9f6',
                }}
              />
            </div>

            {error && (
              <div
                className="p-3 rounded-xl text-xs font-bold"
                style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }}
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
              {loading ? 'Loading...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setMode(mode === 'signin' ? 'signup' : 'signin');
                  setError('');
                }}
                className="text-xs font-bold transition-colors"
                style={{ color: '#9ca3af' }}
              >
                {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
              </button>
            </div>
          </form>
        </div>

        {/* Legal links */}
        <div className="flex items-center justify-center gap-4">
          <Link href="/privacy" className="text-[10px] font-bold" style={{ color: '#9ca3af' }}>
            Privacy Policy
          </Link>
          <span className="text-[10px]" style={{ color: '#d1d5db' }}>|</span>
          <Link href="/terms" className="text-[10px] font-bold" style={{ color: '#9ca3af' }}>
            Terms of Service
          </Link>
        </div>
      </div>
    </div>
  );
}
