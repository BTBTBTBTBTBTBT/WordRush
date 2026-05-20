'use client';

import { useState, useEffect, useRef } from 'react';

import { Crown, Lock, X } from 'lucide-react';
import Link from 'next/link';
import { getSecondsUntilMidnightUTC, formatCountdown } from '@/lib/play-limit-service';
import { useFocusTrap } from '@/hooks/use-focus-trap';

interface ModeLimitModalProps {
  open: boolean;
  onClose: () => void;
  modeName: string;
  onViewPuzzle?: () => void;
}

export function ModeLimitModal({ open, onClose, modeName, onViewPuzzle }: ModeLimitModalProps) {
  const [countdown, setCountdown] = useState('');
  const focusRef = useRef<HTMLDivElement>(null);
  useFocusTrap(focusRef, open);

  useEffect(() => {
    if (!open) return;
    const update = () => setCountdown(formatCountdown(getSecondsUntilMidnightUTC()));
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
            className="w-full max-w-sm p-6 text-center animate-modal-content"
            style={{
              background: 'var(--color-surface)',
              borderRadius: '20px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
            }}
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`${modeName} daily limit reached`}
          >
            <Lock className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--color-text-muted)' }} />
            <h2 className="text-lg font-black mb-1" style={{ color: 'var(--color-text)' }}>
              {modeName} — Played Today
            </h2>
            <p className="text-xs font-bold mb-4" style={{ color: 'var(--color-text-muted)' }}>
              You've used your free play of {modeName} for today. Upgrade to Pro for unlimited replays and ad-free gameplay across all 8 modes.
            </p>

            <div
              className="inline-block px-4 py-2 rounded-lg mb-4"
              style={{ background: 'var(--color-surface-hover)', border: '1px solid var(--color-border)' }}
            >
              <span className="text-xs font-bold" style={{ color: '#7c3aed' }}>
                Play again tomorrow in {countdown}
              </span>
            </div>

            <Link href="/pro" onClick={onClose}>
              <button
                className="w-full py-3 rounded-xl text-white font-black text-sm btn-3d mb-3"
                style={{
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                  boxShadow: '0 4px 0 #92400e',
                }}
              >
                <Crown className="w-4 h-4 inline mr-1" />
                Upgrade to Pro
              </button>
            </Link>

            {onViewPuzzle ? (
              <button
                onClick={() => { onClose(); onViewPuzzle(); }}
                className="text-xs font-bold"
                style={{ color: '#7c3aed' }}
              >
                View Solved Puzzle
              </button>
            ) : (
              <button
                onClick={onClose}
                className="text-xs font-bold"
                style={{ color: 'var(--color-text-muted)' }}
              >
                Come back tomorrow
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
