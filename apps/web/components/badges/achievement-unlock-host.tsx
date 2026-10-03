'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { BadgeCelebrationPopup } from './badge-celebration';
import { dismissCelebration, getCelebrations, subscribeCelebrations, type BadgeCelebration } from '@/lib/badges';
import { playSound } from '@/lib/sounds';
import { haptic } from '@/lib/haptics';
import { leaveGuard } from '@/lib/nav-home';

// Plays the badge celebrations (docs/FINISH_SPEC.md V2 / V3) one after
// another: achievement unlocks announced by lib/achievement-service.ts and a
// level-up into a new tier. It waits while the win / lose popup (R1,
// `.result-pop`) is on screen so the two never stack, then shows the oldest,
// with the `unlock` sound + a success haptic. Mount it once near the root;
// extra mounts stay silent (only the first one renders).

const EMPTY: readonly BadgeCelebration[] = [];
/** Mounted hosts, oldest first; the oldest one renders. */
const hosts: Array<(lead: boolean) => void> = [];
function elect() {
  hosts.forEach((set, i) => set(i === 0));
}

/**
 * Something else has the screen: the R1 win / lose popup (BF2: unlocks show
 * only AFTER it closes), or a live VS match (its leave guard is up — never
 * interrupt a race).
 */
function blocked(): boolean {
  if (typeof document === 'undefined') return false;
  return !!document.querySelector('.result-pop') || leaveGuard() !== null;
}

export function AchievementUnlockHost() {
  const queue = useSyncExternalStore(subscribeCelebrations, getCelebrations, () => EMPTY);
  const [isLeader, setIsLeader] = useState(false);
  const [clear, setClear] = useState(false);

  useEffect(() => {
    hosts.push(setIsLeader);
    elect();
    return () => {
      const i = hosts.indexOf(setIsLeader);
      if (i >= 0) hosts.splice(i, 1);
      elect();
    };
  }, []);

  const current = queue[0] ?? null;

  // Wait for the R1 popup to close before showing anything.
  useEffect(() => {
    if (!isLeader || !current) { setClear(false); return; }
    if (!blocked()) { setClear(true); return; }
    setClear(false);
    const id = window.setInterval(() => {
      if (!blocked()) { setClear(true); window.clearInterval(id); }
    }, 500);
    return () => window.clearInterval(id);
  }, [isLeader, current]);

  // The unlock moment's sound + haptic, once per celebration.
  useEffect(() => {
    if (!isLeader || !current || !clear) return;
    playSound('unlock');
    haptic('success');
  }, [isLeader, current, clear]);

  const onClose = useCallback(() => dismissCelebration(), []);

  if (!isLeader || !current || !clear) return null;
  return (
    <BadgeCelebrationPopup
      key={current.kind === 'achievement' ? current.key : `tier-${current.tier}`}
      item={current}
      remaining={queue.length - 1}
      onClose={onClose}
    />
  );
}
