'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { validateUsername } from '@wordle-duel/core';
import { supabase } from '@/lib/supabase-client';
import { CandyButton } from '@/components/ui/candy-button';
import { softInput, softNotice } from '@/components/ui/soft-popup';
import { softBackground, softBorder } from '@/lib/soft-surface';
import { prefersReducedMotion } from '@/lib/motion';
import { feedback } from '@/lib/sound-events';
import { escapeLike, usernameSuggestions } from '@/lib/onboarding';

// FINISH_SPEC AO step 3: pick a USERNAME. A big candy field with a live
// availability check against profiles (green check / "taken" shake), three
// suggestion chips, saved with the same profile update path as Edit Profile
// (the DB trigger enforce_username_policy_trg stays the authority).

type Status = 'same' | 'checking' | 'ok' | 'taken' | 'invalid' | 'unknown';

const ACCENT = '#7c3aed';
const GOOD = '#059669';
const BAD = '#e11d48';

export function UsernameStep({
  profileId,
  current,
  onSaved,
  refreshProfile,
}: {
  profileId: string;
  current: string;
  onSaved: () => void;
  refreshProfile: () => Promise<void>;
}) {
  const [name, setName] = useState(current);
  const [status, setStatus] = useState<Status>('same');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const fieldRef = useRef<HTMLDivElement>(null);
  const seed = useRef(Math.floor(Math.random() * 1000) + 1);
  const trimmed = name.trim();

  const shake = () => {
    feedback('invalid');
    const el = fieldRef.current;
    if (!el || prefersReducedMotion() || typeof el.animate !== 'function') return;
    el.animate(
      [{ transform: 'translateX(0)' }, { transform: 'translateX(-8px)' }, { transform: 'translateX(7px)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(0)' }],
      { duration: 360, easing: 'ease-out' },
    );
  };

  // Live check: shape + content first (no round trip), then a debounced lookup.
  useEffect(() => {
    if (trimmed === current) { setStatus('same'); setMessage(''); return; }
    const check = validateUsername(trimmed);
    if (!check.ok) { setStatus('invalid'); setMessage(check.error ?? 'That username is not available.'); return; }
    setStatus('checking');
    setMessage('');
    let live = true;
    const t = setTimeout(async () => {
      const { data, error } = await (supabase as any)
        .from('profiles')
        .select('id')
        .ilike('username', escapeLike(trimmed))
        .limit(1);
      if (!live) return;
      if (error) { setStatus('unknown'); return; }
      const rows = (data ?? []) as { id: string }[];
      if (rows.length > 0 && rows[0].id !== profileId) {
        setStatus('taken');
        setMessage('That one is taken. Try another, or tap an idea below.');
        shake();
      } else {
        setStatus('ok');
      }
    }, 350);
    return () => { live = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmed, current, profileId]);

  const ideas = useMemo(
    () => usernameSuggestions(trimmed || current, seed.current, (s) => validateUsername(s).ok),
    // New ideas only when a name is taken or invalid, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [status === 'taken' || status === 'invalid' ? trimmed : current],
  );

  const save = async () => {
    if (status === 'same') { onSaved(); return; }
    if (status === 'taken' || status === 'invalid' || status === 'checking') { shake(); return; }
    setSaving(true);
    const { error } = await (supabase as any).from('profiles').update({ username: trimmed }).eq('id', profileId);
    if (error) {
      setSaving(false);
      if (error.code === '23505' || error.message?.includes('unique') || error.message?.includes('duplicate')) {
        setStatus('taken');
        setMessage('That one is taken. Try another, or tap an idea below.');
      } else {
        setStatus('invalid');
        setMessage(error.message ?? 'Could not save. Please try again.');
      }
      shake();
      return;
    }
    await refreshProfile();
    setSaving(false);
    onSaved();
  };

  const good = status === 'same' || status === 'ok';
  const bad = status === 'taken' || status === 'invalid';

  return (
    <div className="w-full flex flex-col gap-3">
      <label htmlFor="onboard-username" className="text-[11px] font-black uppercase text-center" style={{ letterSpacing: '0.12em', color: 'var(--color-text-muted)' }}>
        Pick a username
      </label>
      <div ref={fieldRef} className="relative">
        <input
          id="onboard-username"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void save(); }}
          maxLength={20}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-invalid={bad}
          aria-describedby="onboard-username-status"
          className="w-full outline-none text-center text-[22px] font-black"
          style={{
            ...softInput(ACCENT, { invalid: bad }),
            borderRadius: 20,
            padding: '14px 48px',
            boxShadow: good ? `0 0 0 3px ${GOOD}33` : undefined,
            border: good ? `1.5px solid ${GOOD}` : softInput(ACCENT, { invalid: bad }).border,
          }}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center rounded-full" style={{ width: 28, height: 28, background: good ? GOOD : bad ? BAD : 'transparent' }} aria-hidden="true">
          {good && <Check className="w-4 h-4" strokeWidth={3.5} color="#fff" />}
          {bad && <X className="w-4 h-4" strokeWidth={3.5} color="#fff" />}
          {status === 'checking' && <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--color-text-muted)' }} />}
        </span>
      </div>
      <p id="onboard-username-status" className="m-0 min-h-[18px] text-center text-[12px] font-extrabold" style={{ color: bad ? BAD : good ? GOOD : 'var(--color-text-muted)' }} aria-live="polite">
        {status === 'same' ? 'Looks great. Keep it, or make it yours.' : status === 'ok' ? 'It’s yours!' : status === 'checking' ? 'Checking...' : status === 'unknown' ? '' : message}
      </p>
      {ideas.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Username ideas">
          {ideas.map((idea) => (
            <button
              key={idea}
              type="button"
              onClick={() => { feedback('press'); setName(idea); }}
              className="px-3 py-1.5 rounded-full text-[13px] font-extrabold"
              style={{ background: softBackground(ACCENT, 0.12), border: softBorder(ACCENT, 0.2), color: 'var(--color-text)' }}
            >
              {idea}
            </button>
          ))}
        </div>
      )}
      {status === 'unknown' && (
        <p className="m-0 text-center text-[12px] font-bold px-3 py-2" style={softNotice('info')}>We couldn&apos;t check right now. Save and we&apos;ll let you know.</p>
      )}
      <CandyButton size="lg" color="purple" icon="arrow" onClick={() => void save()} disabled={saving} className="mt-1 self-center" style={{ minWidth: 220 }}>
        {saving ? 'Saving...' : 'Next'}
      </CandyButton>
    </div>
  );
}
