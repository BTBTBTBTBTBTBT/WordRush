'use client';

import { Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import { SoftNum } from '@/components/ui/soft-number';
import { softBackground, softBorder, softPill } from '@/lib/soft-surface';
import { LevelBadge } from '@/components/badges/badge-art';
import { AchievementUnlockHost } from '@/components/badges/achievement-unlock-host';
import { celebrateLevelUp } from '@/lib/badges';

interface XpToastProps {
  xp: number;
  streakBonus?: number;
  dailyBonus?: number;
  sweepBonus?: number;
  flawlessBonus?: number;
  /** §244: consecutive flawless days including today — shown when >= 2. */
  flawlessStreak?: number;
  leveledUp?: boolean;
  newLevel?: number;
}

/**
 * Animated toast notification showing XP earned after a game.
 * Auto-dismisses after 3 seconds — stretch to 5s if the sweep/flawless
 * bonus fired so the player actually reads the celebration.
 */
export function XpToast({ xp, streakBonus = 0, dailyBonus = 0, sweepBonus = 0, flawlessBonus = 0, flawlessStreak = 0, leveledUp, newLevel }: XpToastProps) {
  const [visible, setVisible] = useState(true);
  const [exiting, setExiting] = useState(false);
  const hasSweepBonus = sweepBonus > 0 || flawlessBonus > 0;

  useEffect(() => {
    const dismissDelay = hasSweepBonus ? 5000 : 3000;
    const exitTimer = setTimeout(() => setExiting(true), dismissDelay - 300);
    const hideTimer = setTimeout(() => setVisible(false), dismissDelay);
    return () => { clearTimeout(exitTimer); clearTimeout(hideTimer); };
  }, [hasSweepBonus]);

  // V3: a level-up into a new tier gets the tier popup (queued behind the
  // win popup and any achievement unlocks).
  useEffect(() => {
    if (leveledUp && newLevel) celebrateLevelUp(newLevel - 1, newLevel);
  }, [leveledUp, newLevel]);

  const totalXp = xp + streakBonus + dailyBonus + sweepBonus + flawlessBonus;

  // The badge host rides along with every post-game toast (achievements unlock
  // right after a result); it stays silent if one is already mounted higher up.
  return (
    <>
    <AchievementUnlockHost />
    {visible && (
    <div
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[70] pointer-events-none"
      style={{
        animation: exiting
          ? 'fade-in-up 300ms ease-out reverse forwards'
          : 'fade-in-up 300ms ease-out both',
      }}
    >
      {/* G5: a tinted card with the brand top bar (no solid purple slab), the
          total as a soft number and the bonuses as small tinted chips. */}
      <div
        className="overflow-hidden"
        style={{
          background: softBackground('#7c3aed', 0.16),
          border: softBorder('#7c3aed', 0.16),
          borderRadius: 18,
          boxShadow: '0 10px 28px rgba(124, 58, 237, 0.3)',
        }}
      >
        <div aria-hidden="true" style={{ height: 6, background: 'linear-gradient(90deg, #a78bfa, #ec4899, #fbbf24)' }} />
        <div className="px-4 py-2.5 flex items-center gap-3">
          <Star className="w-6 h-6 shrink-0" style={{ color: '#f5a524', filter: 'drop-shadow(0 2px 2px rgba(180, 83, 9, 0.3))' }} fill="currentColor" />
          <div>
            <SoftNum size={20} as="div">+{totalXp} XP</SoftNum>
            <div className="flex gap-1.5 flex-wrap mt-1">
              {streakBonus > 0 && <Bonus accent="#f97316">+{streakBonus} streak</Bonus>}
              {dailyBonus > 0 && <Bonus accent="#7c3aed">+{dailyBonus} daily</Bonus>}
              {sweepBonus > 0 && <Bonus accent="#f5a524">+{sweepBonus} sweep</Bonus>}
              {flawlessBonus > 0 && (
                <Bonus accent="#ec4899">{flawlessStreak >= 2 ? `FLAWLESS ×${flawlessStreak}` : `+${flawlessBonus} flawless`}</Bonus>
              )}
            </div>
            {leveledUp && newLevel && (
              <div className="text-[11px] font-black mt-1 inline-flex items-center gap-1.5" style={{ color: 'var(--color-text)' }}>
                Level up!
                <LevelBadge level={newLevel} size={20} numberSize={13} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    )}
    </>
  );
}

/** A small tinted bonus chip. */
function Bonus({ accent, children }: { accent: string; children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-black px-1.5 py-0.5" style={{ ...softPill(accent, { radius: 999, bar: false }), color: 'var(--color-text)' }}>
      {children}
    </span>
  );
}
