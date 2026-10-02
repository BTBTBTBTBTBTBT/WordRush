// The in-game "?" help card's short steps (docs/FINISH_SPEC.md AF): 3–4 short
// steps per game, each with a tiny example row of real B-kit glossy tiles,
// shortened from the guide copy in lib/guide-content.ts (the long rules,
// scoring and strategy stay one tap away under "Scoring & strategy"). Pure
// data, so the card and its test share one source.

import { getGuide } from './guide-content';

/** The tile looks an example may use (globals.css `.gtile[data-s=…]`). */
export type HelpTileLook = 'correct' | 'present' | 'absent' | 'typed' | 'empty' | 'given' | 'conflict';

export interface HelpTile {
  /** One glyph ('' for an empty tile). */
  ch: string;
  look: HelpTileLook;
  /** Turns over on open (colored looks only); otherwise it sits still. */
  flip: boolean;
}

export interface HelpRow {
  tiles: HelpTile[];
  /** A small tag after the row ("+5", "Board 2"). */
  tag?: string;
  /** A solved board's check badge after the row. */
  check?: boolean;
}

export type HelpExample =
  | { kind: 'tiles'; rows: HelpRow[]; /** A down arrow between rows (one leads to the next). */ arrow?: boolean }
  | { kind: 'chips'; chips: { label: string; tone: 'accent' | 'gold' | 'slate' | 'red' }[] };

export interface HelpStep {
  text: string;
  example: HelpExample;
}

export interface HelpSteps {
  slug: string;
  /** The game's name (the guide title). */
  title: string;
  steps: HelpStep[];
}

const LOOK: Record<string, HelpTileLook> = {
  C: 'correct', P: 'present', A: 'absent', T: 'typed', E: 'empty', G: 'given', X: 'conflict',
};
const FLIPS: ReadonlySet<HelpTileLook> = new Set(['correct', 'present', 'absent', 'conflict']);

/**
 * A row from a word and a pattern, one code per letter: C purple (right spot),
 * P gold (wrong spot), A gray (not in it), T typed, E empty, G given (plain),
 * X red. Colored tiles flip; a lowercase code keeps the tile still.
 * A space in the word is an empty tile (used for blanks).
 */
export function helpRow(word: string, pattern: string, extra: Omit<HelpRow, 'tiles'> = {}): HelpRow {
  const letters = Array.from(word);
  const codes = Array.from(pattern);
  if (letters.length !== codes.length) throw new Error(`helpRow: "${word}" and "${pattern}" differ in length`);
  const tiles = letters.map((ch, i) => {
    const code = codes[i];
    const look = LOOK[code.toUpperCase()];
    if (!look) throw new Error(`helpRow: unknown code "${code}"`);
    return { ch: ch === ' ' ? '' : ch, look, flip: code === code.toUpperCase() && FLIPS.has(look) };
  });
  return { tiles, ...extra };
}

const tiles = (...rows: HelpRow[]): HelpExample => ({ kind: 'tiles', rows });
const ladder = (...rows: HelpRow[]): HelpExample => ({ kind: 'tiles', rows, arrow: true });
const chips = (...list: [string, 'accent' | 'gold' | 'slate' | 'red'][]): HelpExample => ({
  kind: 'chips',
  chips: list.map(([label, tone]) => ({ label, tone })),
});

/** The colors step every word game shares (guess CRANE, answer CHAIR). */
const COLORS: HelpStep = {
  text: 'Purple is the right spot, gold is in the word but elsewhere, gray is not in it.',
  example: tiles(helpRow('CRANE', 'CPCAA')),
};

