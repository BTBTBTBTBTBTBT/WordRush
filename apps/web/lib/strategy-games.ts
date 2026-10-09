// Strategy + How to Play as the "guide page family" (3-platform parity spec):
// which game each Strategy article belongs to, the index's groups and order,
// the deterministic tip of the day, and the per-section takeaway. iOS and
// Android carry the same slug map, groups, formula and split rule, so every
// platform picks the same article on the same local day. Pure, no React.

import { MODES, MODE_BY_ID, type ModeMeta } from './modes.generated';
import { GAME_HOSTS, CAST, type MascotId } from './mascots';
import { gameTitleArt, type GameTitleArtName } from './art';
import { dailyHref } from './mode-routes';

/** Slug → catalog (modes.json) id; `null` = a general article about every game. */
export const STRATEGY_GAME_BY_SLUG: Readonly<Record<string, string | null>> = {
  'best-starting-words': 'practice',
  'solve-faster': 'practice',
  'multi-board-mastery': 'quordle',
  'gauntlet-survival': 'gauntlet',
  'propernoundle-playbook': 'propernoundle',
  'sudocious-playbook': 'sudoku',
  'starsweep-playbook': 'regions',
  'letter-ladder-playbook': 'ladder',
  'spyglass-playbook': 'wordsearch',
  'hubbub-playbook': 'hub',
  'codebreaker-playbook': 'cryptogram',
  'kindred-playbook': 'groups',
  'crosswordocious-playbook': 'crossword',
  'muddle-playbook': 'scramble',
  'vs-battle-tactics': 'vs',
  'modes-explained': null,
  'daily-sweep-guide': null,
  'letter-frequency-atlas': null,
  'repeated-letter-traps': null,
  'beginner-to-sweeper': null,
};

/**
 * The catalog id an article is about, or null (general). An unlisted slug has
 * "-playbook" stripped and is matched against the catalog titles (lowercased,
 * spaces → '-'); no match = general.
 */
export function strategyGameId(slug: string): string | null {
  if (Object.prototype.hasOwnProperty.call(STRATEGY_GAME_BY_SLUG, slug)) return STRATEGY_GAME_BY_SLUG[slug];
  const stem = slug.replace(/-playbook$/, '');
  const hit = MODES.find((m) => m.title.toLowerCase().replace(/\s+/g, '-') === stem);
  return hit ? hit.id : null;
}

export type StrategyGroup = 'dailies' | 'puzzles' | 'every';

/** Section order on the index (and the prev / next order). */
export const STRATEGY_GROUPS: readonly StrategyGroup[] = ['dailies', 'puzzles', 'every'];

export const STRATEGY_GROUP_LABEL: Record<StrategyGroup, string> = {
  dailies: 'WORDOCIOUS DAILIES',
  puzzles: 'PUZZLES',
  every: 'EVERY GAME',
};

/** General articles (and anything without a game) wear the brand purple. */
export const STRATEGY_GENERAL_ACCENT = '#7c3aed';

/** General articles' hosts, by their index among the general articles (API order). */
export const STRATEGY_GENERAL_CAST: readonly MascotId[] = CAST;

export interface StrategyArticleLike {
  slug: string;
}

export interface StrategyLook {
  slug: string;
  /** Catalog id, or null for a general article. */
  gameId: string | null;
  mode: ModeMeta | null;
  group: StrategyGroup;
  accent: string;
  /** The character in its "ready" pose on the hero / tile. */
  host: MascotId;
  /** The game's title art, or null (general, VS). */
  titleArt: GameTitleArtName | null;
  /** Today's daily on web, or null (general, VS: no daily). */
  playHref: string | null;
  /** "PLAY CLASSIC", or null when there is no play button. */
  playLabel: string | null;
}

