// Founder 2.7.1: "the purple guy populates the main square during the intro and
// then it just changes suddenly to your mascot. Can that always just be
// populated by your mascot?" On a cold start Home renders (AuthGate's
// returning-user fast path) before auth has even read the stored session, so
// the host had no profile and drew W, then popped to the player's look.
//
// The fix: the signed-in player's last host look is kept on this device, keyed
// by user id, and paints the host until the live profile lands. Pure rules here
// (injectable storage for tests); the hook is useHomeHost (player-avatar.tsx).

import type { AvatarConfig } from '@wordle-duel/core';

import { readPendingChoice, resolveRowAvatar, type AvatarRowFields, type StorageLike } from './avatar-cast';
import { avatarConfigKey, avatarInitial } from './avatar-render';
import { isSupabaseSessionKey, parseStoredSession } from './auth-session-policy';
import { homeHostChoice, type HomeHostChoice } from './home-host';

export const HOME_HOST_CACHE_KEY = 'wordocious-home-host';

/** Everything the host needs to draw: the choice, the plain seeded mascot (no custom look yet), initial, frame inputs. */
export interface HomeHostLook {
  choice: HomeHostChoice;
  /** No custom look yet → their own plain seeded mascot (the "Make me yours!" host). */
  seeded: AvatarConfig | null;
  initial: string;
  level: number | null;
  pro: boolean | null;
}

export interface HomeHostCacheEntry extends HomeHostLook {
  v: 1;
  uid: string;
}

/** 'live' = from the profile (or a guest); 'cached' = this device's last look; 'unknown' = a session is expected but nothing is known yet. */
export type HomeHostPhase = 'live' | 'cached' | 'unknown';

type ProfileLike = Record<string, unknown> & { id: string; username?: unknown };

function defaultStorage(): StorageLike | null {
  try {
    return typeof window === 'undefined' || typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

const W_LOOK: HomeHostLook = { choice: { kind: 'w' }, seeded: null, initial: avatarInitial(''), level: null, pro: null };

/** The guest / unknown host (W). */
export function wHostLook(): HomeHostLook {
  return W_LOOK;
}

/** The signed-in player's host look from their profile row (+ a choice kept on this device while the columns are missing). */
export function homeHostLookFor(profile: ProfileLike, pro: boolean, storage: StorageLike | null = defaultStorage()): HomeHostLook {
  const pending = readPendingChoice(profile.id, storage);
  const resolved = resolveRowAvatar(
    {
      avatar_url: profile.avatar_url,
      avatar_config: pending?.config ?? profile.avatar_config,
      avatar_cast_id: pending ? pending.castId : profile.avatar_cast_id,
      avatar_frame: pending ? pending.frame : profile.avatar_frame,
    } as AvatarRowFields,
    String(profile.username ?? ''),
    (profile.accent_color as string | null | undefined) ?? null,
  );
  const level = Number(profile.level);
  return {
    choice: homeHostChoice(resolved),
    seeded: resolved.kind === 'seeded' ? { ...resolved.config, display: 'mascot' } : null,
    initial: avatarInitial(String(profile.username ?? '')),
    level: Number.isFinite(level) ? level : null,
    pro,
  };
}

/** A stable identity for what the host shows (same key → nothing changes on screen). */
export function homeHostChoiceKey(choice: HomeHostChoice): string {
  if (choice.kind === 'w') return 'w';
  return `${choice.kind}|${choice.kind === 'photo' ? choice.photoUrl : ''}|${avatarConfigKey(choice.config)}`;
}

function isChoice(v: unknown): v is HomeHostChoice {
  if (!v || typeof v !== 'object') return false;
  const c = v as { kind?: unknown; config?: unknown; photoUrl?: unknown };
  if (c.kind === 'w') return true;
  if (!c.config || typeof c.config !== 'object') return false;
  if (c.kind === 'mascot') return true;
  return c.kind === 'photo' && typeof c.photoUrl === 'string' && !!c.photoUrl;
}

export function readHomeHostCache(storage: StorageLike | null = defaultStorage()): HomeHostCacheEntry | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(HOME_HOST_CACHE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<HomeHostCacheEntry> | null;
    if (!v || v.v !== 1 || typeof v.uid !== 'string' || !v.uid || !isChoice(v.choice)) return null;
    return {
      v: 1,
      uid: v.uid,
      choice: v.choice,
      seeded: v.seeded && typeof v.seeded === 'object' ? v.seeded : null,
      initial: typeof v.initial === 'string' ? v.initial : '',
      level: typeof v.level === 'number' && Number.isFinite(v.level) ? v.level : null,
      pro: typeof v.pro === 'boolean' ? v.pro : null,
    };
  } catch {
    return null;
  }
}

export function writeHomeHostCache(uid: string, look: HomeHostLook, storage: StorageLike | null = defaultStorage()): void {
  if (!storage || !uid) return;
  try {
    const entry: HomeHostCacheEntry = { v: 1, uid, ...look };
    storage.setItem(HOME_HOST_CACHE_KEY, JSON.stringify(entry));
  } catch {
    // Storage full / blocked: the host just falls back to the unknown state next launch.
  }
}

export function clearHomeHostCache(storage: StorageLike | null = defaultStorage()): void {
  if (!storage) return;
  try { storage.removeItem(HOME_HOST_CACHE_KEY); } catch { /* blocked */ }
}

/** Whether supabase-js has a session on disk, and whose (null id when it can't be read). */
export type ListableStorage = StorageLike & { readonly length: number; key(i: number): string | null };

export function storedSessionHint(storage: ListableStorage | null = defaultStorage() as ListableStorage | null): { expected: boolean; uid: string | null } {
  if (!storage) return { expected: false, uid: null };
  try {
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k && isSupabaseSessionKey(k)) {
        return { expected: true, uid: parseStoredSession(storage.getItem(k))?.user.id ?? null };
      }
    }
  } catch { /* blocked */ }
  return { expected: false, uid: null };
}

