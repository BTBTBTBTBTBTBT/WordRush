/**
 * Display names for daily_results/matches game_mode keys — ONE copy for every
 * admin surface. Raw DB keys (DUEL_6) were leaking into the Puzzles/Metrics
 * tables while the Games page kept its own private mapping; a shared module
 * means a new mode gets named once.
 */
export const MODE_LABELS: Record<string, string> = {
  DUEL: 'Classic',
  DUEL_6: 'Six',
  DUEL_7: 'Seven',
  QUORDLE: 'QuadWord',
  OCTORDLE: 'OctoWord',
  SEQUENCE: 'Succession',
  RESCUE: 'Deliverance',
  GAUNTLET: 'Gauntlet',
  PROPERNOUNDLE: 'ProperNoundle',
  SUDOKU: 'Sudoku',
  SCRAMBLE: 'Muddle',
  HUB: 'Hubbub',
  CROSSWORD: 'Crosswordocious',
  GROUPS: 'Kindred',
  LADDER: 'Letter Ladder',
  CRYPTOGRAM: 'Codebreaker',
  WORDSEARCH: 'Spyglass',
  REGIONS: 'Starsweep',
  VS: 'VS Battle',
};

export const modeLabel = (m: string): string => MODE_LABELS[m] ?? m;
