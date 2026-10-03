// Avatar fields on every player a list returns (FINISH_SPEC AH + AN3, founder
// 2026-10-02): Friends, leaderboards, VS, pocket games, the feed. Each player
// object gains, additively:
//   avatar_cast_id  text | null   (AH: the cast hero they wear)
//   avatar_frame    text | null   (AH/AN6: the chosen frame; clients clamp to the level)
//   avatar_config   object | null (AN3: the build-your-own mascot; null = core defaultAvatar)
//   is_pro          boolean       (Pro ACTIVE now: lib/pro.ts isProActive, never the raw flag)
//
// NULL-SAFE: the three avatar columns ship in docs/sql/20261002-avatar-cast.sql,
// applied by hand later. Until then a select naming them fails (42703 /
// PGRST204), so every read here retries without them and remembers for a few
// minutes that they are missing (one query per response in steady state; the
// columns are picked up within RECHECK_MS of the migration). Nothing here ever
// throws: a failed read leaves the players with null fields and is_pro false.
//
// Isomorphic (no server-only imports): routes pass the service-role client,
// the web leaderboard wrappers pass the browser client (profiles SELECT is
// public, `using (true)`).

import { isProActive } from './pro';
import { isMissingColumnError } from './avatar-cast';

export interface AvatarFields {
  avatar_cast_id: string | null;
  avatar_frame: string | null;
  avatar_config: Record<string, unknown> | null;
  is_pro: boolean;
}

export const NO_AVATAR_FIELDS: Readonly<AvatarFields> = Object.freeze({
  avatar_cast_id: null,
  avatar_frame: null,
  avatar_config: null,
  is_pro: false,
});

/** The columns isProActive reads (exist today). */
export const PRO_COLUMNS = 'is_pro, pro_expires_at';
/** The columns docs/sql/20261002-avatar-cast.sql adds (may be missing). */
export const AVATAR_COLUMNS = 'avatar_cast_id, avatar_frame, avatar_config';

/** Most ids one response looks up (dedupe first); keeps `in.(…)` URLs short. */
export const MAX_AVATAR_IDS = 300;
const CHUNK = 100;

/** How long a "columns missing" answer is trusted before the next probe. */
export const RECHECK_MS = 5 * 60 * 1000;
let missingAt: number | null = null;

export function avatarColumnsAssumedMissing(now = Date.now()): boolean {
  return missingAt !== null && now - missingAt < RECHECK_MS;
}

export function __resetAvatarColumnsMemoForTests(): void {
  missingAt = null;
}

const shortString = (v: unknown): string | null =>
  typeof v === 'string' && v.length > 0 && v.length <= 32 ? v : null;

/** The four fields from a profile row (missing columns / junk read as null; is_pro = active Pro). */
export function avatarFieldsOf(row: unknown): AvatarFields {
  if (!row || typeof row !== 'object') return { ...NO_AVATAR_FIELDS };
  const r = row as Record<string, unknown>;
  const cfg = r.avatar_config;
  return {
    avatar_cast_id: shortString(r.avatar_cast_id),
    avatar_frame: shortString(r.avatar_frame),
    avatar_config: cfg && typeof cfg === 'object' && !Array.isArray(cfg) ? (cfg as Record<string, unknown>) : null,
    is_pro: isProActive(r as { is_pro?: boolean | null; pro_expires_at?: string | null }),
  };
}

/**
 * A profile-ish row with the raw Pro/avatar columns replaced by the four
 * fields (pro_expires_at dropped; is_pro becomes "active now").
 */
export function withOwnAvatarFields<T extends object>(row: T): Omit<T, 'pro_expires_at' | keyof AvatarFields> & AvatarFields {
  const {
    pro_expires_at: _expires, is_pro: _isPro, avatar_cast_id: _cast, avatar_frame: _frame, avatar_config: _cfg,
    ...rest
  } = row as T & Partial<AvatarFields> & { pro_expires_at?: unknown };
  return { ...(rest as Omit<T, 'pro_expires_at' | keyof AvatarFields>), ...avatarFieldsOf(row) };
}

/** `obj` plus a looked-up player's fields (all null / false when unknown). */
export function withAvatarFields<T extends object>(obj: T, fields: AvatarFields | undefined): T & AvatarFields {
  return { ...obj, ...(fields ?? NO_AVATAR_FIELDS) };
}

