'use client';

import { useState, useEffect, useRef } from 'react';

import Image from 'next/image';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase-client';
import { useFocusTrap } from '@/hooks/use-focus-trap';
import { CandyLink } from '@/components/ui/candy-button';
import { HeaderBack } from '@/components/ui/page-header';
import { PopupBar, popupCard, POPUP_ACCENT } from '@/components/ui/soft-popup';
import { ART_SIZE, artSrc } from '@/lib/art';

// The Go Pro nudge after a 7-day streak (docs/FINISH_SPEC.md G1): the gold
// card family — a gold wash with the gold top bar, W crowned with the golden
// star (art-scene-pro-crown) at the side, and one large amber candy CTA.
// Same trigger, same dismissal write.

const CROWN = 'art-scene-pro-crown' as const;

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

  const [cw, ch] = ART_SIZE[CROWN];
  return (
    <>
      {show && (
        <div
          className="fixed bottom-16 left-4 right-4 z-50 max-w-md mx-auto animate-slide-up"
        >
          <div
            ref={focusRef}
            className="relative"
            style={popupCard(POPUP_ACCENT.gold, { radius: 22, share: 0.16 })}
            role="alert"
          >
            <PopupBar accent={POPUP_ACCENT.gold} gradient="linear-gradient(90deg, #ffd166, #f5a524 55%, #f97316)" />
            <HeaderBack kind="close" onClick={dismiss} size={32} label="Dismiss" className="absolute top-3 right-2 z-10" />
            <div className="flex items-center gap-3" style={{ padding: '10px 40px 12px 12px' }}>
              <Image
                src={artSrc(CROWN)}
                alt=""
                aria-hidden="true"
                width={cw}
                height={ch}
                draggable={false}
                sizes="64px"
                className="shrink-0 select-none pointer-events-none"
                style={{ height: 78, width: 'auto', filter: 'drop-shadow(0 4px 8px rgba(180, 83, 9, 0.25))' }}
              />
              <div className="flex-1 min-w-0">
                <p className="font-black" style={{ fontSize: 16, color: 'var(--color-text)' }}>You&apos;re on a streak!</p>
                <p className="text-[11px] font-bold leading-snug" style={{ color: 'var(--color-text-muted)' }}>
                  Upgrade to Pro for ad-free play, stats, shields, and more.
                </p>
                <CandyLink href="/pro" onClick={dismiss} color="amber" size="md" className="mt-2">
                  Go Pro
                </CandyLink>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
