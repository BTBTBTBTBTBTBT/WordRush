'use client';

import { useState, useEffect, useRef } from 'react';

import { Sparkles, Trophy, Swords } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase-client';

export function WelcomeModal() {
  const { user, profile, refreshProfile } = useAuth();
  const [show, setShow] = useState(false);
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user || !profile) return;

    const forceWelcome =
      typeof window !== 'undefined' &&
      process.env.NODE_ENV === 'development' &&
      new URLSearchParams(window.location.search).has('__force_welcome');

    if ((profile as any).has_onboarded === false || forceWelcome) {
      setUsername(profile.username);
      setShow(true);
    }
  }, [user, profile]);

  useEffect(() => {
    if (show) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 400);
    }
  }, [show]);

  const validate = (name: string): string | null => {
    const trimmed = name.trim();
    if (trimmed.length < 3) return 'At least 3 characters';
    if (trimmed.length > 20) return '20 characters max';
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) return 'Letters, numbers, and underscores only';
    return null;
  };

  const handleSave = async () => {
    if (!user) return;
    const trimmed = username.trim();
    const validationError = validate(trimmed);
    if (validationError) { setError(validationError); return; }

    setSaving(true);
    setError('');

    const { error: updateErr } = await (supabase as any)
      .from('profiles')
      .update({ username: trimmed, has_onboarded: true })
      .eq('id', user.id);

    if (updateErr) {
      if (updateErr.code === '23505') {
        setError('Username already taken');
      } else {
        setError('Something went wrong');
      }
      setSaving(false);
      return;
    }

    await refreshProfile();
    setShow(false);
  };

  const handleSkip = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await (supabase as any)
        .from('profiles')
        .update({ has_onboarded: true })
        .eq('id', user.id);
      await refreshProfile();
      setShow(false);
    } catch {
      setSaving(false);
    }
  };

  return (
    <>
      {show && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-6 animate-modal-overlay"
          style={{ backgroundColor: 'rgba(26,26,46,0.55)' }}
        >
          <div
            className="w-full max-w-sm overflow-hidden animate-modal-content"
            style={{
              background: 'var(--color-surface)',
              border: '1.5px solid var(--color-border)',
              borderRadius: '20px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
            }}
          >
            {/* Gradient accent bar */}
            <div
              className="h-1.5"
              style={{
                background: 'linear-gradient(90deg, #a78bfa, #ec4899, #fbbf24)',
              }}
            />

            <div className="px-6 pt-6 pb-5">
              {/* Logo */}
              <div className="text-center mb-4">
                <h1
                  className="text-2xl font-black tracking-tight"
                  style={{
                    background: 'linear-gradient(135deg, #7c3aed, #ec4899)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  WORDOCIOUS
                </h1>
                <p className="text-[11px] font-bold mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                  Welcome to Epic Word Battles
                </p>
              </div>

              {/* Intro bullets */}
              <div className="space-y-2.5 mb-5">
                <div className="flex items-start gap-2.5">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: '#f3f0ff' }}
                  >
                    <Sparkles className="w-3.5 h-3.5" style={{ color: '#7c3aed' }} />
                  </div>
                  <div>
                    <p className="text-xs font-extrabold" style={{ color: 'var(--color-text)' }}>
                      Daily Puzzles
                    </p>
                    <p className="text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
                      New challenges every day across 7 unique game modes
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: '#fdf2f8' }}
                  >
                    <Swords className="w-3.5 h-3.5" style={{ color: '#ec4899' }} />
                  </div>
                  <div>
                    <p className="text-xs font-extrabold" style={{ color: 'var(--color-text)' }}>
                      Compete Head-to-Head
                    </p>
                    <p className="text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
                      Challenge friends or get matched with random opponents
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: '#fffbeb' }}
                  >
                    <Trophy className="w-3.5 h-3.5" style={{ color: '#d97706' }} />
                  </div>
                  <div>
                    <p className="text-xs font-extrabold" style={{ color: 'var(--color-text)' }}>
                      Climb the Leaderboards
                    </p>
                    <p className="text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
                      Earn medals, build streaks, and track your stats
                    </p>
                  </div>
                </div>
              </div>

              {/* Username input */}
              <div className="mb-4">
                <label
                  className="block text-[10px] font-extrabold uppercase tracking-wider mb-1.5"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  Choose your display name
                </label>
                <input
                  ref={inputRef}
                  type="text"
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); setError(''); }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !saving) handleSave(); }}
                  maxLength={20}
                  className="w-full px-3 py-2.5 text-sm font-bold outline-none transition-colors"
                  style={{
                    background: 'var(--color-bg)',
                    border: `1.5px solid ${error ? '#ef4444' : 'var(--color-border)'}`,
                    borderRadius: '10px',
                    color: 'var(--color-text)',
                  }}
                  placeholder="Your display name"
                />
                {error && (
                  <p className="text-[10px] font-bold mt-1" style={{ color: '#ef4444' }}>
                    {error}
                  </p>
                )}
                <p className="text-[9px] font-bold mt-1" style={{ color: 'var(--color-text-muted)' }}>
                  3-20 characters. Letters, numbers, and underscores.
                </p>
              </div>

              {/* CTA */}
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full py-3 text-sm font-black text-white transition-transform active:scale-[0.98] disabled:opacity-60"
                style={{
                  background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                  borderRadius: '12px',
                  boxShadow: '0 4px 0 #4c1d95',
                }}
              >
                {saving ? 'Saving...' : "Let's Play!"}
              </button>

              {/* Skip */}
              <button
                onClick={handleSkip}
                disabled={saving}
                className="w-full mt-2 py-1.5 text-[11px] font-bold transition-opacity hover:opacity-70 disabled:opacity-40"
                style={{ color: 'var(--color-text-muted)' }}
              >
                Skip for now
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
