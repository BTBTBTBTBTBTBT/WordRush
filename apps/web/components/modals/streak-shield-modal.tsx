'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Coins, Flame, X } from 'lucide-react';

interface StreakShieldModalProps {
  open: boolean;
  streak: number;
  shields: number;
  coins: number;
  onUseShield: () => Promise<void>;
  onBuyWithCoins: () => Promise<void>;
  onDecline: () => void;
  onClose: () => void;
}

export function StreakShieldModal({
  open,
  streak,
  shields,
  coins,
  onUseShield,
  onBuyWithCoins,
  onDecline,
  onClose,
}: StreakShieldModalProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const canBuyWithCoins = coins >= 50;

  const handleAction = async (action: () => Promise<void>, key: string) => {
    setLoading(key);
    try {
      await action();
    } finally {
      setLoading(null);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="relative w-full max-w-sm p-6"
            style={{
              background: '#ffffff',
              border: '1.5px solid #c4b5fd',
              borderRadius: '20px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.12)',
            }}
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 transition-opacity hover:opacity-80"
              style={{ color: '#9ca3af' }}
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-4">
              {/* Streak at risk */}
              <div className="flex justify-center">
                <div className="relative">
                  <Flame className="w-14 h-14" style={{ color: '#f97316' }} fill="currentColor" />
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"
                  >
                    <span className="text-white text-[10px] font-black">!</span>
                  </motion.div>
                </div>
              </div>

              <h2 className="text-xl font-black" style={{ color: '#1a1a2e' }}>Streak at Risk!</h2>

              {/* Large streak number */}
              <div className="text-5xl font-black" style={{ color: '#1a1a2e' }}>{streak}</div>
              <p className="text-xs font-bold" style={{ color: '#9ca3af' }}>
                day streak will be lost if you don't play today
              </p>

              {/* Shield & coin status */}
              <div className="flex justify-center gap-3">
                <div
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-extrabold"
                  style={{ background: '#f3f0ff', border: '1.5px solid #c4b5fd', color: '#5b21b6' }}
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>{shields}</span>
                </div>
                <div
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-extrabold"
                  style={{ background: '#fef9ec', border: '1.5px solid #fde68a', color: '#92400e' }}
                >
                  <Coins className="w-3.5 h-3.5" />
                  <span>{coins.toLocaleString()}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2 pt-2">
                {shields > 0 && (
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
                )}

                <button
                  onClick={() => handleAction(onBuyWithCoins, 'coins')}
                  disabled={loading !== null || !canBuyWithCoins}
                  className="w-full py-3 rounded-xl text-white font-black text-sm btn-3d disabled:opacity-50"
                  style={{
                    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                    boxShadow: '0 4px 0 #92400e',
                  }}
                >
                  {loading === 'coins' ? 'Buying...' : 'Buy Shield (50 Coins)'}
                </button>

                <button
                  onClick={onDecline}
                  disabled={loading !== null}
                  className="w-full py-2 text-xs font-bold transition-colors disabled:opacity-50"
                  style={{ color: '#9ca3af' }}
                >
                  Let Streak Reset
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
