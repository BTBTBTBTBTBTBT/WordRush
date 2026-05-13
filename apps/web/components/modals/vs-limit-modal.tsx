'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Swords, X } from 'lucide-react';
import Link from 'next/link';
import { getSecondsUntilMidnightUTC, formatCountdown } from '@/lib/play-limit-service';
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
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={onClose}
        >
          <motion.div
            ref={focusRef}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="w-full max-w-sm p-6 text-center"
            style={{
              background: 'var(--color-surface)',
              borderRadius: '20px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
            }}
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Daily VS limit reached"
          >
            <Swords className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--color-text-muted)' }} />
            <h2 className="text-lg font-black mb-1" style={{ color: 'var(--color-text)' }}>
              Daily VS Used
            </h2>
            <p className="text-xs font-bold mb-4" style={{ color: 'var(--color-text-muted)' }}>
              You&apos;ve played your free daily VS match for today. Upgrade to Pro for unlimited ad-free battles and rematches, or come back tomorrow.
            </p>

            <div
              className="inline-block px-4 py-2 rounded-lg mb-4"
              style={{ background: 'var(--color-surface-hover)', border: '1px solid var(--color-border)' }}
            >
              <span className="text-xs font-bold" style={{ color: '#7c3aed' }}>
                Resets in {countdown}
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

            <button
              onClick={onClose}
              className="text-xs font-bold"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Come back tomorrow
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
