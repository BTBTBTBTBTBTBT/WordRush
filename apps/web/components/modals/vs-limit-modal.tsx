'use client';

import { useState, useEffect, useRef } from 'react';

import { Icon3D } from '@/components/ui/icon3d';
import { CandyButton, CandyLink } from '@/components/ui/candy-button';
import { SoftNum } from '@/components/ui/soft-number';
import { cardBarStyle, softCard } from '@/lib/soft-surface';
import { badgeSrc, poseSrc } from '@/lib/art';
import { getSecondsUntilMidnightLocal, formatCountdown } from '@/lib/play-limit-service';
import { useFocusTrap } from '@/hooks/use-focus-trap';

interface VsLimitModalProps {
  open: boolean;
  onClose: () => void;
}

export function VsLimitModal({ open, onClose }: VsLimitModalProps) {
  const [countdown, setCountdown] = useState('');
  const focusRef = useRef<HTMLDivElement>(null);
  useFocusTrap(focusRef, open);

  useEffect(() => {
    if (!open) return;
    const update = () => setCountdown(formatCountdown(getSecondsUntilMidnightLocal()));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6 animate-modal-overlay"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={onClose}
        >
          <div
            ref={focusRef}
            className="w-full max-w-sm overflow-hidden text-center animate-modal-content"
            // A1: a tinted purple sheet with the game-card top bar (dark mode keeps its dark surface).
            style={{ ...softCard('#7c3aed', { radius: 22 }), boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Daily VS limit reached"
          >
            <div aria-hidden="true" style={cardBarStyle('#7c3aed')} />
            <div className="p-6 pt-4">
            {/* R with cocoa: rest up, the next free match is tomorrow (decorative). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={poseSrc('r', 'cocoa')} alt="" aria-hidden="true" width={84} height={84} draggable={false} className="mx-auto mb-2" style={{ width: 84, height: 84, objectFit: 'contain' }} />
            <h2 className="text-lg font-black mb-1" style={{ color: 'var(--color-text)' }}>
              Daily VS Used
            </h2>
            <p className="text-xs font-bold mb-4" style={{ color: 'var(--color-text-muted)' }}>
              You&apos;ve played your free daily VS match for today. Upgrade to Pro for unlimited ad-free VS matches and rematches, or come back tomorrow.
            </p>

            <div
              className="inline-flex items-center gap-1.5 px-4 py-2 mb-4"
              style={softCard('#7c3aed', { radius: 999, shadow: false })}
            >
              {/* The gold clock sprite (night art 10-03). */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={badgeSrc('icon-clock-sprite')} alt="" aria-hidden="true" width={18} height={18} decoding="async" className="shrink-0 select-none" style={{ width: 18, height: 18 }} />
              <span className="text-xs font-bold" style={{ color: 'var(--color-text-secondary)' }}>Resets in</span>
              <SoftNum size={16}>{countdown}</SoftNum>
            </div>

            <CandyLink href="/pro" onClick={onClose} color="amber" size="lg" block icon={<Icon3D name="crown" size={20} />} className="mb-3">
              Upgrade to Pro
            </CandyLink>

            <CandyButton color="peach" size="sm" onClick={onClose}>Come back tomorrow</CandyButton>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