/**
 * Which look the host shows right now.
 *   • the live look (profile resolved) always wins;
 *   • no session at all (a guest / signed out) → W, today's behavior;
 *   • a session is known or expected (auth still loading with one on disk) →
 *     this device's cached look, but only when it is THIS user's (once the id
 *     is known; before that, the expected session is trusted — sign-out clears
 *     the entry, so it can only be the last signed-in player);
 *   • nothing cached → 'unknown': the host stays invisible (no W, no bubble) until known.
 */
export function pickHomeHostLook(input: {
  live: HomeHostLook | null;
  /** The signed-in user's id when auth knows it (auth.user). */
  userId: string | null;
  /** Auth is still resolving (auth.loading). */
  loading: boolean;
  /** The stored session supabase-js keeps on disk. */
  session: { expected: boolean; uid: string | null };
  cache: HomeHostCacheEntry | null;
}): { look: HomeHostLook; phase: HomeHostPhase; uid: string | null } {
  const { live, userId, loading, session, cache } = input;
  if (live) return { look: live, phase: 'live', uid: userId };
  const expected = !!userId || (loading && session.expected);
  if (!expected) return { look: W_LOOK, phase: 'live', uid: null };
  const uid = userId ?? session.uid;
  if (cache && (uid ? cache.uid === uid : true)) {
    const look: HomeHostLook = { choice: cache.choice, seeded: cache.seeded, initial: cache.initial, level: cache.level, pro: cache.pro };
    return { look, phase: 'cached', uid };
  }
  return { look: W_LOOK, phase: 'unknown', uid };
}

/** The invite bubble ("Make me yours!") only once the look is live, never from the cache or while unknown. */
export function homeHostInviteAllowed(phase: HomeHostPhase): boolean {
  return phase === 'live';
}

/**
 * The live look replacing what's on screen: the same look → nothing changes; a
 * different one → a soft ~200 ms crossfade (never a hard pop). From an invisible
 * host (unknown) the host's own fade-in carries it, so no crossfade.
 */
export function homeHostTransition(prevKey: string | null, nextKey: string, prevVisible: boolean): 'none' | 'crossfade' {
  if (prevKey === null || prevKey === nextKey || !prevVisible) return 'none';
  return 'crossfade';
}

export const HOME_HOST_CROSSFADE_MS = 200;
