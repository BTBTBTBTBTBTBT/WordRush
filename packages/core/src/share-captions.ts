// Share copy (docs/FINISH_SPEC.md S4): short, fun, makes sense, no em dashes,
// American spelling, never mean. ONE bank shared by web, iOS and Android; the
// line is picked deterministically so all three platforms agree:
//
//   key   = `${date}|${game}`                (date = the result's YYYY-MM-DD, game = its display name)
//   hash  = FNV-1a 32-bit over the key's UTF-16 code units, i.e. for each char c:
//             h ^= c; h = (h * 16777619) >>> 0      (start h = 2166136261)
//   index = hash % bank.length
//
// Then the {placeholders} are filled; a result share with a streak of 3+
// appends " 🔥 Day {d}". Parity: vs share-captions-fixtures.json
// (scripts/gen-parity-fixtures.ts).

export type ShareCaptionKind =
  | 'win' | 'multiWin' | 'flawless' | 'lose' | 'sweep'
  | 'gauntletWin' | 'gauntletLose' | 'vsWin' | 'vsLose' | 'vsDraw'
  | 'invite' | 'vsInvite';

/** The caption bank, by kind. Order matters (the hash indexes it). */
export const SHARE_CAPTIONS: Readonly<Record<ShareCaptionKind, readonly string[]>> = {
  win: [
    '{game} solved in {n} guesses. Your move 😎',
    'Cracked {game} in {t} ⚡ Beat that!',
    '{game} in {n}. The letters never stood a chance.',
  ],
  multiWin: ['All {b} {game} boards cleared in {n} guesses 🧠✨'],
  flawless: ['Flawless {game}! 💎 Not one wasted guess.'],
  lose: [
    '{game} got me today 😅 Can you crack it?',
    'So close on {game}! Think you can do better?',
  ],
  sweep: ['Swept every Wordocious daily today 🧹✨'],
  gauntletWin: ['Cleared all 5 Gauntlet stages 🏆'],
  gauntletLose: ['Reached stage {k} of the Gauntlet. Can you go further?'],
  vsWin: ['Beat {opp} at {game} ⚔️'],
  vsLose: ['{opp} edged me at {game}. Rematch incoming 🔁'],
  vsDraw: ['{opp} and I tied at {game}. Rematch? ⚔️'],
  invite: ['Come play Wordocious with me! 🎉 {url}'],
  vsInvite: ['Race me at {game}! ⚡ {url}'],
};

/** Toasts after a share falls back to the clipboard / a download. */
export const SHARE_TOASTS = {
  copied: 'Image copied! Paste it anywhere 📋',
  saved: 'Saved! Share it anywhere 🖼️',
} as const;

/** FNV-1a 32-bit over UTF-16 code units (see the header for the exact recipe). */
export function captionHash(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export interface ShareCaptionVars {
  /** The result's day, YYYY-MM-DD (part of the pick key). */
  date: string;
  /** The game's display name (part of the pick key), e.g. "QuadWord". */
  game: string;
  /** Guesses. */
  n?: number | string;
  /** Time, already formatted ("0:48"). */
  t?: string;
  /** Boards. */
  b?: number | string;
  /** Streak day (3+ appends " 🔥 Day {d}" to result shares). */
  d?: number;
  /** Gauntlet stage reached. */
  k?: number | string;
  /** Opponent name. */
  opp?: string;
  /** Invite link. */
  url?: string;
}

const RESULT_KINDS: ReadonlySet<ShareCaptionKind> = new Set(['win', 'multiWin', 'flawless', 'lose', 'sweep', 'gauntletWin', 'gauntletLose', 'vsWin', 'vsLose', 'vsDraw']);

/** The bank index for a kind + key (exposed for the parity fixtures). */
export function shareCaptionIndex(kind: ShareCaptionKind, date: string, game: string): number {
  return captionHash(`${date}|${game}`) % SHARE_CAPTIONS[kind].length;
}

/** The caption for a share: the deterministic pick, filled in, plus the streak suffix. */
export function shareCaption(kind: ShareCaptionKind, v: ShareCaptionVars): string {
  const line = SHARE_CAPTIONS[kind][shareCaptionIndex(kind, v.date, v.game)];
  const filled = line.replace(/\{(\w+)\}/g, (_, k: string) => {
    const val = (v as unknown as Record<string, unknown>)[k];
    return val == null ? '' : String(val);
  });
  return RESULT_KINDS.has(kind) && v.d != null && v.d >= 3 ? `${filled} 🔥 Day ${v.d}` : filled;
}
