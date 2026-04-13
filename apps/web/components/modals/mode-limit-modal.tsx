'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Lock, X } from 'lucide-react';
import Link from 'next/link';
import { getSecondsUntilMidnightUTC, formatCountdown } from '@/lib/play-limit-service';

interface ModeLimitModalProps {
  open: boolean;
  onClose: () => void;
  modeName: string;
  onViewPuzzle?: () => void;
}

export function ModeLimitModal({ open, onClose, modeName, onViewPuzzle }: ModeLimitModalProps) {
  const [countdown, setCountdown] = useState('');

  useEffect(() => {
    if (!open) return;
    const update = () => setCountdown(formatCountdown(getSecondsUntilMidnightUTC()));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [open]);

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
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="w-full max-w-sm p-6 text-center"
            style={{
              background: '#ffffff',
              borderRadius: '20px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <Lock className="w-12 h-12 mx-auto mb-3" style={{ color: '#9ca3af' }} />
            <h2 className="text-lg font-black mb-1" style={{ color: '#1a1a2e' }}>
              {modeName} — Played Today
            </h2>
            <p className="text-xs font-bold mb-4" style={{ color: '#9ca3af' }}>
              You've used your free play of {modeName} for today. Upgrade to Pro for unlimited replays of all 8 modes, any time.
            </p>

            <div
              className="inline-block px-4 py-2 rounded-lg mb-4"
              style={{ background: '#f3f0ff', border: '1px solid #ede9f6' }}
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
                style={{ color: '#9ca3af' }}
              >
                Come back tomorrow
              </button>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
