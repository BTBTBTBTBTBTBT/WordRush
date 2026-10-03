'use client';

import * as React from 'react';
import type { AvatarConfig } from '@wordle-duel/core';

import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase-client';
import { avatarConfigKey, avatarInitial } from '@/lib/avatar-render';
import {
  readPendingChoice, resolveRowAvatar, retryPendingChoice, type AvatarRowFields, type ProfilesUpdater,
} from '@/lib/avatar-cast';
import { useAvatarLookup } from '@/lib/avatar-directory';
import { homeHostChoice, type HomeHostChoice } from '@/lib/home-host';
import { MascotAvatar, warmAvatarArt } from './mascot-avatar';

/**
 * FINISH_SPEC AN3 / AN5 / BJ5: the avatar for ANY player, through the ONE
 * precedence (core resolveAvatar via lib/avatar-cast resolveRowAvatar): a
 * saved avatar_config (its photo only when display = 'photo'), else an
 * uploaded photo, else a worn cast hero, else the seeded default mascot in
 * their accent — handed to the one renderer (MascotAvatar). An OAuth picture
 * with no saved config is never drawn. The signed-in player's own avatar
 * always comes from their profile (+ a choice kept on this device while the
 * avatar columns are missing), wherever it appears. A row drawn without its
 * avatar fields (config / cast / frame all undefined) is filled from the
 * avatar directory (lib/avatar-lookup.ts: by id, or by name when the caller
 * says the name is a human player's). Emoji avatars are retired (AM2).
 */
export interface PlayerAvatarInput {
  /** Username: the initial, the own-avatar match and the default mascot's seed (lowercased). */
  name: string | null | undefined;
  /** The row's user id (the own-avatar match). */
  userId?: string | null;
  /** The row's photo (avatar_url). */
  url?: string | null;
  /** The row's profile accent (accent_color) → the default mascot's color. */
  accent?: string | null;
  /** The row's avatar_config (any shape; validated). */
  config?: unknown;
  /** Legacy AH columns (avatar_cast_id / avatar_frame) when the row carries them. */
  castId?: unknown;
  frame?: unknown;
  /** The player's level when known (tier frames are clamped to it). */
  level?: number | null;
  /** The row's Pro flag (is_pro) when known. */
  pro?: boolean | null;
  /** BJ5: with no user id, look the player up by `name` (human players only — never a bot's name). */
  lookupByName?: boolean;
}

export interface PlayerAvatarLook {
  config: AvatarConfig;
  initial: string;
  url: string | null;
  pro: boolean | null;
  level: number | null;
  own: boolean;
}

/** Parity rule (web, iOS, Android): the default mascot is seeded by the lowercased username ('guest' when none). */
export function avatarSeed(username: string | null | undefined): string {
  return (username ?? '').trim().toLowerCase() || 'guest';
}

/** One retry per page load of an avatar choice the server couldn't store yet. */
let retryStarted = false;

type OwnProfile = Record<string, unknown> & { id: string; username?: string | null };

