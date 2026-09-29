import { useEffect, useReducer, useRef } from 'react';
import { initDictionary, initDictionaryForLength } from '@wordle-duel/core';

// Word lists load on demand, one length at a time (founder, 2026-09-29): they
// used to be imported by AuthGate, which put ~140 KB gz of lists into every
// route's first load. Each length is its own content-hashed chunk (immutable
// cache under /_next/static). Anything that validates a guess or replays a
// board must wait for `loadDictionary` / `useDictionary` before it runs — the
// game pages render their loading state until the lists are in, so no guess
// is ever judged against an empty list.

export type DictLength = 5 | 6 | 7;
export const ALL_LENGTHS: readonly DictLength[] = [5, 6, 7];

type Lists = [string[], string[], string[]];
const def = (m: { default: unknown }) => m.default as string[];
// Each entry: [allowed, solutions, legacy solutions]. The legacy list feeds
// the pre-cutover answer pool (date-gated in core) and must always load with
// its length — a 2-arg init once wiped it and crashed every pre-cutover daily.
const LOADERS: Record<DictLength, () => Promise<Lists>> = {
  5: () => Promise.all([import('@/data/allowed.json'), import('@/data/solutions.json'), import('@/data/solutions-legacy.json')]).then((m) => m.map(def) as Lists),
  6: () => Promise.all([import('@/data/allowed-6.json'), import('@/data/solutions-6.json'), import('@/data/solutions-6-legacy.json')]).then((m) => m.map(def) as Lists),
  7: () => Promise.all([import('@/data/allowed-7.json'), import('@/data/solutions-7.json'), import('@/data/solutions-7-legacy.json')]).then((m) => m.map(def) as Lists),
};

const loaded = new Set<DictLength>();
const pending = new Map<DictLength, Promise<void>>();

function loadLength(len: DictLength): Promise<void> {
  if (loaded.has(len)) return Promise.resolve();
  let p = pending.get(len);
  if (!p) {
    p = LOADERS[len]().then(([allowed, solutions, legacy]) => {
      if (len === 5) initDictionary(allowed, solutions, legacy);
      else initDictionaryForLength(len, allowed, solutions, legacy);
      loaded.add(len);
    });
    // A failed chunk load may be retried by the next caller.
    p.catch(() => pending.delete(len));
    pending.set(len, p);
  }
  return p;
}

/** Loads (once) the word lists for the given lengths; resolves when they are usable. */
export function loadDictionary(lengths: readonly DictLength[] = ALL_LENGTHS): Promise<void> {
  return Promise.all(lengths.map(loadLength)).then(() => undefined);
}

export function isDictionaryLoaded(lengths: readonly DictLength[] = ALL_LENGTHS): boolean {
  return lengths.every((l) => loaded.has(l));
}

/** The lists a classic-engine mode needs (by core GameMode / dbKey string). */
export function dictLengthsForMode(mode: string): DictLength[] {
  if (mode === 'DUEL_6') return [6];
  if (mode === 'DUEL_7') return [7];
  return [5];
}

/**
 * True once the lists for `lengths` are loaded. Callers render their loading
 * state until then and mount the game only after, so every guess validation
 * and board replay runs against the real lists. Retries a failed load once.
 */
export function useDictionary(lengths: readonly DictLength[] = ALL_LENGTHS): boolean {
  const key = lengths.join(',');
  // The live check, not a state flag: a flag still holds the PREVIOUS lengths'
  // answer for the render in which `lengths` changes (its effect catches up a render
  // later), so a mode switch on a mounted caller read "ready" for lists not yet
  // loaded, or "loading" for lists already in (founder, 2026-09-29). `bump` only
  // re-renders the caller once a load lands.
  const ready = isDictionaryLoaded(lengths);
  const readyRef = useRef(ready);
  readyRef.current = ready;
  const [, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (isDictionaryLoaded(lengths)) { if (!readyRef.current) bump(); return; }
    let live = true;
    loadDictionary(lengths)
      .catch(() => loadDictionary(lengths))
      .then(() => { if (live) bump(); })
      .catch(() => {});
    return () => { live = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return ready;
}