const STEPS: Record<string, HelpStep[]> = {
  classic: [
    { text: 'Guess the hidden 5-letter word in 6 tries. Type a real word and press Enter.', example: tiles(helpRow('CRANE', 'TTTTT')) },
    COLORS,
    { text: 'Use the clues for a smarter next guess until the whole row turns purple.', example: tiles(helpRow('CHAIR', 'CCCCC')) },
  ],
  six: [
    { text: 'Guess the hidden 6-letter word in 7 tries.', example: tiles(helpRow('PLANET', 'TTTTTT')) },
    { text: 'Purple is the right spot, gold is in the word but elsewhere, gray is not in it.', example: tiles(helpRow('PLANET', 'CPPAPA')) },
    { text: 'Stuck? Reveal a vowel or a consonant. Each adds a row and costs 75 points.', example: tiles(helpRow('    C ', 'eeeeCe')) },
    { text: 'Turn the whole row purple to win.', example: tiles(helpRow('PALACE', 'CCCCCC')) },
  ],
  seven: [
    { text: 'Guess the hidden 7-letter word in 8 tries.', example: tiles(helpRow('PAINTER', 'TTTTTTT')) },
    { text: 'Purple is the right spot, gold is in the word but elsewhere, gray is not in it.', example: tiles(helpRow('PAINTER', 'PCPPPAA')) },
    { text: 'Stuck? Reveal a vowel or a consonant. Each adds a row and costs 75 points.', example: tiles(helpRow('     I ', 'eeeeeCe')) },
    { text: 'Turn the whole row purple to win.', example: tiles(helpRow('CAPTAIN', 'CCCCCCC')) },
  ],
  quadword: [
    { text: 'Solve four hidden 5-letter words at once with 9 shared guesses.', example: tiles(helpRow('CRANE', 'TTTTT')) },
    { text: 'Every guess hits all four boards, and each board colors its own tiles.', example: tiles(helpRow('CRANE', 'CPAAA', { tag: 'Board 1' }), helpRow('CRANE', 'AACAP', { tag: 'Board 2' })) },
    { text: 'A solved board locks with a check. Clear all four before the guesses run out.', example: tiles(helpRow('CHAIR', 'CCCCC', { check: true })) },
  ],
  octoword: [
    { text: 'Solve eight hidden 5-letter words at once with 13 shared guesses.', example: tiles(helpRow('SLATE', 'TTTTT')) },
    { text: 'Every guess hits all eight boards, and each board colors its own tiles.', example: tiles(helpRow('SLATE', 'APACA', { tag: 'Board 1' }), helpRow('SLATE', 'CAAPA', { tag: 'Board 2' })) },
    { text: 'A solved board locks with a check and stops using guesses. Clear all eight.', example: tiles(helpRow('STORM', 'CCCCC', { check: true })) },
  ],
  succession: [
    { text: 'Solve four 5-letter words one at a time, in order, with 10 shared guesses.', example: tiles(helpRow('CRANE', 'TTTTT')) },
    COLORS,
    { text: 'Each new board starts with your earlier guesses already filled in.', example: ladder(helpRow('CRANE', 'cpcaa', { tag: 'Board 1' }), helpRow('CRANE', 'AACAP', { tag: 'Board 2' })) },
    { text: 'Solve all four in order to win.', example: tiles(helpRow('PLANT', 'CCCCC', { check: true })) },
  ],
  deliverance: [
    { text: 'Four boards open with three guesses already played and colored for you.', example: tiles(helpRow('STONE', 'AAAAC'), helpRow('MOUSE', 'AAPAC')) },
    { text: 'Read those clues, then finish all four with six guesses of your own.', example: tiles(helpRow('CRANE', 'TTTTT')) },
    { text: 'Each guess you type is tried on all four boards at once.', example: tiles(helpRow('CRANE', 'CPAAC', { tag: 'Board 1' }), helpRow('CRANE', 'APCAA', { tag: 'Board 2' })) },
    { text: 'Turn every board purple to win.', example: tiles(helpRow('CURVE', 'CCCCC', { check: true })) },
  ],
  gauntlet: [
    { text: 'Five stages that get harder, 21 words in all, in one run.', example: tiles(helpRow('12345', 'Cgggg')) },
    COLORS,
    { text: 'Solve every word in a stage to move on. Run out of guesses and the run ends.', example: tiles(helpRow('CHAIR', 'CCCCC', { check: true })) },
    { text: 'Guesses, time and score add up across all five stages.', example: chips(['Stage 1', 'accent'], ['Stage 2', 'accent'], ['Stage 5', 'gold']) },
  ],
  propernoundle: [
    { text: 'Guess a famous name: a person, place, brand, character or title. You get 6 tries.', example: tiles(helpRow('PARIS', 'TTTTT')) },
    { text: 'Purple, gold and gray work as usual, and guesses do not have to be dictionary words.', example: tiles(helpRow('PARIS', 'CAPAP')) },
    { text: 'A name can be two words. The gap shows the space.', example: tiles(helpRow('NEW YORK', 'CCCeCCCC')) },
    { text: 'Stuck? A clue, a vowel or a consonant, 60 points each.', example: chips(['Clue', 'accent'], ['Vowel', 'accent'], ['Consonant', 'accent']) },
  ],
  sudocious: [
    { text: 'Fill the grid so every row, column and 3 × 3 box has 1 to 9 exactly once.', example: tiles(helpRow('534678912', 'ggCgCggCg')) },
    { text: 'Tap a cell, then a number. Right turns purple; wrong turns red and is a mistake.', example: tiles(helpRow('4', 'C'), helpRow('9', 'X')) },
    { text: 'Notes pencil in candidates for free. The third mistake ends the puzzle.', example: tiles(helpRow('27', 'tt'), helpRow('✕✕✕', 'XXX')) },
  ],
  starsweep: [
    { text: 'Place one star in every row, every column and every color region.', example: tiles(helpRow('  ★    ', 'eeCeeee')) },
    { text: 'Stars never touch, not even at a corner.', example: tiles(helpRow('✕★✕', 'aCa')) },
    { text: 'Tap once for a free black star note, double-tap to play it. Red is a mistake; three end the game.', example: tiles(helpRow('★★★', 'tCX')) },
  ],
  'letter-ladder': [
    { text: 'Climb from the start word to the end word, changing one letter per rung.', example: ladder(helpRow('STONE', 'ggggg'), helpRow('STORE', 'gggCg')) },
    { text: 'Every rung must be a real word. A word that is turned away costs nothing.', example: tiles(helpRow('STOAE', 'XXXXX')) },
    { text: 'Reach the end word within par plus five moves. Undo is free.', example: tiles(helpRow('STARE', 'CCCCC', { check: true })) },
  ],
  spyglass: [
    { text: 'Ten words fit the theme. At first you only see how long each one is.', example: tiles(helpRow('     ', 'eeeee')) },
    { text: 'Words run across, down or diagonally, always forwards.', example: tiles(helpRow('XPEARQ', 'gCCCCg')) },
    { text: 'Tap the first and last letter, or drag across, to pick a word.', example: chips(['PEAR', 'accent'], ['PLUM', 'slate'], ['FIG', 'slate']) },
    { text: 'A straight line of 4+ letters that is not on the list is a miss.', example: tiles(helpRow('REAP', 'XXXX')) },
  ],
  hubbub: [
    { text: 'Make words of four or more letters from the seven. Every word uses the center letter.', example: tiles(helpRow('CAHMINE', 'gggCggg')) },
    { text: 'A 4-letter word is 1 point. Longer words score their length.', example: tiles(helpRow('MINE', 'CCCC', { tag: '+1' }), helpRow('MANIC', 'CCCCC', { tag: '+5' })) },
    { text: 'Use all seven letters for a pangram: 7 bonus points.', example: tiles(helpRow('MACHINE', 'PPPPPPP', { tag: '+14' })) },
    { text: 'Reach Hubbub, half the top score, to solve it. Then keep climbing.', example: chips(['Chatter', 'slate'], ['Hubbub', 'accent'], ['Pandemonium', 'gold']) },
  ],
  codebreaker: [
    { text: 'Every letter of a saying is swapped for another, the same way throughout.', example: ladder(helpRow('KQZZ', 'gggg'), helpRow('TREE', 'tttt')) },
    { text: 'The three most common letters start filled in and locked.', example: tiles(helpRow('  EE', 'eeCC')) },
    { text: 'Tap a box and type. The letter fills every box with that code letter.', example: tiles(helpRow('TREE', 'TTcc')) },
    { text: 'Check locks right letters and clears wrong ones. Each Check counts.', example: tiles(helpRow('TREE', 'CCCC', { check: true })) },
  ],
  kindred: [
    { text: 'Sixteen words hide four groups of four that share something.', example: chips(['LEMON', 'slate'], ['LIME', 'slate'], ['BOOT', 'slate'], ['ORANGE', 'slate']) },
    { text: 'Tap four words and Submit. A right group locks into a bar.', example: chips(['Citrus fruits', 'gold']) },
    { text: 'A wrong set is a mistake. "One away…" means three of them fit.', example: chips(['One away…', 'red']) },
    { text: 'Stuck? Name a category or show a pair. Neither costs a mistake.', example: chips(['Name a category', 'accent'], ['Show a pair', 'accent']) },
  ],
  crosswordocious: [
    { text: 'Every clue is a familiar saying with one word missing: "Calm before the ____".', example: tiles(helpRow('     ', 'eeeee')) },
    { text: 'Tap a cell or a clue and type. Tap twice to switch Across and Down.', example: tiles(helpRow('STO  ', 'TTTee')) },
    { text: 'Check locks right letters and clears wrong ones. Each Check counts.', example: tiles(helpRow('STORN', 'CCCCX')) },
    { text: 'Fill every cell right and the grid completes itself.', example: tiles(helpRow('STORM', 'CCCCC', { check: true })) },
  ],
  muddle: [
    { text: 'Unscramble four words. A full word checks itself.', example: ladder(helpRow('LAPPE', 'ggggg'), helpRow('APPLE', 'CCCCC')) },
    { text: 'The ringed letters of each solved word drop to the punchline row.', example: tiles(helpRow('APPLE', 'PcPcc')) },
    { text: 'Spell the pun from those letters to finish the joke.', example: tiles(helpRow('AP  ', 'CCee')) },
    { text: 'Every full word is a check: 5 is perfect, the 13th loses.', example: chips(['5 checks', 'gold'], ['13th check', 'red']) },
  ],
};

/** The steps for a guide slug (classic, quadword, letter-ladder, …), or null. */
export function helpSteps(slug: string): HelpSteps | null {
  const steps = STEPS[slug];
  const guide = getGuide(slug);
  if (!steps || !guide) return null;
  return { slug, title: guide.title, steps };
}

/** Every slug with help steps. */
export const HELP_STEP_SLUGS: readonly string[] = Object.keys(STEPS);
