'use client';

import { useEffect } from 'react';
import { logLandingVisit, stampShareFirstTouch } from '@/lib/landing-visits';

/**
 * Mounted by the server-rendered /s/[...key] share page. Renders nothing;
 * on the client it (1) logs the visit to landing_visits keyed by the shared
 * mode and (2) drops the first-touch wr_src=share cookie so a signup that
 * follows is attributed to sharing. See lib/landing-visits.ts.
 */
export function ShareLandingBeacon({ mode }: { mode: string }) {
  useEffect(() => {
    stampShareFirstTouch();
    logLandingVisit('share', mode);
  }, [mode]);
  return null;
}
