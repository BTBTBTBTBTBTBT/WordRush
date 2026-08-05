// Pure copy-builder for the /s/[...key] share landing page (app/s/[...key]/
// page.tsx). Turns the share URL's path + query params into the unfurl
// title/description and the on-page headline. Kept free of Next.js imports so
// it can be unit-tested in vitest's node environment (share-page-copy.test.ts).
//
// Spoiler rule: titles and descriptions must never contain puzzle letters —
// only mode names, guess counts, times, and scores (all colors-only safe).

export const MODE_DISPLAY: Record<string, string> = {
  Six: 'Classic Six',
  Seven: 'Classic Seven',
  ProperNoundle: 'ProperNoundle',
  DailySweep: 'Daily Sweep',
  Profile: 'Player Profile',
};

// Map a share mode back to its play route so the CTA sends visitors to it.
export const MODE_ROUTE: Record<string, string> = {
  Classic: '/practice',
  QuadWord: '/quordle',
  OctoWord: '/octordle',
  Succession: '/sequence',
  Deliverance: '/rescue',
  Gauntlet: '/gauntlet',
  ProperNoundle: '/propernoundle',
  Six: '/six',
  Seven: '/seven',
  DailySweep: '/daily',
  Profile: '/',
};

export type SP = Record<string, string | string[] | undefined>;

function str(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

// The hook every description ends with (founder-approved unfurl copy).
const PLAY_HOOK = 'Play today’s puzzles free at wordocious.com.';

/**
 * Every share URL's storage key ends in `<ShareMode>[-full]-<yyyy-mm-dd>`
 * (see lib/share-utils.ts and the iOS/Android ShareService mirrors). Parse
 * mode + date back out of the path so the unfurl stays meaningful even when
 * a platform strips or truncates the query string.
 */
export function parseShareKey(key: string[]): { mode?: string; date?: string } {
  const last = key[key.length - 1];
  if (!last) return {};
  const m = last.match(/^(.+?)(?:-full)?-(\d{4}-\d{2}-\d{2})$/);
  if (!m) return {};
  return { mode: m[1], date: m[2] };
}

function fmtDate(iso: string): string | undefined {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return undefined;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const mon = months[Number(m[2]) - 1];
  if (!mon) return undefined;
  return `${mon} ${Number(m[3])}, ${m[1]}`;
}

export interface ShareCopy {
  mode: string;
  modeDisp: string;
  won: boolean;
  stats: string;
  title: string;
  description: string;
}

export function buildCopy(sp: SP, key: string[] = []): ShareCopy {
  const fromPath = parseShareKey(key);
  const mode = str(sp.m) ?? fromPath.mode ?? 'Wordocious';
  const modeDisp = MODE_DISPLAY[mode] ?? mode;
  const dateDisp = fromPath.date ? fmtDate(fromPath.date) : undefined;

  // All-dailies share card has its own copy shape (X/9 won · time · pts).
  if (mode === 'DailySweep' && str(sp.won) !== undefined) {
    const flawless = str(sp.sweep) === 'flawless';
    const w = Number(str(sp.won)) || 0;
    const tot = Number(str(sp.tot)) || 9;
    const t = Number(str(sp.t)) || 0;
    const pts = Number(str(sp.pts)) || 0;
    const label = flawless ? 'Flawless Victory' : 'Daily Sweep';
    const stats = `${w}/${tot} won · ${fmtTime(t)} · ${pts.toLocaleString()} pts`;
    const title = `Wordocious ${label} — ${stats}`;
    const description = flawless
      ? `I won all ${tot} daily puzzles on Wordocious (${stats}). Can you go flawless? ${PLAY_HOOK}`
      : `I completed all ${tot} daily puzzles on Wordocious (${stats}). Think you can sweep them? ${PLAY_HOOK}`;
    return { mode, modeDisp: label, won: w >= tot, stats, title, description };
  }

  // Player-profile card carries no result stats in the query (only the
  // cache-buster v=p<wins>-<streak>-<achievements>, parsed defensively).
  if (mode === 'Profile') {
    const v = str(sp.v)?.match(/^p(\d+)-(\d+)-(\d+)$/);
    const stats = v ? `${Number(v[1]).toLocaleString()} wins · ${v[2]}-day streak` : '';
    const title = stats
      ? `Wordocious Player Profile — ${stats}`
      : 'Wordocious Player Profile';
    const description = `Check out my Wordocious stats. ${PLAY_HOOK}`;
    return { mode, modeDisp, won: false, stats, title, description };
  }

  // Query string stripped (some platforms truncate or drop it): fall back to
  // the mode + date recovered from the path — never invent "X/0 · 0:00" stats.
  if (str(sp.won) === undefined) {
    if (mode === 'Wordocious') {
      // Nothing recoverable at all: plain brand card.
      return {
        mode, modeDisp, won: false, stats: '',
        title: 'Wordocious — Daily Word Puzzles',
        description: `Shared from Wordocious. ${PLAY_HOOK}`,
      };
    }
    const stats = dateDisp ?? '';
    const title = stats ? `Wordocious — ${modeDisp} · ${stats}` : `Wordocious — ${modeDisp}`;
    const description = `A ${modeDisp} result on Wordocious. Can you beat it? ${PLAY_HOOK}`;
    return { mode, modeDisp, won: false, stats, title, description };
  }

  const won = str(sp.won) === '1';
  const g = Number(str(sp.g)) || 0;
  const mg = Number(str(sp.mg)) || 0;
  const t = Number(str(sp.t)) || 0;
  const guessDisp = won ? `${g}/${mg}` : `X/${mg}`;
  const statsBits: string[] = [];
  if (str(sp.bs) && str(sp.tb)) statsBits.push(`${str(sp.bs)}/${str(sp.tb)} boards`);
  if (str(sp.sc) && str(sp.ts)) statsBits.push(`${str(sp.sc)}/${str(sp.ts)} stages`);
  statsBits.push(guessDisp, fmtTime(t));
  const stats = statsBits.join(' · ');

  const title = `Wordocious ${modeDisp} — ${won ? 'Solved' : 'Played'} ${stats}`;
  const description = won
    ? `I solved ${modeDisp} on Wordocious (${stats}). Can you beat it? ${PLAY_HOOK}`
    : `I played ${modeDisp} on Wordocious. Think you can solve it? ${PLAY_HOOK}`;
  return { mode, modeDisp, won, stats, title, description };
}