/** A PostgREST-style result (error has a message, like PostgrestError). */
export type QueryResult<R> = { data: R | null; error: { message: string; code?: string } | null };

/**
 * Runs a select whose column list gets `extra` appended (", is_pro,
 * pro_expires_at, avatar_cast_id, avatar_frame, avatar_config", or without
 * the avatar columns while they are known missing). Works for top-level
 * selects AND embeds: `profiles!fk(id, username${extra})`. If the select with
 * the avatar columns fails for any reason, it is retried once without them;
 * when that retry succeeds (or the error was a missing column) the columns
 * are remembered as missing for RECHECK_MS.
 */
export async function selectWithAvatarColumns<R = any>(
  // Loosely typed on purpose: supabase-js can't parse a column list built at
  // runtime (ParserError rows), so callers name the row type R instead.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  run: (extra: string) => PromiseLike<{ data: any; error: any }>,
  now = Date.now(),
): Promise<QueryResult<R>> {
  const base = `, ${PRO_COLUMNS}`;
  if (avatarColumnsAssumedMissing(now)) return run(base);
  const first: QueryResult<R> = await run(`${base}, ${AVATAR_COLUMNS}`);
  if (!first.error) {
    missingAt = null;
    return first;
  }
  const second: QueryResult<R> = await run(base);
  if (!second.error || isMissingColumnError(first.error)) missingAt = now;
  if (!second.error) return second;
  // Both failed: report the error that isn't about our optional columns.
  return isMissingColumnError(first.error) ? second : first;
}

/** The slice of a Supabase client the lookup needs (a fake in tests). */
export interface ProfilesReader {
  from(table: 'profiles'): {
    select(columns: string): { in(column: 'id', values: string[]): PromiseLike<QueryResult<unknown[]>> };
  };
}

/**
 * ONE batched profiles read (chunked by 100 past that, capped at
 * MAX_AVATAR_IDS) → id → fields. Never throws; ids it can't read are absent.
 */
export async function fetchAvatarFields(
  /** A Supabase client (service-role or browser) or anything shaped like ProfilesReader. */
  client: object,
  ids: Iterable<string | null | undefined>,
  /** BJ5 (web boards only): also read accent_color (the seeded mascot's color). Server routes leave it off. */
  opts?: { accent?: boolean },
): Promise<Map<string, AvatarFields & { accent_color?: string | null }>> {
  const out = new Map<string, AvatarFields & { accent_color?: string | null }>();
  const cols = opts?.accent ? 'id, accent_color' : 'id';
  const unique = [...new Set([...ids].filter((id): id is string => typeof id === 'string' && id.length > 0))].slice(0, MAX_AVATAR_IDS);
  if (unique.length === 0) return out;
  const reader = client as ProfilesReader;
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += CHUNK) chunks.push(unique.slice(i, i + CHUNK));
  const results = await Promise.all(chunks.map(async (chunk) => {
    try {
      return await selectWithAvatarColumns((extra) => reader.from('profiles').select(`${cols}${extra}`).in('id', chunk));
    } catch {
      return { data: null, error: { message: 'profiles lookup failed' } } as QueryResult<unknown[]>;
    }
  }));
  for (const res of results) {
    for (const row of (res.data ?? []) as Array<{ id?: unknown }>) {
      if (row && typeof row.id === 'string') {
        const accent = (row as { accent_color?: unknown }).accent_color;
        out.set(row.id, opts?.accent
          ? { ...avatarFieldsOf(row), accent_color: typeof accent === 'string' && accent.length > 0 ? accent : null }
          : avatarFieldsOf(row));
      }
    }
  }
  return out;
}

/** Each row plus its player's fields, looked up in one batched read. */
export async function mergeAvatarFields<T extends object>(
  client: object,
  rows: T[],
  idOf: (row: T) => string | null | undefined,
  opts?: { accent?: boolean },
): Promise<Array<T & AvatarFields>> {
  if (rows.length === 0) return [];
  const fields = await fetchAvatarFields(client, rows.map(idOf), opts);
  return rows.map((r) => {
    const id = idOf(r);
    return withAvatarFields(r, id ? fields.get(id) : undefined);
  });
}
