'use client';

import { useEffect, useRef } from 'react';
import { getTodayLocal } from '@/lib/daily-service';

/**
 * Force a full reload when the tab resumes with stale date assumptions.
 *
 * iOS Safari (and every browser's back-forward cache) keeps an entire
 * frozen page in memory when the user navigates away, backgrounds the
 * tab, or locks the phone. When they come back the DOM is restored
 * verbatim and `useEffect` does not re-run — which means every daily
 * puzzle page's "is this today's puzzle?" check is bypassed. A user who
 * completed Monday's puzzle at 11pm Monday could reopen the tab
 * Wednesday and still see Monday's completed board, unchanged, because
 * no JS ever executed across the day boundary.
 *
 * Standalone iOS PWAs behave the same way — tapping the home-screen
 * icon resumes the prior session without replaying hooks.
 *
 * Guard: capture the local day at mount, listen for `pageshow` (fires on
 * bfcache restore with event.persisted === true) and for `visibilitychange`
 * → visible (fires when the user taps back into the tab/app). If the
 * player-local day has advanced since mount, reload the page so every
 * daily module re-reads today and the stale boards clear.
 *
 * Mid-day tab switches don't trigger a reload — the day-change check keeps
 * this from fighting with normal Safari behaviour.
 */
export function DailyBoundaryReload() {
  const mountedDayRef = useRef<string | null>(null);

  useEffect(() => {
    mountedDayRef.current = getTodayLocal();

    const maybeReload = () => {
      if (!mountedDayRef.current) return;
      if (getTodayLocal() !== mountedDayRef.current) {
        window.location.reload();
      }
    };

    const onPageShow = (e: PageTransitionEvent) => {
      // `persisted` means the browser served the page from bfcache — always
      // re-check, since any arbitrary amount of time may have passed.
      if (e.persisted) maybeReload();
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') maybeReload();
    };

    window.addEventListener('pageshow', onPageShow);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pageshow', onPageShow);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return null;
}
