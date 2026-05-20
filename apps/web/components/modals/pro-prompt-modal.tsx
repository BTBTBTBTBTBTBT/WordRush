'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

import { Crown, X } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase-client';
import { useFocusTrap } from '@/hooks/use-focus-trap';

export function ProPromptModal() {
  const { user, profile, refreshProfile, isProActive } = useAuth();
  const [show, setShow] = useState(false);
  const focusRef = useRef<HTMLDivElement>(null);
  useFocusTrap(focusRef, show);

  useEffect(() => {
    if (!user || !profile) return;
    const streak = profile.daily_login_streak ?? 0;
    const prompted = (profile as any).pro_prompt_shown ?? false;

    if (streak >= 7 && !prompted && !isProActive) {
      setShow(true);
    }
  }, [user, profile, isProActive]);

  useEffect(() => {
    if (!show) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') dismiss(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [show]);

  const dismiss = async () => {
    if (!user) return;
    setShow(false);
    await (supabase as any)
      .from('profiles')
      .update({ pro_prompt_shown: true })
      .eq('id', user.id);
    await refreshProfile();
  };

  return (
    <>
      {show && (
        <div
          className="fixed bottom-16 left-4 right-4 z-50 max-w-md mx-auto animate-slide-up"
        >
          <div
            ref={focusRef}
            className="flex items-center gap-3 p-3.5"
            style={{
              background: 'var(--color-surface)',
              border: '1.5px solid #fde68a',
              borderRadius: '16px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
            }}
            role="alert"
          >
            <Crown className="w-8 h-8 flex-shrink-0" style={{ color: '#d97706' }} />
            <div className="flex-1 min-w-0">
              <p className="font-extrabold text-xs" style={{ color: 'var(--color-text)' }}>You're on a streak!</p>
              <p className="text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
                Upgrade to Pro for ad-free play, stats, shields, and more.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Link href="/pro" onClick={dismiss}>
                <button
                  className="btn-3d px-3 py-1.5 rounded-lg text-white text-[10px] font-black"
                  style={{
                    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                    boxShadow: '0 2px 0 #92400e',
                  }}
                >
                  Go Pro
                </button>
              </Link>
              <button onClick={dismiss} style={{ color: 'var(--color-text-muted)' }} className="hover:opacity-80 transition-opacity" aria-label="Dismiss">
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
