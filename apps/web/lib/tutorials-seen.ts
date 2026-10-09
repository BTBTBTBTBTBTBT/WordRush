'use client';

// First-play tutorials, "seen" per game per player (FRIDAY-QUEUE item 12). Signed in: profiles.tutorials_seen
// (text[], supabase/manual-migrations/20261010000001_tutorials_seen.sql) merged with a local copy, so a new
// device does not show a card the player already dismissed. Guests: the local copy only. Until the column
// exists the read is simply empty and the write error is ignored (the local copy still holds).
// The decision and the list math are core (pocket-help.ts) so iOS and Android agree.
// iOS: TutorialsSeen.swift · Android: TutorialsSeen.kt.

import { useCallback, useEffect, useState } from 'react';
import { mergeTutorialsSeen, withTutorialSeen } from '@wordle-duel/core';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase-client';

const LOCAL_KEY = 'wordocious-tutorials-seen';

function readLocal(): string[] {
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : [];
  } catch { return []; }
}

function writeLocal(list: string[]): void {
  try { window.localStorage.setItem(LOCAL_KEY, JSON.stringify(list)); } catch { /* storage blocked */ }
}

/** `seen` is null until it is known (never show a tutorial on a guess); `mark` records a key. */
export function useTutorialsSeen(): { seen: string[] | null; mark: (key: string) => void } {
  const { user, profile } = useAuth();
  const [local, setLocal] = useState<string[] | null>(null);
  useEffect(() => { setLocal(readLocal()); }, []);

  const remote = ((profile as { tutorials_seen?: string[] | null } | null)?.tutorials_seen ?? []) as string[];
  const seen = local === null ? null : user && !profile ? null : mergeTutorialsSeen(local, user ? remote : []);

  const mark = useCallback((key: string) => {
    const next = withTutorialSeen(mergeTutorialsSeen(readLocal(), user ? remote : []), key);
    writeLocal(next);
    setLocal(next);
    if (user) {
      void (supabase as any).from('profiles').update({ tutorials_seen: next }).eq('id', user.id).then(() => undefined, () => undefined);
    }
  }, [user, remote]);

  return { seen, mark };
}
