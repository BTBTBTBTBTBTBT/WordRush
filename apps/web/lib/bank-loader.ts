import { useEffect, useState } from 'react';
import { getDailySeedDate } from '@wordle-duel/core';
import manifest from './banks-manifest.json';

// More Games banks are fetched one puzzle at a time (founder, 2026-09-29) —
// they used to be bundled whole into each game's JS (Hubbub alone ~279 KB gz).
// scripts/split-banks.js writes public/banks/<game>/<hash>/<entry>.json and
// the manifest below (hash, epoch, section sizes). To pick an entry we run the
// core's own selector (hubPuzzleForDay, crosswordPuzzleForSeed, …) on a stub
// bank of the real shape whose entries are file references, so the daily /
// holiday / Unlimited rules are exactly the core's; then we fetch that one file.

export type BankGame = 'hub' | 'crossword' | 'wordsearch' | 'scramble' | 'groups' | 'cryptogram' | 'ladder';
interface GameManifest { h: string; version: number; epoch: string; daily: number; extra: number; holiday?: Record<string, number> }
const MANIFEST = manifest as Record<BankGame, GameManifest>;

interface Ref { __bank: string }
const refs = (n: number, prefix: string): Ref[] => Array.from({ length: n }, (_, i) => ({ __bank: `${prefix}${i}` }));
const stubs = new Map<BankGame, unknown>();

/** A bank of the real shape whose entries are references to their files. */
export function stubBank<B>(game: BankGame): B {
  let s = stubs.get(game);
  if (!s) {
    const m = MANIFEST[game];
    s = {
      version: m.version, epoch: m.epoch, daily: refs(m.daily, 'd'), extra: refs(m.extra, 'x'),
      ...(m.holiday ? { holiday: Object.fromEntries(Object.entries(m.holiday).map(([k, n]) => [k, refs(n, `h-${k}-`)])) } : {}),
    };
    stubs.set(game, s);
  }
  return s as B;
}

/** The entry file a selector picks (null when it picks nothing). Exposed for the parity test. */
export function bankEntryPath<B>(game: BankGame, pick: (bank: B) => unknown): string | null {
  const ref = pick(stubBank<B>(game)) as Ref | null | undefined;
  return ref && typeof ref.__bank === 'string' ? `${game}/${MANIFEST[game].h}/${ref.__bank}.json` : null;
}

const cache = new Map<string, Promise<unknown>>();
const resolved = new Map<string, unknown>();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchEntry(url: string): Promise<unknown> {
  for (let attempt = 0; ; attempt++) {
    try {
      const r = await fetch(url);
      if (r.ok) return await r.json();
      // 404 = this tab's JS predates a bank edit that shipped (the hash moved):
      // reload once so the page picks up the new manifest.
      if (r.status === 404 && typeof window !== 'undefined') {
        const k = `wordocious-bank-reload:${url}`;
        try { if (!sessionStorage.getItem(k)) { sessionStorage.setItem(k, '1'); window.location.reload(); } } catch {}
      }
      throw new Error(`bank ${url}: HTTP ${r.status}`);
    } catch (e) {
      if (attempt >= 2) throw e;
      await sleep(800 * (attempt + 1));
    }
  }
}

/**
 * The puzzle `pick` selects from `game`'s bank (e.g. `(b) => hubPuzzleForDay(b, today)`),
 * fetched on its own. Resolves null when the selector picks nothing; rejects after
 * three failed tries. Cached per entry for the life of the page.
 */
export function loadBankPuzzle<B, P>(game: BankGame, pick: (bank: B) => P | null | undefined): Promise<P | null> {
  const rel = bankEntryPath(game, pick);
  if (!rel) return Promise.resolve(null);
  const url = `/banks/${rel}`;
  let p = cache.get(url);
  if (!p) {
    p = fetchEntry(url);
    p.then((v) => resolved.set(url, v), () => cache.delete(url));
    cache.set(url, p);
  }
  return p as Promise<P>;
}

/** The already-fetched puzzle `pick` selects (undefined while it has not been fetched). */
export function peekBankPuzzle<B, P>(game: BankGame, pick: (bank: B) => P | null | undefined): P | null | undefined {
  const rel = bankEntryPath(game, pick);
  return rel ? (resolved.get(`/banks/${rel}`) as P | undefined) : null;
}

export interface BankSession<P> {
  /** The daily for `day` (holiday rules included when the game has them). */
  day: (day: string) => Promise<P | null>;
  /** The Unlimited puzzle for `seed`. */
  seed: (seed: string) => Promise<P | null>;
  /** The puzzle a saved session was built from: its daily seed's day, else its Unlimited seed. */
  forSession: (seed: string) => Promise<P | null>;
  peekSession: (seed: string) => P | null | undefined;
}

/** One game's bank access, built on the core's own day/seed selectors. */
export function bankSession<B, P>(game: BankGame, forDay: (b: B, day: string) => P | null, forSeed: (b: B, seed: string) => P | null): BankSession<P> {
  const pick = (seed: string) => { const day = getDailySeedDate(seed); return (b: B) => (day ? forDay(b, day) : forSeed(b, seed)); };
  return {
    day: (day) => loadBankPuzzle<B, P>(game, (b) => forDay(b, day)),
    seed: (seed) => loadBankPuzzle<B, P>(game, (b) => forSeed(b, seed)),
    forSession: (seed) => loadBankPuzzle<B, P>(game, pick(seed)),
    peekSession: (seed) => peekBankPuzzle<B, P>(game, pick(seed)),
  };
}

/**
 * The bank puzzle behind a live or restored session (state id + seed) — for what
 * the state does not carry (a cartoon, the holiday name). Null until fetched, or
 * if the bank no longer has that id.
 */
export function useSessionPuzzle<P extends { id: string }>(bank: BankSession<P>, id: string | undefined, seed: string | undefined): P | null {
  const [fetched, setFetched] = useState<P | null>(null);
  const peeked = id && seed ? bank.peekSession(seed) : null;
  useEffect(() => {
    if (!id || !seed || peeked !== undefined) return;
    let live = true;
    bank.forSession(seed).then((p) => { if (live) setFetched(p); }).catch(() => {});
    return () => { live = false; };
  }, [bank, id, seed, peeked]);
  const p = peeked ?? fetched;
  return p && p.id === id ? p : null;
}
