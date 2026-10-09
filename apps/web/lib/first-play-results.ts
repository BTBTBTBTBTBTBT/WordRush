// "Has this player already played this game?" for the first-play welcome card (FRIDAY-QUEUE item 12:
// an existing player never gets a tutorial for a game they already know). Local signals only, the same
// ones onboarding.ts uses: the per-mode stats (`wordle-duel-stats-<DB>` with games played), a saved
// session (`wordocious-session-<DB>…`) and the More Games saves (`wordocious-<id>-daily|practice`).
// A player on a brand-new device has none of these, so they see the card once (and it syncs after).
// iOS: FirstPlayResults.swift · Android: FirstPlayResults.kt (each reads its own stats store).

/** Guide slug -> the game's db key (stats / session keys) and, for More Games, its mode id (save keys). */
const GAME_KEYS: Record<string, { db: string; id?: string }> = {
  classic: { db: 'DUEL' }, six: { db: 'DUEL_6' }, seven: { db: 'DUEL_7' }, quadword: { db: 'QUORDLE' }, octoword: { db: 'OCTORDLE' },
  succession: { db: 'SEQUENCE' }, deliverance: { db: 'RESCUE' }, gauntlet: { db: 'GAUNTLET' }, propernoundle: { db: 'PROPERNOUNDLE' },
  sudocious: { db: 'SUDOKU', id: 'sudoku' }, starsweep: { db: 'REGIONS', id: 'regions' }, 'letter-ladder': { db: 'LADDER', id: 'ladder' },
  spyglass: { db: 'WORDSEARCH', id: 'wordsearch' }, hubbub: { db: 'HUB', id: 'hub' }, codebreaker: { db: 'CRYPTOGRAM', id: 'cryptogram' },
  kindred: { db: 'GROUPS', id: 'groups' }, crosswordocious: { db: 'CROSSWORD', id: 'crossword' }, muddle: { db: 'SCRAMBLE', id: 'scramble' },
};

/** Pure: do these localStorage keys (with a reader for the stats value) show results in the game? */
export function keysShowResults(slug: string, keys: readonly string[], read: (key: string) => string | null): boolean {
  const g = GAME_KEYS[slug];
  if (!g) return false;
  for (const k of keys) {
    if (k === `wordle-duel-stats-${g.db}`) {
      try {
        const played = (JSON.parse(read(k) ?? 'null') as { gamesPlayed?: number } | null)?.gamesPlayed ?? 0;
        if (played > 0) return true;
      } catch { /* unreadable stats: not a result */ }
    }
    if (k.startsWith(`wordocious-session-${g.db}`)) return true;
    if (g.id && (k === `wordocious-${g.id}-daily` || k === `wordocious-${g.id}-practice`)) return true;
  }
  return false;
}

/** Whether this browser holds results for the game (false on the server / with storage blocked). */
export function hasLocalResults(slug: string): boolean {
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k) keys.push(k);
    }
    return keysShowResults(slug, keys, (k) => window.localStorage.getItem(k));
  } catch { return false; }
}
