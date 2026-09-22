/**
 * dbKey → route for every daily-recordable mode, extracted from the ad-hoc
 * lists that used to live in next-daily-cta.tsx and MODE_CHROME (More Games
 * Stage 4). The Next Daily handoff walks SWEEP_MODES through this map, so the
 * order is the catalog's, never a second hand-typed list. Routes for the
 * More Games titles are here already so a game cannot land without one; the
 * pages themselves arrive with their games.
 */
export const MODE_ROUTES: Record<string, string> = {
  DUEL: '/practice',
  QUORDLE: '/quadword',
  OCTORDLE: '/octoword',
  SEQUENCE: '/sequence',
  RESCUE: '/rescue',
  DUEL_6: '/six',
  DUEL_7: '/seven',
  GAUNTLET: '/gauntlet',
  PROPERNOUNDLE: '/propernoundle',
  SUDOKU: '/sudoku',
  SCRAMBLE: '/muddle',
  HUB: '/hubbub',
  CROSSWORD: '/crosswordocious',
  GROUPS: '/kindred',
  LADDER: '/letter-ladder',
  CRYPTOGRAM: '/codebreaker',
  WORDSEARCH: '/spyglass',
  REGIONS: '/starsweep',
};

/** The daily route for a mode ("?daily=true"), or null for an unknown key. */
export function dailyHref(dbKey: string): string | null {
  const base = MODE_ROUTES[dbKey];
  return base ? `${base}?daily=true` : null;
}
