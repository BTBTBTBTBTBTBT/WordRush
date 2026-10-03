'use client';

// The page's one avatar directory (lib/avatar-lookup.ts) on the browser
// Supabase client, plus the hook PlayerAvatar uses to fill a name-only row.

import * as React from 'react';

import { supabase } from './supabase-client';
import { invalidateBoardCaches } from './leaderboard-cache';
import { createAvatarDirectory, isProfileId, type AvatarLookupClient, type AvatarLookupRow } from './avatar-lookup';

export const avatarDirectory = createAvatarDirectory(() => supabase as unknown as AvatarLookupClient);

const serverVersion = () => 0;
const noopSubscribe = () => () => {};

/**
 * The looked-up row for a player drawn without their avatar fields, or null
 * (not asked / unknown / `enabled` false). By id when the row has a real
 * profile id, else by username when `byName` (human players only: a bot's
 * name must never pick up a real player's look).
 */
export function useAvatarLookup(
  enabled: boolean,
  userId: string | null | undefined,
  username: string | null | undefined,
  byName: boolean,
): AvatarLookupRow | null {
  const by: 'id' | 'username' | null = !enabled
    ? null
    : isProfileId(userId) ? 'id'
      : byName && username && username.trim() ? 'username' : null;
  const value = by === 'id' ? userId! : by === 'username' ? username!.trim() : '';
  // Only rows that need a lookup listen (a carried row never re-renders for it).
  React.useSyncExternalStore(by ? avatarDirectory.subscribe : noopSubscribe, by ? avatarDirectory.version : serverVersion, serverVersion);
  React.useEffect(() => {
    if (by) avatarDirectory.request(by, value);
  }, [by, value]);
  return by ? avatarDirectory.get(by, value) ?? null : null;
}

/**
 * BJ5: call after the signed-in player saves their avatar / profile — the
 * cached boards are dropped and their directory row is looked up afresh.
 */
export function afterOwnAvatarSave(userId: string | null | undefined): void {
  try { invalidateBoardCaches(); } catch { /* storage blocked */ }
  if (userId) avatarDirectory.forget('id', userId);
}
