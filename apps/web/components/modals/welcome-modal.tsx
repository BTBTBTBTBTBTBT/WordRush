'use client';

import { useState, useEffect, useRef } from 'react';

import { Icon3D } from '@/components/ui/icon3d';
import { GameArt } from '@/components/ui/game-art';
import { CandyButton } from '@/components/ui/candy-button';
import { POPUP_ACCENT, POPUP_DIM, PoseArt, PopupBar, popupCard, softInput, softRow } from '@/components/ui/soft-popup';
import { softIconTile } from '@/lib/soft-surface';
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

  // G5 first launch: a tinted window with the brand top bar, O1 cheering
  // hello (a pose — A7: not the Home host W), feature rows on tinted mini-card
  // icon tiles, a tinted name field, the purple candy CTA and the quiet peach Skip.
  return (
    <>
      {show && (
        <div
          data-celebration-block
          className="fixed inset-0 z-[60] flex items-center justify-center p-6 animate-modal-overlay"
          style={{ backgroundColor: POPUP_DIM }}
        >
          <div
            className="w-full max-w-sm animate-modal-content"
            style={popupCard(POPUP_ACCENT.brand, { share: 0.09 })}
          >
            {/* Gradient accent bar */}
            <PopupBar accent={POPUP_ACCENT.brand} gradient="linear-gradient(90deg, #a78bfa, #ec4899, #fbbf24)" />

            <div className="px-6 pt-4 pb-5">
              {/* Logo, with O1 cheering hello (A7: not the Home host W) */}
              <div className="flex flex-col items-center text-center mb-4">
                <PoseArt pose="art-pose-o1-cheer" size={88} priority className="art-pop" />
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
                  Welcome to Wordocious
                </p>
              </div>

              {/* Intro bullets */}
              <div className="space-y-2 mb-5">
                {INTRO.map((row) => (
                  <div key={row.title} className="flex items-center gap-2.5 p-2" style={softRow(row.accent, { radius: 14 })}>
                    <div className="w-9 h-9 flex items-center justify-center flex-shrink-0" style={softIconTile(row.accent, { radius: 10 })}>
                      {row.art}
                    </div>
                    <div>
                      <p className="text-xs font-extrabold" style={{ color: 'var(--color-text)' }}>
                        {row.title}
                      </p>
                      <p className="text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
                        {row.body}
                      </p>
                    </div>
                  </div>
                ))}
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
                  style={softInput(POPUP_ACCENT.brand, { invalid: !!error })}
                  placeholder="Your display name"
                />
                {error && (
                  <p className="text-[10px] font-bold mt-1" style={{ color: 'var(--color-loss-text)' }}>
                    {error}
                  </p>
                )}
                <p className="text-[9px] font-bold mt-1" style={{ color: 'var(--color-text-muted)' }}>
                  3-20 characters. Letters, numbers, and underscores.
                </p>
              </div>

              {/* CTA */}
              <CandyButton color="purple" size="lg" block icon="play" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : "Let's Play!"}
              </CandyButton>

              {/* Skip */}
              <div className="flex justify-center mt-1">
                <CandyButton color="peach" size="sm" onClick={handleSkip} disabled={saving}>
                  Skip for now
                </CandyButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** The three intro rows: a 3D icon on a mini game card in each row's color. */
const INTRO: { title: string; body: string; accent: string; art: React.ReactNode }[] = [
  { title: 'Daily Puzzles', body: 'Eight daily word games and ten More Games, new every day', accent: '#7c3aed', art: <GameArt id="practice" size={24} /> },
  { title: 'Play with Friends', body: "Today's Race, a weekly finish and VS with friends", accent: '#ec4899', art: <Icon3D name="tab-friends" size={24} /> },
  { title: 'Climb the Leaderboards', body: 'Earn medals, build streaks, and track your stats', accent: '#f5a524', art: <Icon3D name="trophy" size={24} /> },
];
