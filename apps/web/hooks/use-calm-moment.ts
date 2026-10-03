'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { CALM_POLL_MS, CALM_SETTLE_MS, isCalm, readCalmInputs } from '@/lib/celebration-gate';

/**
 * Calls `onCalm` once the player is calm (lib/celebration-gate.ts: Home root,
 * nothing open, no other popup), while `pending` is true. Re-checks on route
 * change, visibilitychange and focus, and polls every CALM_POLL_MS only while
 * something is pending; once calm it waits a CALM_SETTLE_MS beat and fires
 * only if calm still holds. `blocked` adds the caller's own "a popup is up".
 */
export function useCalmMoment(pending: boolean, onCalm: () => void, blocked?: () => boolean): void {
  const pathname = usePathname();
  const onCalmRef = useRef(onCalm);
  const blockedRef = useRef(blocked);
  onCalmRef.current = onCalm;
  blockedRef.current = blocked;

  useEffect(() => {
    if (!pending) return;
    let settle: number | null = null;
    let done = false;
    const calmNow = () => isCalm(readCalmInputs(!!blockedRef.current?.()));
    const check = () => {
      if (done) return;
      if (!calmNow()) {
        if (settle != null) { window.clearTimeout(settle); settle = null; }
        return;
      }
      if (settle != null) return;
      settle = window.setTimeout(() => {
        settle = null;
        if (done || !calmNow()) return;
        done = true;
        onCalmRef.current();
      }, CALM_SETTLE_MS);
    };
    check();
    const poll = window.setInterval(check, CALM_POLL_MS);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    return () => {
      done = true;
      if (settle != null) window.clearTimeout(settle);
      window.clearInterval(poll);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
    };
  }, [pending, pathname]);
}
