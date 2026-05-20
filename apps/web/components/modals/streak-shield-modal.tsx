'use client';

import { useState, useEffect, useRef } from 'react';

import { Shield, Flame, X } from 'lucide-react';
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
  const focusRef = useRef<HTMLDivElement>(null);
  useFocusTrap(focusRef, open);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const handleAction = async (action: () => Promise<void>, key: string) => {
    setLoading(key);
    try {
      await action();
    } finally {
      setLoading(null);
    }
  };

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-modal-overlay"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
        >
          <div
            ref={focusRef}
            className="relative w-full max-w-sm p-6 animate-modal-content"
            style={{
              background: 'var(--color-surface)',
              border: '1.5px solid #c4b5fd',
              borderRadius: '20px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.12)',
            }}
            role="dialog"
            aria-modal="true"
            aria-label="Streak shield"
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 transition-opacity hover:opacity-80"
              style={{ color: 'var(--color-text-muted)' }}
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-4">
              {/* Streak at risk */}
              <div className="flex justify-center">
                <div className="relative">
                  <Flame className="w-14 h-14" style={{ color: '#f97316' }} fill="currentColor" />
                  <div
                    className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center animate-fade-in-scale"
                  >
                    <span className="text-white text-[10px] font-black">!</span>
                  </div>
                </div>
              </div>

              <h2 className="text-xl font-black" style={{ color: 'var(--color-text)' }}>Streak at Risk!</h2>

              {/* Large streak number */}
              <div className="text-5xl font-black" style={{ color: 'var(--color-text)' }}>{streak}</div>
              <p className="text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>
                day streak will be lost if you don't play today
              </p>

              {/* Shield status */}
              <div className="flex justify-center gap-3">
                <div
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-extrabold"
                  style={{ background: 'var(--color-surface-hover)', border: '1.5px solid #c4b5fd', color: '#5b21b6' }}
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>{shields}</span>
                </div>
              </div>

              {/* Actions. Shields are the only way to save a streak — coin
                  purchase was removed with the coin economy. Players with
                  no shields get the Pro upsell via the decline path. */}
              <div className="space-y-2 pt-2">
                {shields > 0 ? (
                  <button
                    onClick={() => handleAction(onUseShield, 'shield')}
                    disabled={loading !== null}
                    className="w-full py-3 rounded-xl text-white font-black text-sm btn-3d disabled:opacity-50"
                    style={{
                      background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                      boxShadow: '0 4px 0 #4c1d95',
                    }}
                  >
                    {loading === 'shield' ? 'Using Shield...' : `Use Shield (${shields} left)`}
                  </button>
                ) : (
                  <p className="text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>
                    You have no streak shields. Pro subscribers get 4 shields per billing period.
                  </p>
                )}

                <button
                  onClick={onDecline}
                  disabled={loading !== null}
                  className="w-full py-2 text-xs font-bold transition-colors disabled:opacity-50"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  Let Streak Reset
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
