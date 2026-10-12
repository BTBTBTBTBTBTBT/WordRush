'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useFlags } from '@/hooks/use-flags';
import { ageGateView, ageRecoveryDecision, AGE_GATE_MAX_WAIT_MS } from '@wordle-duel/core';
import { failAgeRecovery, isAgeRecoveryPending, readAgeCheck, saveAgeCheck, syncAgeCheck, unlockAgeCheck } from '@/lib/age-check';
import { supabase } from '@/lib/supabase-client';
import { startSentry } from '@/lib/sentry-start';
import { AgeCheckQuestion, AgeCheckUnder } from './age-check-screen';

// 13+ age check wiring (FRIDAY-QUEUE item 29).
//   - the answer sticks on this device (lib/age-check.ts); "under" can never be retried with another year
//   - nothing is created or stored for an under-13 visitor: no account, no guest flag, no crash reports
//   - signed-in accounts mirror the answer to the server (POST /api/account/age, service role); an
//     existing account that answers "under" is signed out and purged after a grace window
//   - the `age_check` off-switch (admin > Ops > Feature flags) turns the whole thing off
//   - recovery from a mistaken "under" (2026-10-12): the lockout's "A grown-up? Sign in" starts a sign-in whose account flag
//     decides (core ageRecoveryDecision): confirmed -> the device is unlocked; otherwise signed out again with a line, and the
//     under answer is NOT posted for that account (it must not be flagged or purged just for trying)

export type DeviceAgeStatus = 'loading' | 'ask' | 'ok' | 'under';

/** Device-level status (no account needed) + the setter that records an answer. */
export function useDeviceAgeCheck(): { status: DeviceAgeStatus; year: number | null; answer: (year: number) => void; unlock: () => void } {
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

  /** Recovery from a mistaken "under": the account's server flag confirmed 13+, so the device's answer becomes a passing one. */
  const unlock = useCallback(() => {
    const stored = unlockAgeCheck();
    setYear(stored.year);
    setStatus('ok');
    startSentry();
  }, []);

  return { status, year, answer, unlock };
}

/** Wraps the signed-in / guest app: asks once per device (and once per existing account). */
export function AgeGate({ children }: { children: React.ReactNode }) {
  const { user, profile, session, signOut, refreshProfile } = useAuth();
  const { status, year, answer, unlock } = useDeviceAgeCheck();
  const synced = useRef(false);
  // The wait for the server's answer is capped (a timer on this component, which always renders).
  const [waitedOut, setWaitedOut] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setWaitedOut(true), AGE_GATE_MAX_WAIT_MS);
    return () => clearTimeout(t);
  }, []);

  // A confirmed account on a fresh device skips the question (the server already knows).
  const serverConfirmed = !!profile?.age_confirmed_13;
  useEffect(() => {
    // The server keeps only the yes/no flag; a confirmed account adopts a passing year on this device.
    if (status === 'ask' && serverConfirmed) answer(new Date().getFullYear() - 18);
  }, [status, serverConfirmed, answer]);

  // A sign-in that started from the under-13 lockout: the account's flag decides. Confirmed -> unlock this device; anything
  // else -> sign out again and keep the lockout. Either way the under answer is never posted for that account.
  const userId = user?.id ?? null;
  // Set once a recovery sign-in failed, until that account is gone: nothing may post "under" for it in the meantime.
  const noPost = useRef(false);
  useEffect(() => { if (!userId) noPost.current = false; }, [userId]);
  useEffect(() => {
    if (status !== 'under' || !userId || !isAgeRecoveryPending()) return;
    let live = true;
    void (async () => {
      let confirmed: boolean | null = null;
      try {
        const { data } = await supabase.from('profiles').select('age_confirmed_13').eq('id', userId).maybeSingle();
        confirmed = (data as { age_confirmed_13?: boolean | null } | null)?.age_confirmed_13 ?? null;
      } catch {}
      if (!live || !isAgeRecoveryPending()) return;
      const decision = ageRecoveryDecision(confirmed);
      if (decision.action === 'unlock') {
        unlock();
        void refreshProfile();
      } else {
        noPost.current = true;
        failAgeRecovery();
        void signOut();
      }
    })();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, userId]);

  // Mirror the device answer to the server once the account is known.
  useEffect(() => {
    if (noPost.current || isAgeRecoveryPending()) return; // a recovery sign-in is being checked: never post "under" for it
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
    if (user && !isAgeRecoveryPending() && !noPost.current) {
      const t = setTimeout(() => void signOut(), 800); // after the server note above is sent
      return () => clearTimeout(t);
    }
  }, [status, user, signOut]);

  if (status === 'under') return <AgeCheckUnder />;
  if (status === 'ask') {
    // Existing signed-in account whose profile hasn't loaded yet may already be confirmed on the server: wait for that,
    // but never past AGE_GATE_MAX_WAIT_MS and never on a blank page (core ageGateView).
    const view = ageGateView({ stored: null, live: true, hadSession: !!user, serverCheckDone: !!profile, elapsedMs: waitedOut ? AGE_GATE_MAX_WAIT_MS : 0 });
    if (view === 'placeholder') return <div aria-hidden="true" className="fixed inset-0 z-[200]" style={{ background: 'linear-gradient(180deg, #eee4ff, #ffecf6)' }} />;
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
