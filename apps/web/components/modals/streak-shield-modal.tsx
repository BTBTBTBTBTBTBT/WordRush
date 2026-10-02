'use client';

import { useState, useEffect, useRef } from 'react';

import { X } from 'lucide-react';
import { HeaderBack } from '@/components/ui/page-header';
import { Icon3D } from '@/components/ui/icon3d';
import { useFocusTrap } from '@/hooks/use-focus-trap';

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
    setTimeout(onClose, 1800);
  };

  // Restyled to the home redesign's look (founder, 2026-10-01: the old card
  // "looks dated"): a soft warm header with the flame and the number, an
  // all-caps headline, no bubbles, one flat rounded button. Same actions.
  const shieldsAfter = Math.max(shields - 1, 0);
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-modal-overlay"
          style={{ backgroundColor: 'rgba(30,27,75,0.45)' }}
        >
          <div
            ref={focusRef}
            className="relative w-full max-w-sm overflow-hidden animate-modal-content"
            style={{ background: 'var(--color-surface)', borderRadius: 22, boxShadow: '0 24px 60px rgba(76,29,149,0.25)' }}
            role="dialog"
            aria-modal="true"
            aria-label="Streak shield"
          >
            {!saved && (
              <HeaderBack kind="close" onClick={onClose} size={32} className="absolute top-3 right-3 z-10" />
            )}

            {saved ? (
              <div className="animate-fade-in-scale">
                <div className="flex flex-col items-center gap-1 px-6 pt-8 pb-6" style={{ background: 'linear-gradient(180deg, #ede9fe, #e0e7ff)' }}>
                  <Icon3D name="shield" size={56} />
                  <h2 className="mt-2 font-black" style={{ fontSize: 22, letterSpacing: 0.4, color: '#4c1d95' }}>STREAK SAVED!</h2>
                </div>
                <p className="px-6 py-5 text-center text-[13px] font-bold" style={{ color: '#4b5563' }}>
                  Your {streak}-day streak is safe · {shieldsAfter} {shieldsAfter === 1 ? 'shield' : 'shields'} left
                </p>
              </div>
            ) : (
              <>
                <div className="flex flex-col items-center px-6 pt-8 pb-5" style={{ background: 'linear-gradient(180deg, #fff3e0, #fde7f0)' }}>
                  <Icon3D name="flame" size={48} />
                  <div className="mt-1 font-black leading-none" style={{ fontSize: 52, color: '#78350f' }}>{streak}</div>
                  <div className="mt-1 text-[11px] font-black" style={{ letterSpacing: 1.2, color: '#b45309' }}>DAY STREAK</div>
                </div>

                <div className="px-6 pt-5 pb-5 flex flex-col items-center text-center gap-3">
                  <h2 className="font-black" style={{ fontSize: 18, letterSpacing: 0.4, color: '#4c1d95' }}>DON&apos;T LOSE YOUR STREAK!</h2>
                  <p className="text-[13px] font-bold leading-snug" style={{ color: '#4b5563' }}>
                    Your {streak}-day streak ends if you don&apos;t play today.
                  </p>

                  <div className="flex items-center gap-1.5 text-[12px] font-black" style={{ color: '#6d28d9' }}>
                    <Icon3D name="shield" size={16} />
                    {shields} {shields === 1 ? 'shield' : 'shields'}
                  </div>

                  {/* Shields are the only way to save a streak — coin purchase was
                      removed with the coin economy. No shields: the Pro note. */}
                  {shields > 0 ? (
                    <button
                      onClick={handleShield}
                      disabled={loading !== null}
                      className="w-full mt-1 font-black text-white transition-transform active:scale-[0.98] disabled:opacity-50"
                      style={{ height: 48, borderRadius: 14, fontSize: 14, letterSpacing: 0.6, background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', boxShadow: '0 6px 16px rgba(109,40,217,0.3)' }}
                    >
                      {loading === 'shield' ? 'USING A SHIELD…' : 'USE A SHIELD'}
                    </button>
                  ) : (
                    <p className="text-[12px] font-bold" style={{ color: '#6b7280' }}>
                      You&apos;re out of shields. Pro members get 4 every billing period.
                    </p>
                  )}

                  <button
                    onClick={onDecline}
                    disabled={loading !== null}
                    className="w-full py-2 text-[12px] font-bold transition-opacity hover:opacity-70 disabled:opacity-50"
                    style={{ color: '#6b7280' }}
                  >
                    Let it reset
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
