// BI19 cache-first (founder, 2026-10-03: "make sure the information on all
// pages is quick to load and stays every time"): one persistent, per-user,
// versioned, size-bounded store behind every data page's stale-while-
// revalidate cache — the leaderboard / records board maps, the SWR cache
// (Stats and friends), Friends, Home's banner numbers, public profiles.
//
// A page paints what's here instantly and refreshes in the background; a
// failed or slow fetch never replaces it. Entries live in localStorage under
// `wordocious-pc-v1:<user>:<key>`, with a small LRU index so the whole cache
// stays under MAX_TOTAL_CHARS (oldest entries go first). Day-scoped entries
// carry their day and read as missing once it has passed.
//
// Values may contain Map / Set (the Sweep details, Stats' achievement sets):
// encode/decode round-trip them. Node-safe: storage is injectable for tests.

import { isSupabaseSessionKey, parseStoredSession } from './auth-session-policy';

export const PAGE_CACHE_VERSION = 1;
const PREFIX = `wordocious-pc-v${PAGE_CACHE_VERSION}:`;
const INDEX_KEY = `${PREFIX}__index`;
/** One entry larger than this (in UTF-16 chars) is not persisted (memory only). */
export const MAX_ENTRY_CHARS = 300_000;
/** The whole persisted cache stays under this (LRU eviction). */
export const MAX_TOTAL_CHARS = 1_500_000;
/** And under this many entries. */
export const MAX_ENTRIES = 120;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  key?(index: number): string | null;
  readonly length?: number;
}

let storageOverride: StorageLike | null = null;
/** Tests: swap in an in-memory storage (null = back to localStorage). */
export function setPageCacheStorage(s: StorageLike | null): void {
  storageOverride = s;
  memory.clear();
}

function storage(): StorageLike | null {
  if (storageOverride) return storageOverride;
  try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; }
}

// ── Map / Set-aware JSON ───────────────────────────────────────────────────

const TAG = '__wpc';

export function encode(value: unknown): string {
  return JSON.stringify(value, function replacer(this: unknown, _k: string, v: unknown) {
    if (v instanceof Map) return { [TAG]: 'Map', v: Array.from(v.entries()) };
    if (v instanceof Set) return { [TAG]: 'Set', v: Array.from(v.values()) };
    return v;
  });
}

export function decode<T = unknown>(raw: string): T {
  return JSON.parse(raw, (_k, v) => {
    if (v && typeof v === 'object' && !Array.isArray(v) && (v as any)[TAG]) {
      const t = (v as any)[TAG];
      if (t === 'Map') return new Map((v as any).v);
      if (t === 'Set') return new Set((v as any).v);
    }
    return v;
  }) as T;
}

/** Same data (by value, Maps and Sets included) — swap content in only when this is false. */
export function sameData(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  try { return encode(a) === encode(b); } catch { return false; }
}

// ── The cache user ─────────────────────────────────────────────────────────

let explicitUser: string | null | undefined;

/** AuthProvider keeps this current; null = signed out / guest. */
export function setCacheUser(userId: string | null): void {
  explicitUser = userId;
}

/**
 * Whose cache to read. Before auth resolves (a returning player's first
 * render) it's the user in the stored Supabase session, so pages can paint
 * that player's cache on the very first frame.
 */
export function cacheUser(): string | null {
  if (explicitUser !== undefined) return explicitUser;
  const s = storage();
  if (!s || typeof s.key !== 'function') return null;
  try {
    const n = (s as Storage).length ?? 0;
    for (let i = 0; i < n; i++) {
      const k = s.key(i);
      if (k && isSupabaseSessionKey(k)) {
        const sess = parseStoredSession(s.getItem(k));
        if (sess) return sess.user.id;
      }
    }
  } catch {}
  return null;
}

// ── Entries ─────────────────────────────────────────────────────────────────

interface Envelope { t: number; d?: string; v: string }
interface IndexRow { k: string; t: number; n: number }

/** In-memory mirror: a read after a write (or a too-big entry) never hits storage. */
const memory = new Map<string, { t: number; d?: string; value: unknown }>();

function fullKey(user: string | null, key: string): string {
  return `${PREFIX}${user ?? 'anon'}:${key}`;
}

function readIndex(s: StorageLike): IndexRow[] {
  try {
    const raw = s.getItem(INDEX_KEY);
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v.filter((r) => r && typeof r.k === 'string') : [];
  } catch { return []; }
}

function writeIndex(s: StorageLike, rows: IndexRow[]): void {
  try { s.setItem(INDEX_KEY, JSON.stringify(rows)); } catch {}
}

export interface CacheOpts {
  /** Defaults to cacheUser(). */
  user?: string | null;
  /** Day-scoped: a read on another day misses (and drops the entry). */
  day?: string;
}

/** The cached value, or undefined. Never throws. */
export function readPageCache<T>(key: string, opts: CacheOpts = {}): T | undefined {
  const user = opts.user !== undefined ? opts.user : cacheUser();
  const fk = fullKey(user, key);
  const mem = memory.get(fk);
  if (mem) {
    if (opts.day && mem.d && mem.d !== opts.day) { removePageCache(key, { user }); return undefined; }
    return mem.value as T;
  }
  const s = storage();
  if (!s) return undefined;
  try {
    const raw = s.getItem(fk);
    if (!raw) return undefined;
    const env = JSON.parse(raw) as Envelope;
    if (opts.day && env.d && env.d !== opts.day) { removePageCache(key, { user }); return undefined; }
    const value = decode<T>(env.v);
    memory.set(fk, { t: env.t, d: env.d, value });
    return value;
  } catch {
    return undefined;
  }
}

