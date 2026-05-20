'use client';

import { Star } from 'lucide-react';
import { useEffect, useState } from 'react';

interface XpToastProps {
  xp: number;
  streakBonus?: number;
  dailyBonus?: number;
  sweepBonus?: number;
  flawlessBonus?: number;
  leveledUp?: boolean;
  newLevel?: number;
}

/**
 * Animated toast notification showing XP earned after a game.
 * Auto-dismisses after 3 seconds — stretch to 5s if the sweep/flawless
 * bonus fired so the player actually reads the celebration.
 */
export function XpToast({ xp, streakBonus = 0, dailyBonus = 0, sweepBonus = 0, flawlessBonus = 0, leveledUp, newLevel }: XpToastProps) {
  const [visible, setVisible] = useState(true);
  const [exiting, setExiting] = useState(false);
  const hasSweepBonus = sweepBonus > 0 || flawlessBonus > 0;

  useEffect(() => {
    const dismissDelay = hasSweepBonus ? 5000 : 3000;
    const exitTimer = setTimeout(() => setExiting(true), dismissDelay - 300);
    const hideTimer = setTimeout(() => setVisible(false), dismissDelay);
    return () => { clearTimeout(exitTimer); clearTimeout(hideTimer); };
  }, [hasSweepBonus]);

  const totalXp = xp + streakBonus + dailyBonus + sweepBonus + flawlessBonus;

  if (!visible) return null;

  return (
    <div
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[70] pointer-events-none"
      style={{
        animation: exiting
          ? 'fade-in-up 300ms ease-out reverse forwards'
          : 'fade-in-up 300ms ease-out both',
      }}
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
          <div className="flex gap-2 flex-wrap">
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
            {sweepBonus > 0 && (
              <span className="text-[10px] font-black text-pink-200">
                +{sweepBonus} sweep
              </span>
            )}
            {flawlessBonus > 0 && (
              <span className="text-[10px] font-black text-yellow-300">
                +{flawlessBonus} flawless
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
    </div>
  );
}
