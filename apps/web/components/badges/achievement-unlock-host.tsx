'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { BadgeCelebrationPopup } from './badge-celebration';
import { dismissCelebration, getCelebrations, nextCelebration, subscribeCelebrations, type BadgeCelebration } from '@/lib/badges';
import { isCalm, readCalmInputs, CALM_POLL_MS, CALM_SETTLE_MS } from '@/lib/celebration-gate';
import { playSound } from '@/lib/sounds';
import { haptic } from '@/lib/haptics';
import { leaveGuard } from '@/lib/nav-home';

// Plays the badge celebrations (docs/FINISH_SPEC.md V2 / V3) one after
// another: achievement unlocks announced by lib/achievement-service.ts and a
// level-up into a new tier. It waits while the win / lose popup (R1,
// `.result-pop`) is on screen so the two never stack, then shows the oldest,
// with the `unlock` sound + a success haptic. Mount it once near the root;
// extra mounts stay silent (only the first one renders).
//
// Outage fix (2026-10-03, lib/celebration-gate.ts): a LATE item (replayed
// result, launch / visibility sync, or a live finish > 6 s late) also waits
// for a calm moment — Home at its root, nothing open, no other popup — with a
// short settle beat. Live items keep the behavior above and go first.

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

  // The one on screen stays until it's closed (a live item arriving behind a
  // late one that is already showing never swaps it out).
  const [showing, setShowing] = useState<BadgeCelebration | null>(null);
  const current = showing && queue.includes(showing) ? showing : nextCelebration(queue);
  useEffect(() => { setShowing(isLeader && clear ? current : null); }, [isLeader, clear, current]);

  // Wait for the R1 popup to close before showing anything; a late item
  // waits for a calm moment too, and calm must survive a short settle beat.
  useEffect(() => {
    if (!isLeader || !current) { setClear(false); return; }
    const late = !!current.late;
    const ready = () => !blocked() && (!late || isCalm(readCalmInputs()));
    if (!late && ready()) { setClear(true); return; }
    setClear(false);
    let settle: number | null = null;
    const check = () => {
      if (!ready()) {
        if (settle != null) { window.clearTimeout(settle); settle = null; }
        return;
      }
      if (!late) { setClear(true); window.clearInterval(id); return; }
      if (settle != null) return;
      settle = window.setTimeout(() => {
        settle = null;
        if (ready()) { setClear(true); window.clearInterval(id); }
      }, CALM_SETTLE_MS);
    };
    const id = window.setInterval(check, CALM_POLL_MS);
    check();
    document.addEventListener('visibilitychange', check);
    window.addEventListener('popstate', check);
    return () => {
      window.clearInterval(id);
      if (settle != null) window.clearTimeout(settle);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('popstate', check);
    };
  }, [isLeader, current]);

  // The unlock moment's sound + haptic, once per celebration.
  useEffect(() => {
    if (!isLeader || !current || !clear) return;
    playSound('unlock');
    haptic('success');
  }, [isLeader, current, clear]);

  const onClose = useCallback(() => dismissCelebration(current ?? undefined), [current]);

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