/** The look of every article, in the given (API) order. */
export function strategyLooks<T extends StrategyArticleLike>(articles: readonly T[]): StrategyLook[] {
  let generalIndex = 0;
  return articles.map((a) => {
    const gameId = strategyGameId(a.slug);
    const mode = gameId ? MODE_BY_ID[gameId] ?? null : null;
    if (!mode) {
      const host = STRATEGY_GENERAL_CAST[generalIndex % STRATEGY_GENERAL_CAST.length];
      generalIndex += 1;
      return {
        slug: a.slug, gameId: null, mode: null, group: 'every', accent: STRATEGY_GENERAL_ACCENT, host,
        titleArt: null, playHref: null, playLabel: null,
      };
    }
    const href = mode.dbKey ? dailyHref(mode.dbKey) : null;
    return {
      slug: a.slug,
      gameId: mode.id,
      mode,
      group: mode.group === 'core' ? 'dailies' : 'puzzles',
      accent: mode.accentHex,
      host: mode.id === 'vs' ? 'w' : (mode.dbKey && GAME_HOSTS[mode.dbKey]) || 'w',
      titleArt: gameTitleArt(mode.id),
      playHref: href,
      playLabel: href ? `PLAY ${mode.title.toUpperCase()}` : null,
    };
  });
}

export interface StrategySection<T> {
  group: StrategyGroup;
  label: string;
  items: { article: T; look: StrategyLook }[];
}

/** The index's sections (dailies, puzzles, every game; API order within each), empty ones dropped. */
export function strategySections<T extends StrategyArticleLike>(articles: readonly T[]): StrategySection<T>[] {
  const looks = strategyLooks(articles);
  return STRATEGY_GROUPS.map((group) => ({
    group,
    label: STRATEGY_GROUP_LABEL[group],
    items: articles.map((article, i) => ({ article, look: looks[i] })).filter((x) => x.look.group === group),
  })).filter((s) => s.items.length > 0);
}

/** The flattened grouped order: the tip-of-the-day pool and the prev / next order. */
export function strategyOrder<T extends StrategyArticleLike>(articles: readonly T[]): { article: T; look: StrategyLook }[] {
  return strategySections(articles).flatMap((s) => s.items);
}

/** Whole days from 1970-01-01 to `date`'s LOCAL calendar date. */
export function localDayNumber(date: Date): number {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
}

/** The tip of the day's index into the flattened order (0 for an empty list). */
export function tipOfDayIndex(date: Date, count: number): number {
  if (count <= 0) return 0;
  const day = localDayNumber(date);
  return ((day % count) + count) % count;
}

/**
 * A section's takeaway: the first sentence of its first paragraph, split at
 * the first ". ", "! " or "? " whose punctuation sits at index ≥ 20 (the
 * punctuation is kept). No split point → no takeaway (the paragraph renders
 * whole). `rest` is the remainder, trimmed ('' when nothing is left).
 */
export function splitTakeaway(paragraph: string): { takeaway: string | null; rest: string } {
  const re = /[.!?] /g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(paragraph)) !== null) {
    if (m.index >= 20) {
      return { takeaway: paragraph.slice(0, m.index + 1), rest: paragraph.slice(m.index + 1).trim() };
    }
  }
  return { takeaway: null, rest: paragraph };
}

/** How to Play's rotating section accents (the brand set). */
export const HOW_TO_PLAY_ACCENTS = ['#7c3aed', '#ec4899', '#f59e0b', '#3b82f6', '#10b981'] as const;

export function howToPlayAccent(i: number): string {
  const n = HOW_TO_PLAY_ACCENTS.length;
  return HOW_TO_PLAY_ACCENTS[((Math.floor(i) % n) + n) % n];
}

/**
 * How to Play's mode rows: the catalog id whose 3D icon draws beside a mode
 * name ("Classic — 1 Word, 6 Guesses" → practice; "VS Battle" → vs; "More
 * Games" → more), matched case-insensitively on the text before " — ".
 */
export function howToPlayModeId(name: string): string | null {
  const head = name.split(' — ')[0].trim().toLowerCase();
  if (head === 'vs battle') return 'vs';
  if (head === 'puzzles') return 'more';
  return MODES.find((m) => m.title.toLowerCase() === head)?.id ?? null;
}
