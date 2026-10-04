'use client';

import { useState, useEffect, useRef } from 'react';

import Image from 'next/image';
import { X } from 'lucide-react';
import { HeaderCircle } from '@/components/ui/page-header';
import { Icon3D } from '@/components/ui/icon3d';
import { CandyButton } from '@/components/ui/candy-button';
import { CastButton } from '@/components/ui/cast-button';
import { SoftNum } from '@/components/ui/soft-number';
import { POPUP_DIM, popupCard } from '@/components/ui/soft-popup';
import { Confetti, CANDY_CONFETTI } from '@/components/effects/confetti';
import { ART_SIZE, artSrc } from '@/lib/art';
import { softPill } from '@/lib/soft-surface';
import { useFocusTrap } from '@/hooks/use-focus-trap';
import { feedback } from '@/lib/sound-events';

const PURPLE = '#7c3aed';
/** The shield popups' purple header (components/ui/streak-popups.tsx ShieldPopup). */
const HEADER = 'linear-gradient(135deg, #a78bfa, #7c3aed 60%, #6d28d9)';
const GUARD = 'art-scene-shield-guard' as const;

interface StreakShieldModalProps {
  open: boolean;
  streak: number;
  shields: number;
  onUseShield: () => Promise<void>;
  onDecline: () => void;
  onClose: () => void;
}

