// Pick-a-character avatars (FINISH_SPEC AH). A player can wear one of the ten
// cast heroes as their avatar (profiles.avatar_cast_id, null = photo / letter
// tile) inside a level-tier frame ring (profiles.avatar_frame, null = the
// current tier). Pure helpers only: the color table, the frame choice, the
// tolerant read of the columns (they may not exist yet: docs/sql/
// 20261002-avatar-cast.sql is applied by hand), and the save that falls back
// when PostgREST doesn't know the columns (keeps the choice locally, retries).

import {
  BOT_CAST, levelTier, resolveAvatar, validateAvatar, type AvatarConfig, type LevelTier, type ResolvedAvatar,
} from '@wordle-duel/core';
import { CAST, type MascotId } from './mascots';

/** The pickable heroes, in WORDOCIOUS order. */
export const AVATAR_CAST_IDS: readonly MascotId[] = CAST;

export function isAvatarCastId(v: unknown): v is MascotId {
  return typeof v === 'string' && (AVATAR_CAST_IDS as readonly string[]).includes(v);
}

const BY_CAST = new Map(BOT_CAST.map((b) => [b.castId as string, b]));

/** Each hero's own color (the same as its VS bot's, core BOT_CAST). */
export const AVATAR_CAST_COLOR: Record<MascotId, string> = Object.fromEntries(
  AVATAR_CAST_IDS.map((id) => [id, BY_CAST.get(id)?.color ?? '#7c3aed']),
) as Record<MascotId, string>;

/** Each hero's name (its VS bot's name), for labels. */
export const AVATAR_CAST_NAME: Record<MascotId, string> = Object.fromEntries(
  AVATAR_CAST_IDS.map((id) => [id, BY_CAST.get(id)?.name ?? id.toUpperCase()]),
) as Record<MascotId, string>;

export function avatarCastColor(id: MascotId): string {
  return AVATAR_CAST_COLOR[id];
}

// ── Frames ──────────────────────────────────────────────────────────────────

export const AVATAR_FRAMES: readonly LevelTier[] = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];

export function isAvatarFrame(v: unknown): v is LevelTier {
  return typeof v === 'string' && (AVATAR_FRAMES as readonly string[]).includes(v);
}

/** The code-drawn ring colors (until art-frame-<tier> ships): main stroke + the inner shine. */
export const FRAME_COLOR: Record<LevelTier, { ring: string; shine: string }> = {
  bronze: { ring: '#c47a3a', shine: '#f3c08f' },
  silver: { ring: '#94a3b8', shine: '#eef2f7' },
  gold: { ring: '#f2b01e', shine: '#fff1b8' },
  platinum: { ring: '#5fb8c9', shine: '#dff7fb' },
  diamond: { ring: '#6d8dfc', shine: '#e6ecff' },
};

/** The frames a level has unlocked (Bronze always). */
export function unlockedFrames(level: number | null | undefined): LevelTier[] {
  const top = AVATAR_FRAMES.indexOf(levelTier(Number(level) || 0));
  return AVATAR_FRAMES.slice(0, top + 1);
}

/**
 * The frame an avatar wears: the chosen frame when the level has unlocked it,
 * else the level's own tier. Null when the level isn't known (no frame drawn).
 */
export function avatarFrameFor(level: number | null | undefined, chosen?: unknown): LevelTier | null {
  if (level == null || !Number.isFinite(level)) return null;
  const tier = levelTier(level);
  if (isAvatarFrame(chosen) && AVATAR_FRAMES.indexOf(chosen) <= AVATAR_FRAMES.indexOf(tier)) return chosen;
  return tier;
}

/** The tier's frame art (night art 10-03; outer edge = the canvas). Drawn over the avatar once it loads. */
export function frameArtName(tier: LevelTier): string {
  return `art-frame-${tier}`;
}

// ── Reading the columns (tolerant) ─────────────────────────────────────────

export interface AvatarChoice {
  castId: MascotId | null;
  frame: LevelTier | null;
  /** FINISH_SPEC AN3: the built mascot (profiles.avatar_config); undefined = not part of this choice. */
  config?: AvatarConfig | null;
}

export const NO_AVATAR_CHOICE: AvatarChoice = { castId: null, frame: null };

/** The choice on a profile row; missing columns / unknown values read as null. */
export function readAvatarChoice(row: unknown): AvatarChoice {
  if (!row || typeof row !== 'object') return NO_AVATAR_CHOICE;
  const r = row as Record<string, unknown>;
  return {
    castId: isAvatarCastId(r.avatar_cast_id) ? r.avatar_cast_id : null,
    frame: isAvatarFrame(r.avatar_frame) ? r.avatar_frame : null,
  };
}

/** PostgREST "unknown column" (PGRST204, schema cache) or Postgres 42703 (undefined_column). */
export function isMissingColumnError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: unknown; message?: unknown };
  if (e.code === 'PGRST204' || e.code === '42703') return true;
  const m = typeof e.message === 'string' ? e.message : '';
  return /could not find the '[^']+' column/i.test(m) || /column "?[\w.]+"? (of relation "?\w+"? )?does not exist/i.test(m);
}

// ── The locally kept choice (columns missing) ──────────────────────────────

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function pendingChoiceKey(userId: string): string {
  return `wordocious.avatarChoice.${userId}`;
}

