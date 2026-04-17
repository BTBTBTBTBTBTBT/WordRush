/**
 * One-time localStorage rename from the legacy `spellstrike-*` prefix to
 * the current `wordocious-*` prefix. Ran during the SpellStrike →
 * Wordocious rebrand.
 *
 * Why a migration and not a wipe: returning players have mid-game daily
 * sessions, propernoundle saves, play-limit counters, and completed-board
 * snapshots all keyed under the legacy prefix. Silently dropping them
 * would reset streaks, re-serve daily puzzles the user already finished,
 * and lose partial progress.
 *
 * Strategy:
 *  1. Gate on a flag so this only runs once per browser.
 *  2. Walk every key starting with `spellstrike-`, copy its value to the
 *     same suffix under `wordocious-`, and remove the old key.
 *  3. If both old and new already exist (defensive — shouldn't happen in
 *     the wild), keep the new one untouched and discard the old.
 *
 * This runs inside the `AuthProvider`'s mount effect so it happens on
 * every page load before any game component reads its first key.
 */

const MIGRATION_FLAG = 'wordocious-storage-migrated-v1';
const LEGACY_PREFIX = 'spellstrike-';
const NEW_PREFIX = 'wordocious-';

export function migrateLegacyStorageKeys(): void {
  if (typeof window === 'undefined') return;
  try {
    if (localStorage.getItem(MIGRATION_FLAG) === '1') return;

    // Collect first, mutate after — mutating mid-iteration shifts the
    // live-indexed `localStorage.key(i)` and can skip entries.
    const legacyKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(LEGACY_PREFIX)) legacyKeys.push(key);
    }

    for (const oldKey of legacyKeys) {
      const newKey = NEW_PREFIX + oldKey.slice(LEGACY_PREFIX.length);
      const value = localStorage.getItem(oldKey);
      // Only copy when destination is empty. Prevents a stale legacy save
      // from stomping on a fresh wordocious save if the user somehow
      // already has one (e.g. used two browsers, synced via a password
      // manager, etc.).
      if (value !== null && localStorage.getItem(newKey) === null) {
        localStorage.setItem(newKey, value);
      }
      localStorage.removeItem(oldKey);
    }

    localStorage.setItem(MIGRATION_FLAG, '1');
  } catch {
    // Private mode / quota exceeded / disabled storage — bail silently.
    // User keeps the legacy keys; next load retries. Never wipe.
  }
}