export function usePlayerAvatar(input: PlayerAvatarInput): PlayerAvatarLook {
  let auth: ReturnType<typeof useAuth> | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    auth = useAuth();
  } catch {
    // No AuthProvider above this avatar.
  }
  const profile = (auth?.profile ?? null) as OwnProfile | null;
  const n = input.name?.trim().toLowerCase();
  const own = !!profile && (input.userId ? input.userId === profile.id : !!n && n === String(profile.username ?? '').trim().toLowerCase());
  const pending = own ? readPendingChoice(profile!.id) : null;
  const ownId = own ? profile!.id : null;
  const hasPending = !!pending;
  const refresh = auth?.refreshProfile;

  React.useEffect(() => {
    if (!ownId || !hasPending || retryStarted) return;
    retryStarted = true;
    void retryPendingChoice(supabase as unknown as ProfilesUpdater, ownId)
      .then((r) => { if (r === 'saved') void refresh?.(); }, () => {});
  }, [ownId, hasPending, refresh]);

  // BJ5: a row that carries none of the avatar fields asks the directory (never for the own avatar).
  const carried = input.config !== undefined || input.castId !== undefined || input.frame !== undefined;
  const found = useAvatarLookup(!own && !carried, input.userId, input.name, !!input.lookupByName);

  const ownName = own ? String(profile!.username ?? '') : '';
  const resolved = own
    ? resolveRowAvatar(
      {
        avatar_url: profile!.avatar_url,
        avatar_config: pending?.config ?? profile!.avatar_config,
        avatar_cast_id: pending ? pending.castId : profile!.avatar_cast_id,
        avatar_frame: pending ? pending.frame : profile!.avatar_frame,
      } as AvatarRowFields,
      ownName,
      (profile!.accent_color as string | null | undefined) ?? null,
    )
    : found
      ? resolveRowAvatar(found, found.username ?? input.name, found.accent_color ?? input.accent)
      : resolveRowAvatar(
        { avatar_url: input.url, avatar_config: input.config, avatar_cast_id: input.castId, avatar_frame: input.frame },
        input.name,
        input.accent,
      );
  // Keep the object stable across renders (MascotAvatar is memoized).
  const key = avatarConfigKey(resolved.config);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const config = React.useMemo(() => resolved.config, [key]);

  const ownLevel = own ? Number(profile!.level) : NaN;
  return {
    config,
    initial: avatarInitial(input.name ?? ownName),
    url: resolved.photoUrl,
    pro: own ? !!auth?.isProActive : input.pro ?? (found ? found.is_pro : null),
    level: own && Number.isFinite(ownLevel) ? ownLevel : input.level ?? found?.level ?? null,
    own,
  };
}

/**
 * FINISH_SPEC BJ6: who hosts the Home card (lib/home-host.ts homeHostChoice)
 * for the signed-in player — their photo as a framed portrait, else their
 * saved / cast mascot, else W (guests and the seeded default). With their
 * initial, level (the portrait's tier frame) and Pro state.
 */
export function useHomeHost(): { choice: HomeHostChoice; initial: string; level: number | null; pro: boolean | null } {
  let auth: ReturnType<typeof useAuth> | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    auth = useAuth();
  } catch {
    // No AuthProvider above.
  }
  const profile = (auth?.user ? auth.profile ?? null : null) as OwnProfile | null;
  const pending = profile ? readPendingChoice(profile.id) : null;
  const resolved = profile
    ? resolveRowAvatar(
      {
        avatar_url: profile.avatar_url,
        avatar_config: pending?.config ?? profile.avatar_config,
        avatar_cast_id: pending ? pending.castId : profile.avatar_cast_id,
        avatar_frame: pending ? pending.frame : profile.avatar_frame,
      } as AvatarRowFields,
      String(profile.username ?? ''),
      (profile.accent_color as string | null | undefined) ?? null,
    )
    : null;
  const next = homeHostChoice(resolved);
  // BJ6 round 4: warm the host's art parts during this first render (before Home's first paint).
  if (next.kind !== 'w') warmAvatarArt(next.config);
  const key = next.kind === 'w' ? 'w' : `${next.kind}|${next.kind === 'photo' ? next.photoUrl : ''}|${avatarConfigKey(next.config)}`;
  // Keep the object stable across renders (MascotAvatar is memoized).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const choice = React.useMemo(() => next, [key]);
  const level = profile ? Number(profile.level) : NaN;
  return {
    choice,
    initial: avatarInitial(String(profile?.username ?? '')),
    level: Number.isFinite(level) ? level : null,
    pro: profile ? !!auth?.isProActive : null,
  };
}

export interface PlayerAvatarProps extends PlayerAvatarInput {
  size: number;
  /** Draw the mascot even when there is a photo. */
  noPhoto?: boolean;
  /** An accessible name; omit when the name is printed beside the avatar. */
  label?: string;
  shadow?: string;
  className?: string;
  style?: React.CSSProperties;
}

/** A player's avatar: photo or mascot, in their frame, crowned when Pro. */
export function PlayerAvatar({ size, noPhoto = false, label, shadow, className, style, ...input }: PlayerAvatarProps) {
  const look = usePlayerAvatar(input);
  return (
    <MascotAvatar
      config={look.config}
      initial={look.initial}
      size={size}
      photoUrl={noPhoto ? null : look.url}
      pro={look.pro}
      level={look.level}
      label={label}
      shadow={shadow}
      className={className}
      style={style}
    />
  );
}