/** The choice kept on this device because the server couldn't store it yet, or null. */
export function readPendingChoice(userId: string | null | undefined, storage: StorageLike | null = defaultStorage()): AvatarChoice | null {
  if (!userId || !storage) return null;
  try {
    const raw = storage.getItem(pendingChoiceKey(userId));
    if (!raw) return null;
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== 'object') return null;
    const j = v as AvatarChoiceJson;
    const choice = readAvatarChoice({ avatar_cast_id: j.castId, avatar_frame: j.frame });
    return j.config && typeof j.config === 'object' ? { ...choice, config: validateAvatar(j.config) } : choice;
  } catch {
    return null;
  }
}

interface AvatarChoiceJson { castId?: unknown; frame?: unknown; config?: unknown }

export function writePendingChoice(userId: string, choice: AvatarChoice, storage: StorageLike | null = defaultStorage()): void {
  try { storage?.setItem(pendingChoiceKey(userId), JSON.stringify(choice)); } catch { /* storage full / blocked */ }
}

export function clearPendingChoice(userId: string, storage: StorageLike | null = defaultStorage()): void {
  try { storage?.removeItem(pendingChoiceKey(userId)); } catch { /* blocked */ }
}

/** What the signed-in player wears: the locally kept choice wins until the server has it. */
export function ownAvatarChoice(row: unknown, pending: AvatarChoice | null): AvatarChoice {
  return pending ?? readAvatarChoice(row);
}

// ── Saving ──────────────────────────────────────────────────────────────────

/** The slice of the Supabase client the save needs (a fake in tests). */
export interface ProfilesUpdater {
  from(table: 'profiles'): {
    update(patch: Record<string, unknown>): { eq(col: 'id', v: string): PromiseLike<{ error: unknown }> };
  };
}

export interface AvatarSaveResult {
  /** The error of the profile save itself (null = saved). */
  error: unknown;
  /** True when the avatar choice is only kept on this device (columns missing). */
  pending: boolean;
}

/**
 * Saves `rest` (the other profile fields) together with the avatar choice. If
 * the database doesn't have the avatar columns yet, saves `rest` alone and
 * keeps the choice on this device (retried by retryPendingChoice).
 */
export async function saveProfileWithAvatar(
  client: ProfilesUpdater,
  userId: string,
  rest: Record<string, unknown>,
  choice: AvatarChoice,
  storage: StorageLike | null = defaultStorage(),
): Promise<AvatarSaveResult> {
  const first = await client.from('profiles').update({ ...rest, ...avatarColumns(choice) }).eq('id', userId);
  if (!first.error) {
    clearPendingChoice(userId, storage);
    return { error: null, pending: false };
  }
  if (!isMissingColumnError(first.error)) return { error: first.error, pending: false };
  writePendingChoice(userId, choice, storage);
  if (Object.keys(rest).length === 0) return { error: null, pending: true };
  const second = await client.from('profiles').update(rest).eq('id', userId);
  return { error: second.error ?? null, pending: true };
}

/** The avatar columns a choice writes (avatar_config only when the choice carries one). */
export function avatarColumns(choice: AvatarChoice): Record<string, unknown> {
  const cols: Record<string, unknown> = { avatar_cast_id: choice.castId, avatar_frame: choice.frame };
  if (choice.config !== undefined) cols.avatar_config = choice.config;
  return cols;
}

export type RetryOutcome = 'none' | 'saved' | 'missing' | 'error';

/** Pushes a locally kept choice to the server (once the columns exist). */
export async function retryPendingChoice(
  client: ProfilesUpdater,
  userId: string,
  storage: StorageLike | null = defaultStorage(),
): Promise<RetryOutcome> {
  const pending = readPendingChoice(userId, storage);
  if (!pending) return 'none';
  const { error } = await client.from('profiles').update(avatarColumns(pending)).eq('id', userId);
  if (!error) {
    clearPendingChoice(userId, storage);
    return 'saved';
  }
  return isMissingColumnError(error) ? 'missing' : 'error';
}

// ── The built mascot (FINISH_SPEC AN3) ─────────────────────────────────────

/** The avatar fields a row may carry (any may be missing: columns not applied yet, or an API that doesn't send them). */
export interface AvatarRowFields {
  avatar_url?: unknown;
  avatar_config?: unknown;
  avatar_cast_id?: unknown;
  avatar_frame?: unknown;
}

/**
 * FINISH_SPEC BJ5: the ONE avatar precedence (core resolveAvatar, pinned by
 * the avatar-resolve fixtures shared with iOS + Android): a saved
 * avatar_config (photo only when it says display 'photo' and there is a
 * photo), else an UPLOADED photo (our avatars bucket), else a worn cast hero,
 * else the seeded default mascot. An OAuth picture with no saved config is
 * never drawn (it reads as a plain letter tile). `username` seeds the default
 * (core trims + lowercases it).
 */
export function resolveRowAvatar(
  row: AvatarRowFields | null | undefined,
  username: string | null | undefined,
  accentHex?: string | null,
): ResolvedAvatar {
  return resolveAvatar({
    username: username ?? '',
    avatarUrl: typeof row?.avatar_url === 'string' ? row.avatar_url : null,
    config: row?.avatar_config,
    castId: row?.avatar_cast_id,
    frame: row?.avatar_frame,
    accentHex: accentHex ?? null,
  });
}

/** The mascot a row wears (resolveRowAvatar's config; its display says whether the photo shows). */
export function resolveAvatarConfig(row: AvatarRowFields | null | undefined, seed: string, accentHex?: string | null): AvatarConfig {
  return resolveRowAvatar(row, seed, accentHex).config;
}

/** The legacy AH columns a saved mascot writes alongside avatar_config (no cast pick; a tier frame or null). */
export function choiceForConfig(config: AvatarConfig): AvatarChoice {
  return { castId: null, frame: isAvatarFrame(config.frame) ? config.frame : null, config };
}
