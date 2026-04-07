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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="relative w-full max-w-sm bg-gradient-to-br from-purple-900 via-purple-800 to-pink-900 rounded-3xl p-6 border-2 border-white/20 shadow-2xl"
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-4">
              {/* Streak at risk */}
              <div className="flex justify-center">
                <div className="relative">
                  <Flame className="w-16 h-16 text-orange-400" fill="currentColor" />
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center"
                  >
                    <span className="text-white text-xs font-bold">!</span>
                  </motion.div>
                </div>
              </div>

              <h2 className="text-2xl font-black text-white">Streak at Risk!</h2>
              <p className="text-white/70 text-sm">
                Your <span className="text-orange-400 font-bold">{streak}-day streak</span> will be lost if you don't play today.
              </p>

              {/* Shield & coin status */}
              <div className="flex justify-center gap-4 text-sm">
                <div className="flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1.5">
                  <Shield className="w-4 h-4 text-blue-400" />
                  <span className="text-white font-bold">{shields}</span>
                </div>
                <div className="flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1.5">
                  <Coins className="w-4 h-4 text-yellow-400" />
                  <span className="text-white font-bold">{coins.toLocaleString()}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2">
                {shields > 0 && (
                  <button
                    onClick={() => handleAction(onUseShield, 'shield')}
                    disabled={loading !== null}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-bold text-sm transition-colors disabled:opacity-50"
                  >
                    {loading === 'shield' ? 'Using Shield...' : `Use Shield (${shields} left)`}
                  </button>
                )}

                <button
                  onClick={() => handleAction(onBuyWithCoins, 'coins')}
                  disabled={loading !== null || !canBuyWithCoins}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-bold text-sm transition-colors disabled:opacity-50"
                >
                  {loading === 'coins' ? 'Buying...' : `Buy Shield (50 Coins)`}
                </button>

                <button
                  onClick={onDecline}
                  disabled={loading !== null}
                  className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white/70 font-medium text-sm transition-colors disabled:opacity-50"
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
