'use client';

import * as React from 'react';
import type { AvatarConfig } from '@wordle-duel/core';

import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase-client';
import { avatarConfigKey, avatarInitial } from '@/lib/avatar-render';
import {
  readPendingChoice, resolveAvatarConfig, retryPendingChoice, type AvatarRowFields, type ProfilesUpdater,
} from '@/lib/avatar-cast';
import { MascotAvatar } from './mascot-avatar';

/**
 * FINISH_SPEC AN3 / AN5: the avatar for ANY player. Resolves what they wear —
 * their photo (rounded square), else their mascot: the row's avatar_config,
 * else an AH cast pick as that character's preset, else the deterministic
 * default (core defaultAvatar seeded by the lowercased username, in their
 * accent) — and hands it to the one renderer (MascotAvatar). The signed-in
 * player's own avatar always comes from their profile (+ a choice kept on
 * this device while the avatar columns are missing), wherever it appears.
 * Emoji avatars are retired (AM2): avatar_emoji is never drawn.
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

  const resolved: AvatarConfig = own
    ? (pending?.config ?? resolveAvatarConfig(
      pending ? { avatar_url: profile!.avatar_url, avatar_config: profile!.avatar_config, avatar_cast_id: pending.castId, avatar_frame: pending.frame } : (profile as AvatarRowFields),
      avatarSeed(String(profile!.username ?? '')),
      (profile!.accent_color as string | null | undefined) ?? null,
    ))
    : resolveAvatarConfig({ avatar_url: input.url, avatar_config: input.config, avatar_cast_id: input.castId, avatar_frame: input.frame }, avatarSeed(input.name), input.accent);
  // Keep the object stable across renders (MascotAvatar is memoized).
  const key = avatarConfigKey(resolved);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const config = React.useMemo(() => resolved, [key]);

  const ownLevel = own ? Number(profile!.level) : NaN;
  // The own photo comes from the profile (fresher than a cached row); a photo shows only when display = 'photo'.
  const photo = own ? ((profile!.avatar_url as string | null | undefined) ?? null) : input.url ?? null;
  return {
    config,
    initial: avatarInitial(input.name ?? (own ? String(profile!.username ?? '') : '')),
    url: config.display === 'photo' ? photo : null,
    pro: own ? !!auth?.isProActive : input.pro ?? null,
    level: own && Number.isFinite(ownLevel) ? ownLevel : input.level ?? null,
    own,
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
