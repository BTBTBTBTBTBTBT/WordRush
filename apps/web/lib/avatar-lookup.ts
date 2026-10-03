// FINISH_SPEC BJ5 safety net: name-only avatar payloads (VS challenges,
// realtime opponents, the lobby, records holders, older API responses) still
// resolve fully. Any avatar drawn without the player's avatar fields asks this
// in-memory directory, which batch-reads `profiles` (by id, or by username when
// that is all a payload carries) and caches the answer for the page's life.
// One query per ~40 ms burst per key kind; never throws; unknown players cache
// as null (they keep the seeded mascot). Parity with the iOS / Android
// directories.

import { avatarFieldsOf, selectWithAvatarColumns, type AvatarFields } from './avatar-fields-server';

/** A looked-up player: what the resolver needs (+ level / active Pro). */
export interface AvatarLookupRow extends AvatarFields {
  id: string;
  username: string | null;
  avatar_url: string | null;
  accent_color: string | null;
  level: number | null;
}

/** The slice of a Supabase client the directory needs (a fake in tests). */
export interface AvatarLookupClient {
  from(table: 'profiles'): {
    select(columns: string): { in(column: 'id' | 'username', values: string[]): PromiseLike<{ data: unknown; error: unknown }> };
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True for a real profile id (bot / race / solo pseudo-ids are never looked up). */
export function isProfileId(v: unknown): v is string {
  return typeof v === 'string' && UUID.test(v);
}

export const LOOKUP_DELAY_MS = 40;
const CHUNK = 100;

type Key = `id:${string}` | `u:${string}`;

export function lookupKey(by: 'id' | 'username', value: string): Key {
  return by === 'id' ? `id:${value.toLowerCase()}` : `u:${value.trim().toLowerCase()}`;
}

function rowOf(raw: unknown): AvatarLookupRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string') return null;
  const level = Number(r.level);
  return {
    id: r.id,
    username: typeof r.username === 'string' ? r.username : null,
    avatar_url: typeof r.avatar_url === 'string' && r.avatar_url.length > 0 ? r.avatar_url : null,
    accent_color: typeof r.accent_color === 'string' && r.accent_color.length > 0 ? r.accent_color : null,
    level: Number.isFinite(level) ? level : null,
    ...avatarFieldsOf(r),
  };
}

export interface AvatarDirectory {
  /** The cached row (undefined = not asked yet / in flight; null = no such player). */
  get(by: 'id' | 'username', value: string): AvatarLookupRow | null | undefined;
  /** Queues a lookup (no-op when cached or in flight). */
  request(by: 'id' | 'username', value: string): void;
  /** Seeds / replaces a row (e.g. after the signed-in player's own save). */
  put(row: AvatarLookupRow): void;
  /** Drops one player's cached row (their next draw looks them up again). */
  forget(by: 'id' | 'username', value: string): void;
  subscribe(listener: () => void): () => void;
  /** Bumps on every change (useSyncExternalStore snapshot). */
  version(): number;
  /** Runs any queued lookups now (tests). */
  flush(): Promise<void>;
}

export function createAvatarDirectory(
  client: () => AvatarLookupClient,
  schedule: (fn: () => void, ms: number) => unknown = (fn, ms) => setTimeout(fn, ms),
): AvatarDirectory {
  const cache = new Map<Key, AvatarLookupRow | null>();
  const queued = { id: new Set<string>(), username: new Set<string>() };
  const inflight = new Set<Key>();
  const listeners = new Set<() => void>();
  let ver = 0;
  let timer = false;

  const notify = () => {
    ver++;
    for (const l of [...listeners]) {
      try { l(); } catch { /* a listener's own problem */ }
    }
  };

  const store = (row: AvatarLookupRow) => {
    cache.set(lookupKey('id', row.id), row);
    if (row.username) cache.set(lookupKey('username', row.username), row);
  };

  async function run(by: 'id' | 'username', values: string[]): Promise<void> {
    for (let i = 0; i < values.length; i += CHUNK) {
      const chunk = values.slice(i, i + CHUNK);
      let rows: unknown[] = [];
      try {
        const res = await selectWithAvatarColumns<unknown[]>((extra) =>
          client().from('profiles').select(`id, username, avatar_url, accent_color, level${extra}`).in(by, chunk));
        rows = Array.isArray(res.data) ? res.data : [];
      } catch {
        rows = [];
      }
      for (const raw of rows) {
        const row = rowOf(raw);
        if (row) store(row);
      }
      for (const v of chunk) {
        const k = lookupKey(by, v);
        inflight.delete(k);
        if (!cache.has(k)) cache.set(k, null);
      }
    }
  }

  async function flush(): Promise<void> {
    timer = false;
    const ids = [...queued.id];
    const names = [...queued.username];
    queued.id.clear();
    queued.username.clear();
    if (ids.length === 0 && names.length === 0) return;
    await Promise.all([ids.length ? run('id', ids) : null, names.length ? run('username', names) : null]);
    notify();
  }

  return {
    get(by, value) {
      return cache.get(lookupKey(by, value));
    },
    request(by, value) {
      const v = by === 'id' ? value : value.trim();
      if (!v || (by === 'id' && !isProfileId(v))) return;
      const k = lookupKey(by, v);
      if (cache.has(k) || inflight.has(k)) return;
      inflight.add(k);
      queued[by].add(v);
      if (!timer) {
        timer = true;
        schedule(() => { void flush(); }, LOOKUP_DELAY_MS);
      }
    },
    put(row) {
      store(row);
      notify();
    },
    forget(by, value) {
      const row = cache.get(lookupKey(by, value));
      cache.delete(lookupKey(by, value));
      if (row) {
        cache.delete(lookupKey('id', row.id));
        if (row.username) cache.delete(lookupKey('username', row.username));
      }
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    version: () => ver,
    flush,
  };
}
