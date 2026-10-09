'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useFlags } from '@/hooks/use-flags';
import { readAgeCheck, saveAgeCheck, syncAgeCheck } from '@/lib/age-check';
import { startSentry } from '@/lib/sentry-start';
import { AgeCheckQuestion, AgeCheckUnder } from './age-check-screen';

// 13+ age check wiring (FRIDAY-QUEUE item 29).
//   - the answer sticks on this device (lib/age-check.ts); "under" can never be retried with another year
//   - nothing is created or stored for an under-13 visitor: no account, no guest flag, no crash reports
//   - signed-in accounts mirror the answer to the server (POST /api/account/age, service role); an
//     existing account that answers "under" is signed out and purged after a grace window
//   - the `age_check` off-switch (admin > Ops > Feature flags) turns the whole thing off

export type DeviceAgeStatus = 'loading' | 'ask' | 'ok' | 'under';

/** Device-level status (no account needed) + the setter that records an answer. */
export function useDeviceAgeCheck(): { status: DeviceAgeStatus; year: number | null; answer: (year: number) => void } {
  const { isLive } = useFlags();
  const live = isLive('age_check');
  const [status, setStatus] = useState<DeviceAgeStatus>('loading');
  const [year, setYear] = useState<number | null>(null);

  useEffect(() => {
    const stored = readAgeCheck();
    if (stored) {
      setYear(stored.year);
      setStatus(stored.state);
      if (stored.state === 'ok') startSentry();
      return;
    }
    if (!live) {
      // Off-switch: no check, crash reporting resumes as before.
      setStatus('ok');
      startSentry();
      return;
    }
    setStatus('ask');
  }, [live]);

  const answer = useCallback((y: number) => {
    const stored = saveAgeCheck(y);
    if (!stored) return;
    setYear(stored.year);
    setStatus(stored.state);
    if (stored.state === 'ok') startSentry();
  }, []);

  return { status, year, answer };
}

/** Wraps the signed-in / guest app: asks once per device (and once per existing account). */
export function AgeGate({ children }: { children: React.ReactNode }) {
  const { user, profile, session, signOut, refreshProfile } = useAuth();
  const { status, year, answer } = useDeviceAgeCheck();
  const synced = useRef(false);

  // A confirmed account on a fresh device skips the question (the server already knows).
  const serverConfirmed = !!profile?.age_confirmed_13;
  useEffect(() => {
    // The server keeps only the yes/no flag; a confirmed account adopts a passing year on this device.
    if (status === 'ask' && serverConfirmed) answer(new Date().getFullYear() - 18);
  }, [status, serverConfirmed, answer]);

  // Mirror the device answer to the server once the account is known.
  useEffect(() => {
    if (synced.current || !user || !session || year == null) return;
    if (status === 'ok' && !serverConfirmed && profile) {
      synced.current = true;
      void syncAgeCheck(session.access_token, year).then((r) => {
        if (r?.ok) void refreshProfile();
        else synced.current = false; // try again next time (route/migration may lag the deploy)
      });
    } else if (status === 'under' && !profile?.age_under13_at) {
      synced.current = true;
      void syncAgeCheck(session.access_token, year);
    }
  }, [status, user, session, profile, year, serverConfirmed, refreshProfile]);

  // Under 13: leave the account and the guest flag behind.
  useEffect(() => {
    if (status !== 'under') return;
    // Drop the guest marker from storage only (the in-memory guest state stays so this screen keeps showing).
    try { localStorage.removeItem('wordocious-guest'); } catch {}
    if (user) {
      const t = setTimeout(() => void signOut(), 800); // after the server note above is sent
      return () => clearTimeout(t);
    }
  }, [status, user, signOut]);

  if (status === 'under') return <AgeCheckUnder />;
  if (status === 'ask') {
    // Existing signed-in account whose profile hasn't loaded yet may already be confirmed on the server.
    if (user && !profile) return null;
    return <AgeCheckQuestion onAnswer={answer} />;
  }
  if (status === 'loading') return null;
  return <>{children}</>;
}

/** For the sign-in / sign-up form: ask before an account can be created from this device. */
export function AgeGateForSignUp({ children }: { children: React.ReactNode }) {
  const { status, answer } = useDeviceAgeCheck();
  if (status === 'under') return <AgeCheckUnder />;
  if (status === 'ask') return <AgeCheckQuestion onAnswer={answer} />;
  if (status === 'loading') return null;
  return <>{children}</>;
}
