// BI19: the SWR cache (Stats, Pro insights, signature cards, weekly finishes,
// invite panel, flags…) persisted across reloads through lib/page-cache.ts.
//
// SWR keeps its state in a Map-shaped cache; this one writes each key's
// `data` (never errors / in-flight flags) to the page cache on a short
// debounce and on pagehide / tab hidden, and seeds itself back on launch so
// every useSWR page paints its last data on the first frame and revalidates
// in the background. SWR already keeps the old data on a failed revalidation
// and only re-renders when the data actually changed (stable-hash compare).
// Node-safe; no SWR import.

import { readPageCache, writePageCache } from './page-cache';

const KEYS = 'swr:__keys';
const entryKey = (k: string) => `swr:${k}`;
/** Internal SWR keys ($inf$, $sub$, $ctx$…) are never persisted. */
const persistable = (k: string) => !!k && !k.startsWith('$');

type SWRState = { data?: unknown } & Record<string, unknown>;

export class PersistentSWRCache extends Map<string, SWRState> {
  private dirty = new Set<string>();
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly debounceMs = 1500) {
    super();
  }

  override set(key: string, value: SWRState): this {
    super.set(key, value);
    if (persistable(key) && value && value.data !== undefined) {
      this.dirty.add(key);
      this.schedule();
    }
    return this;
  }

  private schedule(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => { this.timer = null; this.flush(); }, this.debounceMs);
  }

  /** Writes every changed key now (pagehide / hidden call this). */
  flush(): void {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    if (this.dirty.size === 0) return;
    const keys = new Set(readPageCache<string[]>(KEYS) ?? []);
    for (const k of this.dirty) {
      const data = super.get(k)?.data;
      if (data === undefined) continue;
      writePageCache(entryKey(k), data);
      keys.add(k);
    }
    this.dirty.clear();
    writePageCache(KEYS, Array.from(keys).sort());
  }

  /**
   * Seeds the persisted data for the current cache user (keys SWR already
   * holds win). Returns how many keys were restored.
   */
  hydrate(): number {
    let n = 0;
    for (const k of readPageCache<string[]>(KEYS) ?? []) {
      if (super.has(k)) continue;
      const data = readPageCache<unknown>(entryKey(k));
      if (data === undefined) continue;
      super.set(k, { data });   // super: seeding is not a change to persist
      n++;
    }
    return n;
  }
}

let shared: PersistentSWRCache | null = null;

/** The app's one SWR cache (SWRConfig `provider`). */
export function getPersistentSWRCache(): PersistentSWRCache {
  if (!shared) shared = new PersistentSWRCache();
  return shared;
}