/**
 * Stores a value. Returns false (and writes nothing) when it equals what is
 * already cached — callers use that to skip a pointless re-render.
 */
export function writePageCache<T>(key: string, value: T, opts: CacheOpts = {}): boolean {
  const user = opts.user !== undefined ? opts.user : cacheUser();
  const fk = fullKey(user, key);
  const prev = memory.get(fk);
  let encoded: string;
  try { encoded = encode(value); } catch { return false; }
  if (prev && prev.d === opts.day && (() => { try { return encode(prev.value) === encoded; } catch { return false; } })()) return false;
  const t = Date.now();
  memory.set(fk, { t, d: opts.day, value });
  const s = storage();
  if (!s) return true;
  const envelope = JSON.stringify({ t, d: opts.day, v: encoded } satisfies Envelope);
  let rows = readIndex(s).filter((r) => r.k !== fk);
  if (envelope.length > MAX_ENTRY_CHARS) {
    try { s.removeItem(fk); } catch {}
    writeIndex(s, rows);
    return true;
  }
  rows.push({ k: fk, t, n: envelope.length });
  // LRU: oldest out until under both bounds.
  rows.sort((a, b) => a.t - b.t);
  let total = rows.reduce((sum, r) => sum + r.n, 0);
  while (rows.length > MAX_ENTRIES || total > MAX_TOTAL_CHARS) {
    const old = rows.shift();
    if (!old) break;
    total -= old.n;
    try { s.removeItem(old.k); } catch {}
  }
  if (!rows.some((r) => r.k === fk)) { writeIndex(s, rows); return true; }
  try {
    s.setItem(fk, envelope);
  } catch {
    // Quota: drop the oldest half and try once more.
    const drop = rows.splice(0, Math.ceil(rows.length / 2)).filter((r) => r.k !== fk);
    for (const r of drop) { try { s.removeItem(r.k); } catch {} }
    try { s.setItem(fk, envelope); } catch { rows = rows.filter((r) => r.k !== fk); }
  }
  writeIndex(s, rows);
  return true;
}

export function removePageCache(key: string, opts: CacheOpts = {}): void {
  const user = opts.user !== undefined ? opts.user : cacheUser();
  const fk = fullKey(user, key);
  memory.delete(fk);
  const s = storage();
  if (!s) return;
  try { s.removeItem(fk); } catch {}
  writeIndex(s, readIndex(s).filter((r) => r.k !== fk));
}

/**
 * FINISH_SPEC BJ5: forget every entry of one namespace for this user (e.g. the
 * leaderboard boards after an avatar save, so a stale row can't flash).
 */
export function clearPageCacheNamespace(namespace: string, opts: CacheOpts = {}): void {
  const user = opts.user !== undefined ? opts.user : cacheUser();
  const p = fullKey(user, `${namespace}:`);
  for (const k of Array.from(memory.keys())) if (k.startsWith(p)) memory.delete(k);
  const s = storage();
  if (!s) return;
  const rows = readIndex(s);
  for (const r of rows) if (r.k.startsWith(p)) { try { s.removeItem(r.k); } catch {} }
  writeIndex(s, rows.filter((r) => !r.k.startsWith(p)));
}

/** Sign-out: forget everything cached for this user (a shared device never shows it). */
export function clearPageCacheForUser(userId: string): void {
  const p = `${PREFIX}${userId}:`;
  for (const k of Array.from(memory.keys())) if (k.startsWith(p)) memory.delete(k);
  const s = storage();
  if (!s) return;
  const rows = readIndex(s);
  for (const r of rows) if (r.k.startsWith(p)) { try { s.removeItem(r.k); } catch {} }
  writeIndex(s, rows.filter((r) => !r.k.startsWith(p)));
}

/** Tests: forget the in-memory mirror (a "relaunch" re-reads storage). */
export function __forgetPageCacheMemory(): void {
  memory.clear();
}

// ── A Map-shaped facade for the existing module caches ──────────────────────

/**
 * Drop-in for the session-lived `new Map()` board caches: same get / set /
 * has, now persisted per user. Keys are the callers' own (they already carry
 * mode · day · user); `dayOf` extracts the day so past days expire.
 */
export function persistentMap<V>(namespace: string, dayOf?: (key: string) => string | undefined) {
  const k = (key: string) => `${namespace}:${key}`;
  return {
    get(key: string): V | undefined {
      return readPageCache<V>(k(key), { day: dayOf?.(key) });
    },
    has(key: string): boolean {
      return this.get(key) !== undefined;
    },
    set(key: string, value: V) {
      writePageCache(k(key), value, { day: dayOf?.(key) });
      return this;
    },
    delete(key: string): void {
      removePageCache(k(key));
    },
    /** Forget every key of this map (this user). */
    clear(): void {
      clearPageCacheNamespace(namespace);
    },
  };
}

/** The YYYY-MM-DD inside a cache key (`DUEL:2026-10-03:uid`), if any. */
export function dayInKey(key: string): string | undefined {
  return /\d{4}-\d{2}-\d{2}/.exec(key)?.[0];
}
