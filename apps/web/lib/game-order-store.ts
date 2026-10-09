'use client';

// The player's saved game order (FRIDAY-QUEUE item 35), web side.
// Signed in: profiles.game_order (jsonb, synced across devices) with a per-user local mirror so the
// order paints instantly and survives a slow profile fetch. Guest: local storage only.
// Gate: the `custom_game_order` off-switch (off = everybody sees the default order, no editing).
// Pure rules live in @wordle-duel/core game-order.ts (shared with iOS / Android ports).

import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import {
  DEFAULT_DAILIES_ORDER, DEFAULT_PUZZLES_ORDER, PINNED_FIRST_DAILY, applyGameOrder, isDefaultOrder, moveGame, parseGameOrder,
  type GameOrderPrefs, type GameOrderSection,
} from '@wordle-duel/core';
import { supabase } from '@/lib/supabase-client';
import { useAuth } from '@/lib/auth-context';
import { useFlags } from '@/hooks/use-flags';

const KEY_PREFIX = 'wordocious-game-order:';
const listeners = new Set<() => void>();
let version = 0;
const bump = () => { version += 1; listeners.forEach((l) => l()); };

export const gameOrderKey = (userId: string | null | undefined) => `${KEY_PREFIX}${userId ?? 'guest'}`;

export function readLocalOrder(userId: string | null | undefined): GameOrderPrefs | null {
  try {
    const raw = localStorage.getItem(gameOrderKey(userId));
    return raw ? parseGameOrder(JSON.parse(raw)) : null;
  } catch { return null; }
}

export function writeLocalOrder(userId: string | null | undefined, prefs: GameOrderPrefs | null): void {
  try {
    if (prefs) localStorage.setItem(gameOrderKey(userId), JSON.stringify(prefs));
    else localStorage.removeItem(gameOrderKey(userId));
  } catch { /* private mode: the order just won't persist on this device */ }
  bump();
}

/** Default ids per section, as this build knows them. */
export const DEFAULT_IDS: Record<GameOrderSection, readonly string[]> = {
  dailies: DEFAULT_DAILIES_ORDER,
  puzzles: DEFAULT_PUZZLES_ORDER,
};
export const PIN: Record<GameOrderSection, string | null> = { dailies: PINNED_FIRST_DAILY, puzzles: null };

export interface GameOrderApi {
  /** The saved order (null = default). Always null while the off-switch is off. */
  order: GameOrderPrefs | null;
  /** Editing is available (off-switch live). */
  canEdit: boolean;
  /** Move one game within a section (indices into the resolved visible order) and save. */
  move: (section: GameOrderSection, visibleIds: readonly string[], from: number, to: number) => void;
  /** Back to the default order for a section. */
  reset: (section: GameOrderSection) => void;
}

export function useGameOrder(): GameOrderApi {
  const { user, profile } = useAuth();
  const { isLive } = useFlags();
  const live = isLive('custom_game_order');
  const userId = user?.id ?? null;
  const v = useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
    () => version,
    () => 0,
  );
  const profileOrder = useMemo(() => parseGameOrder((profile as { game_order?: unknown } | null)?.game_order), [profile]);
  // The profile row is the cross-device truth: when it loads / changes, mirror it locally.
  useEffect(() => {
    if (!userId || !profile) return;
    writeLocalOrder(userId, profileOrder);
  }, [userId, profile, profileOrder]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const local = useMemo(() => (typeof window === 'undefined' ? null : readLocalOrder(userId)), [userId, v]);
  const order = live ? local ?? profileOrder : null;

  const save = useCallback((next: GameOrderPrefs | null) => {
    writeLocalOrder(userId, next);
    if (!userId) return;
    (supabase as any).from('profiles').update({ game_order: next }).eq('id', userId).then(() => {}, () => {});
  }, [userId]);

  const move = useCallback((section: GameOrderSection, visibleIds: readonly string[], from: number, to: number) => {
    const base = order ?? { dailies: [], puzzles: [] };
    const moved = moveGame(visibleIds, from, to, PIN[section]);
    const next: GameOrderPrefs = { ...base, [section]: moved };
    const allDefault = isDefaultOrder(DEFAULT_IDS.dailies, next.dailies, PIN.dailies) && isDefaultOrder(DEFAULT_IDS.puzzles, next.puzzles, null);
    save(allDefault ? null : next);
  }, [order, save]);

  const reset = useCallback((section: GameOrderSection) => {
    const base = order ?? { dailies: [], puzzles: [] };
    const next: GameOrderPrefs = { ...base, [section]: [] };
    save(next.dailies.length || next.puzzles.length ? next : null);
  }, [order, save]);

  return { order, canEdit: live, move, reset };
}

/** A section's resolved id order (saved order over the default), for callers that only need ids. */
export function resolvedOrder(section: GameOrderSection, order: GameOrderPrefs | null): string[] {
  return applyGameOrder(DEFAULT_IDS[section], order?.[section], PIN[section]);
}
