'use client';

import { useState, useEffect, useRef } from 'react';

import { ProScene } from '@/components/pro/pro-scene';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase-client';
import { useFocusTrap } from '@/hooks/use-focus-trap';
import { CandyLink } from '@/components/ui/candy-button';
import { HeaderBack } from '@/components/ui/page-header';
import { PopupBar, popupCard, POPUP_ACCENT } from '@/components/ui/soft-popup';
import { HeadingArt } from '@/components/ui/heading-art';
import { ADS_SERVING } from '@wordle-duel/core';

// The Go Pro nudge after a 7-day streak (docs/FINISH_SPEC.md G1): the gold
// card family — a gold wash with the gold top bar, W crowned with the golden
// star (art-scene-pro-crown) at the side, and one large amber candy CTA.
// Same trigger, same dismissal write.


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
          data-celebration-block
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
              {/* Item 20: the free player's own mascot on the pedestal with the No-limits scene. */}
              <div className="shrink-0"><ProScene benefit="noLimits" height={84} caption={false} /></div>
              <div className="flex-1 min-w-0">
                {/* BJ16: the ON A STREAK! lettering. */}
                <HeadingArt slug="onastreak" label="You're on a streak!" height={28} maxWidth={200} align="left" />
                <p className="text-[11px] font-bold leading-snug" style={{ color: 'var(--color-text-muted)' }}>
                  {ADS_SERVING ? 'Upgrade to Pro for ad-free play, stats, shields, and more.' : 'Upgrade to Pro for unlimited play, stats, shields, and more.'}
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