export function StreakShieldModal({
  open,
  streak,
  shields,
  onUseShield,
  onDecline,
  onClose,
}: StreakShieldModalProps) {
  const [loading, setLoading] = useState<string | null>(null);
  // After a shield is spent, swap the card to a "Streak saved!" beat for 1.8s
  // before closing (iOS/Android parity) — the modal owns its own dismissal.
  const [saved, setSaved] = useState(false);
  const focusRef = useRef<HTMLDivElement>(null);
  useFocusTrap(focusRef, open);

  useEffect(() => {
    if (open) setSaved(false);
    if (open) feedback('whoosh'); // FINISH_SPEC U: popup open
  }, [open]);

  useEffect(() => {
    if (!open || saved) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, saved, onClose]);

  const handleAction = async (action: () => Promise<void>, key: string) => {
    setLoading(key);
    try {
      await action();
    } finally {
      setLoading(null);
    }
  };

  const handleShield = async () => {
    await handleAction(onUseShield, 'shield');
    setSaved(true);
    feedback('streak'); // FINISH_SPEC U: shield saved = `streak` + medium haptic
    setTimeout(onClose, 1800);
  };

  // FINISH_SPEC G2: a purple header with U shielding the streak flame
  // (art-scene-shield-guard), the streak as a soft number, USE A SHIELD as the
  // purple candy button and "Let it reset" as the soft peach one; the "streak
  // saved" beat shows the art springing in over a glow, with confetti (Reduce
  // Motion: a fade, no confetti). Same actions.
  const shieldsAfter = Math.max(shields - 1, 0);
  const [aw, ah] = ART_SIZE[GUARD];
  const art = (height: number, spring: boolean) => (
    <div className="relative flex justify-center" style={{ height }}>
      {spring && (
        <div
          aria-hidden="true"
          className="absolute celebrate-glow"
          style={{ width: height * 1.5, height: height * 1.5, top: '50%', left: '50%', marginTop: -height * 0.75, marginLeft: -height * 0.75, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255, 255, 255, 0.75), rgba(245, 197, 66, 0.35) 40%, rgba(167, 139, 250, 0) 70%)' }}
        />
      )}
      <Image
        src={artSrc(GUARD)}
        alt=""
        aria-hidden="true"
        width={aw}
        height={ah}
        priority
        draggable={false}
        sizes={`${Math.round((height * aw) / ah)}px`}
        className={`relative select-none pointer-events-none ${spring ? 'celebrate-spring' : 'art-pop'}`}
        style={{ height, width: 'auto', filter: 'drop-shadow(0 8px 12px rgba(46, 16, 101, 0.35))' }}
      />
    </div>
  );
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-modal-overlay"
          style={{ backgroundColor: POPUP_DIM }}
        >
          <div
            ref={focusRef}
            className="relative w-full max-w-sm animate-modal-content"
            style={popupCard(PURPLE)}
            role="dialog"
            aria-modal="true"
            aria-label="Streak shield"
          >
            {!saved && (
              <HeaderCircle label="Close" onClick={onClose} size={32} className="absolute top-2.5 right-2.5 z-10">
                <X aria-hidden="true" style={{ width: 22, height: 22, color: '#ffffff', filter: 'drop-shadow(0 2px 3px rgba(46, 16, 101, 0.45))' }} strokeWidth={3.4} />
              </HeaderCircle>
            )}

            {saved ? (
              <div className="animate-fade-in-scale">
                <div className="flex flex-col items-center px-6 pt-6 pb-5" style={{ background: HEADER }}>
                  {art(150, true)}
                  <h2 className="mt-3 font-black text-white" style={{ fontSize: 24, letterSpacing: 0.4, textShadow: '0 2px 0 rgba(46, 16, 101, 0.35)' }}>STREAK SAVED!</h2>
                </div>
                <div className="flex items-center justify-center gap-2 px-6 py-5 text-[13px] font-bold" style={{ color: 'var(--color-text)' }}>
                  <span>Your <SoftNum size={18} className="soft-num-auto">{streak}</SoftNum>-day streak is safe</span>
                  <span aria-hidden="true">·</span>
                  <span>{shieldsAfter} {shieldsAfter === 1 ? 'shield' : 'shields'} left</span>
                </div>
                <Confetti colors={CANDY_CONFETTI.purple} />
              </div>
            ) : (
              <>
                <div className="flex flex-col items-center px-6 pt-5 pb-4" style={{ background: HEADER }}>
                  {art(118, false)}
                </div>

                <div className="px-5 pt-4 pb-5 flex flex-col items-center text-center gap-3">
                  {/* The streak on a warm tinted soft-number tile. */}
                  <div className="flex items-center gap-2 px-4 py-2" style={softPill('#f5a524', { radius: 16 })}>
                    <Icon3D name="flame" size={34} />
                    <SoftNum size={40}>{streak}</SoftNum>
                    <span className="text-[11px] font-black text-left leading-tight" style={{ letterSpacing: 1.2, color: '#a2560c' }}>DAY<br />STREAK</span>
                  </div>

                  <h2 className="font-black" style={{ fontSize: 18, letterSpacing: 0.4, color: 'var(--color-text)' }}>DON&apos;T LOSE YOUR STREAK!</h2>
                  <p className="text-[13px] font-bold leading-snug" style={{ color: 'var(--color-text-muted)' }}>
                    Your {streak}-day streak ends if you don&apos;t play today.
                  </p>

                  <div className="flex items-center gap-1.5 px-3 py-1 text-[12px] font-black" style={{ ...softPill(PURPLE, { bar: false }), color: 'var(--color-text)' }}>
                    <Icon3D name="shield" size={18} />
                    <SoftNum size={15} className="soft-num-auto">{shields}</SoftNum>
                    {shields === 1 ? 'shield' : 'shields'}
                  </div>

                  {/* Shields are the only way to save a streak — coin purchase was
                      removed with the coin economy. No shields: the Pro note. */}
                  {shields > 0 ? (
                    <CastButton
                      color="purple"
                      size="lg"
                      block
                      className="mt-1"
                      icon={<Icon3D name="shield" size={24} />}
                      onClick={handleShield}
                      disabled={loading !== null}
                    >
                      {loading === 'shield' ? 'USING A SHIELD…' : 'USE A SHIELD'}
                    </CastButton>
                  ) : (
                    <p className="text-[12px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
                      You&apos;re out of shields. Pro members get 4 every billing period.
                    </p>
                  )}

                  <CastButton color="peach" size="md" block onClick={onDecline} disabled={loading !== null}>
                    Let it reset
                  </CastButton>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
