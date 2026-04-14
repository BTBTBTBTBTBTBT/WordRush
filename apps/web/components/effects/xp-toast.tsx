'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Star } from 'lucide-react';
import { useEffect, useState } from 'react';

interface XpToastProps {
  xp: number;
  streakBonus?: number;
  dailyBonus?: number;
  leveledUp?: boolean;
  newLevel?: number;
}

/**
 * Animated toast notification showing XP earned after a game.
 * Auto-dismisses after 3 seconds.
 */
export function XpToast({ xp, streakBonus = 0, dailyBonus = 0, leveledUp, newLevel }: XpToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  const totalXp = xp + streakBonus + dailyBonus;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: -60, opacity: 0, scale: 0.9 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -40, opacity: 0, scale: 0.95 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[70] pointer-events-none"
        >
          <div
            className="px-5 py-3 rounded-2xl flex items-center gap-3"
            style={{
              background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
              boxShadow: '0 8px 32px rgba(124, 58, 237, 0.35)',
            }}
          >
            <Star className="w-5 h-5 text-yellow-300" fill="currentColor" />
            <div>
              <div className="text-white font-black text-sm">
                +{totalXp} XP
              </div>
              <div className="flex gap-2">
                {streakBonus > 0 && (
                  <span className="text-[10px] font-bold text-purple-200">
                    +{streakBonus} streak
                  </span>
                )}
                {dailyBonus > 0 && (
                  <span className="text-[10px] font-bold text-purple-200">
                    +{dailyBonus} daily
                  </span>
                )}
              </div>
              {leveledUp && newLevel && (
                <div className="text-[10px] font-black text-yellow-300 mt-0.5">
                  Level up! Lv.{newLevel}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
