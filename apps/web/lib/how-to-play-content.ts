/**
 * "How to Play" content — single-sourced so the web /how-to-play page AND the
 * native How to Play screen (iOS + Android, via /api/howtoplay) render the exact
 * same document. Sections are heterogeneous (rules + tile examples, the mode
 * guide, scoring, XP, streaks, tips); each field is optional and rendered when
 * present.
 */

export type HTPTileColor = 'green' | 'yellow' | 'gray' | 'empty';

export interface HTPTileRow {
  letters: { ch: string; color: HTPTileColor }[];
  strong: string;       // e.g. "Purple"
  strongColor: string;  // hex for the strong word
  rest: string;         // the rest of the sentence
}

export interface HTPBullet {
  strong?: string;  // optional bold lead-in
  text: string;     // remainder
}

export interface HTPMode {
  name: string;     // "Classic — 1 Word, 6 Guesses"
  accent: string;   // hex heading color
  body: string;
}

/**
 * One game's entry (2.8 item 36): icon + title art + a few plain lines + "Full guide" + "Watch how" (its first-play
 * tutorial). `id` is the catalog mode id ('practice', 'hub', 'vs') or `pocket-<kind>` for the six pocket games; the
 * guide slug, icon and title art come from the catalog on every platform.
 */
export interface HTPGame {
  id: string;
  title: string;
  accent: string;
  lines: string[];
}

export interface HTPSection {
  title: string;
  intro?: string;
  bullets?: HTPBullet[];
  tilesHeading?: string;
  tiles?: HTPTileRow[];
  modes?: HTPMode[];
  games?: HTPGame[];
  outro?: string;
}

export const HOW_TO_PLAY: HTPSection[] = [
  {
    title: 'The Basics',
    intro:
      'Guess the five-letter word. Each guess must be a valid English word. After you submit a guess, the tiles change color to show how close you are to the answer.',
    bullets: [
      { text: 'Type a five-letter word and press Enter to submit your guess' },
      { text: 'Each guess must be a real word from the dictionary' },
      { text: 'Use the color clues from previous guesses to narrow down the answer' },
      { text: 'You have a limited number of guesses depending on the game mode' },
    ],
    tilesHeading: 'Understanding Tile Colors',
    tiles: [
      {
        letters: [
          { ch: 'W', color: 'green' }, { ch: 'E', color: 'empty' }, { ch: 'A', color: 'empty' },
          { ch: 'R', color: 'empty' }, { ch: 'Y', color: 'empty' },
        ],
        strong: 'Purple', strongColor: '#7c3aed',
        rest: ' — the letter is in the word and in the correct position.',
      },
      {
        letters: [
          { ch: 'P', color: 'empty' }, { ch: 'I', color: 'yellow' }, { ch: 'L', color: 'empty' },
          { ch: 'L', color: 'empty' }, { ch: 'S', color: 'empty' },
        ],
        strong: 'Amber', strongColor: '#f59e0b',
        rest: ' — the letter is in the word but in the wrong position.',
      },
      {
        letters: [
          { ch: 'V', color: 'empty' }, { ch: 'A', color: 'empty' }, { ch: 'G', color: 'empty' },
          { ch: 'U', color: 'gray' }, { ch: 'E', color: 'empty' },
        ],
        strong: 'Gray', strongColor: '#6b7280',
        rest: ' — the letter is not in the word at all.',
      },
    ],
  },
  {
    title: 'Dailies',
    intro:
      'Eight word games, new every day, the same for everyone. Play every one for a Daily Sweep. Tap “Watch how” on any game for a quick walk-through, or “Full guide” for the rules, scoring and strategy.',
    games: [
      {
        id: 'practice', title: 'Classic', accent: '#7c3aed',
        lines: [
          'Guess the five-letter word in six tries.',
          'Purple means the right spot, gold means the wrong spot, gray means the letter is not in the word.',
          'Everyone gets the same word each day.',
        ],
      },
      {
        id: 'quordle', title: 'QuadWord', accent: '#ec4899',
        lines: [
          'Four words at once, nine guesses in all.',
          'Every guess is checked against all four boards, and a solved board locks in.',
          'Pick guesses that help several boards, not just one.',
        ],
      },
      {
        id: 'octordle', title: 'OctoWord', accent: '#7e22ce',
        lines: [
          'Eight words at once, thirteen guesses in all.',
          'Open with words that use many common letters to light up as many boards as you can.',
        ],
      },
      {
        id: 'sequence', title: 'Succession', accent: '#2563eb',
        lines: [
          'Four words, one after another, sharing ten guesses.',
          'Solve a word to unlock the next one.',
          'Spend two or three guesses on each and you stay on budget.',
        ],
      },
      {
        id: 'six', title: 'Six', accent: '#06b6d4',
        lines: [
          'Classic rules, with six-letter words and seven guesses.',
          'Hints are there if you get stuck, for a small score cost.',
        ],
      },
      {
        id: 'seven', title: 'Seven', accent: '#84cc16',
        lines: [
          'Classic rules, with seven-letter words and eight guesses.',
          'The biggest single-word test, so make every guess count.',
        ],
      },
      {
        id: 'rescue', title: 'Deliverance', accent: '#059669',
        lines: [
          'Four boards that start with some letters already revealed, and six guesses.',
          'Use the revealed letters to spot patterns and deduce the answers.',
        ],
      },
      {
        id: 'gauntlet', title: 'Gauntlet', accent: '#d97706',
        lines: [
          'Five stages in a row: the Opening, QuadWord, Succession, Deliverance and OctoWord.',
          'Each stage is harder than the last, and one failed stage ends the run.',
        ],
      },
    ],
  },
  {
    title: 'Puzzles',
    intro:
      'Ten more dailies, from number logic to crosswords. They have their own Puzzles Sweep and Puzzles Flawless, separate from the Daily Sweep, and every one earns XP, medals and a leaderboard place.',
    games: [
      {
        id: 'propernoundle', title: 'ProperNoundle', accent: '#dc2626',
        lines: [
          'Guess a famous name, place or landmark, with a themed category as your clue.',
          'The answer can be several words long, and the board shows the word breaks.',
        ],
      },
      {
        id: 'sudoku', title: 'Sudocious', accent: '#1e40af',
        lines: [
          'Fill the nine-by-nine grid so every row, column and box holds 1 to 9 once.',
          'Three wrong digits end the puzzle. Notes are free, and a hint costs 100 points.',
        ],
      },
      {
        id: 'regions', title: 'Starsweep', accent: '#ca8a04',
        lines: [
          'Place one star in every row, column and color region, with no two stars touching.',
          'Tap for a free black star, double-tap to play it. Three wrong stars end the game.',
        ],
      },
      {
        id: 'wordsearch', title: 'Spyglass', accent: '#4d7c0f',
        lines: [
          'Ten words on one theme hide in a ten-by-ten grid, always reading forwards.',
          'The word list starts hidden: each chip shows only a length, so hunt from the theme.',
          'Drag across a word, or tap its first and last letter.',
        ],
      },
      {
        id: 'ladder', title: 'Letter Ladder', accent: '#0284c7',
        lines: [
          'Climb from the start word to the end word, changing one letter per rung.',
          'Every rung must be a real word. Par is the shortest route.',
        ],
      },
      {
        id: 'hub', title: 'Hubbub', accent: '#c026d3',
        lines: [
          'Seven letters, one in the center. Make words of four letters or more that use the center letter.',
          'Longer words score more, and a word that uses all seven earns a bonus.',
          'Climb the ranks as your score grows.',
        ],
      },
      {
        id: 'groups', title: 'Kindred', accent: '#9f1239',
        lines: [
          'Sixteen words hide four groups of four that share something.',
          'Pick four and Submit. Four wrong sets lose the puzzle, and two hints are free of mistakes.',
        ],
      },
      {
        id: 'crossword', title: 'Crosswordocious', accent: '#475569',
        lines: [
          'A themed crossword where every clue is a saying with one word blanked out.',
          'The answer is the missing word. Letters are free to place; only Check counts against you.',
        ],
      },
      {
        id: 'cryptogram', title: 'Codebreaker', accent: '#92400e',
        lines: [
          'A well-known saying has every letter swapped for another, the same way throughout.',
          'The three most common letters are already filled in. Crack the rest.',
        ],
      },
      {
        id: 'scramble', title: 'Muddle', accent: '#f97316',
        lines: [
          'Unscramble four words, then use their ringed letters to spell the cartoon punchline.',
          'Each word checks itself when it is full. Wrong checks are limited, so think first.',
        ],
      },
    ],
  },
  {
    title: 'VS Battle & Bots',
    intro: 'Race another player on the same puzzle, live.',
    games: [
      {
        id: 'vs', title: 'VS Battle', accent: '#0d9488',
        lines: [
          'You and your opponent solve the same puzzle at the same time, and you can see each other’s progress.',
          'Speed matters, but a wrong guess costs time, so accuracy matters more.',
          'Challenge a friend with a link, queue for a live opponent, or race a bot.',
        ],
      },
    ],
    bullets: [
      { strong: 'Bots', text: ' are always ready. Each has its own personality and difficulty, so there is always a match waiting, any time of day.' },
      { strong: 'Race my run', text: ' lets a friend race the run you already played.' },
    ],
  },
  {
    title: 'Pocket Games',
    intro:
      'Six quick games to play with a friend, right from the Friends tab. Take your turn any time. Your friend gets a ping, and the game waits for you both for three days.',
    games: [
      {
        id: 'pocket-rps', title: 'Rock Paper Scissors', accent: '#ec4899',
        lines: ['Pick in secret, then both hands flip together.', 'First to win two rounds takes the match.'],
      },
      {
        id: 'pocket-ttt', title: 'Tic-Tac-Tile', accent: '#7c3aed',
        lines: ['Take turns placing tiles on a three-by-three board.', 'Three in a row wins the game. Win two games to take the match.'],
      },
      {
        id: 'pocket-coin', title: 'Call It', accent: '#f59e0b',
        lines: ['Call heads or tails before the flip.', 'First to win three flips takes the match and the stake you picked.'],
      },
      {
        id: 'pocket-pass', title: 'Pass the Puzzle', accent: '#0d9488',
        lines: ['You and a friend share one hidden word and one board, and take turns guessing.', 'Whoever finds the word wins. Nobody finds it in six, it is a draw.'],
      },
      {
        id: 'pocket-ghost', title: 'Ghost', accent: '#2563eb',
        lines: ['Take turns adding a letter to a growing fragment that must stay on the way to a real word.', 'Finish a word, or play a dead end, and you lose the round.'],
      },
      {
        id: 'pocket-chain', title: 'Word Chain', accent: '#059669',
        lines: ['Play a word that starts with the last letter of the one before it.', 'Longer words score more, no word can repeat, and 30 points wins.'],
      },
    ],
  },
  {
    title: 'Sweeps, Streaks & XP',
    intro: 'The daily loop: play, sweep, keep the streak, level up.',
    bullets: [
      { strong: 'Daily Sweep:', text: ' play all eight Dailies in a day. It earns +200 XP and a place on the Sweep board.' },
      { strong: 'Flawless Victory:', text: ' win all eight for +400 XP more, 600 XP with the Sweep.' },
      { strong: 'Puzzles Sweep and Flawless:', text: ' the same idea for the ten Puzzles. They count on their own and never change your Daily Sweep.' },
      { strong: 'Streaks:', text: ' play at least one daily each day and your streak grows by one. Miss a day and it resets to zero.' },
      { strong: 'Streak Shields:', text: ' protect your streak when you miss a day, and are used automatically. You earn them through milestones and achievements.' },
      { strong: 'XP and levels:', text: ' a win is 100 XP, a loss is 25 XP, a win streak adds 50, the daily challenge adds 50, and medals add Gold 100, Silver 50, Bronze 25. Every 1,000 XP is one level.' },
      { strong: 'Achievements:', text: ' unlock them as you play. Your level, medals and achievements show on your profile.' },
    ],
    outro: 'Wordocious is for players 13 and older.',
  },
  {
    title: 'Which Words Count?',
    intro:
      'Every guess is checked against the Wordocious word bank — thousands of English words, kept far more generous than the daily answers ever are. Answers are everyday words nobody should have to look up; the bank accepts much more than that, so a long-shot guess is never wasted on a technicality.',
    bullets: [
      {
        strong: 'Answers are always common words.',
        text: ' No abbreviations, no obscure trivia. If you have never seen the word before, it will not be the answer.',
      },
      {
        strong: 'Guesses can be more obscure.',
        text: ' Any real English word in modern use is accepted, so you can try a word you are not sure about.',
      },
      {
        strong: 'Regular word endings count.',
        text: ' If a word is in the bank, so are its -S, -ED, -ER and -ING forms whenever they fit the board — ASKED, BORED, LOOKS and NUKED are all fair game.',
      },
      {
        strong: 'No names or places in the word modes.',
        text: ' DAVID, PARIS and TEXAS are not accepted — unless the name is also an everyday word, like ROBIN or PEARL. The one exception is ProperNoundle, where famous names are the whole game and your guesses are not checked against the word bank at all.',
      },
      {
        strong: 'Slurs are never accepted,',
        text: ' as a guess or as an answer.',
      },
    ],
    outro:
      "Missing a word you are sure is real, or think something should not be accepted? Email support@wordocious.com. No word bank is ever finished, and player reports are how we catch the ones that slip through.",
  },
  {
    title: 'Scoring System',
    intro:
      'Every solved puzzle earns a composite score — the number your daily-leaderboard rank is based on. The rule of thumb: fewer guesses always wins, and speed breaks ties.',
    bullets: [
      { strong: 'Base score (1,000 points)', text: ' — awarded for solving the puzzle, regardless of performance' },
      { strong: 'Guess bonus', text: ' — every guess you did not need is worth a fixed amount for your mode: 300 points each in Classic, with other modes scaled to their guess budget' },
      { strong: 'Speed bonus', text: ' — scaled by how far under your mode’s time cap you finish. It is always worth less than a single saved guess, so a faster solve never outranks a more efficient one' },
      { strong: 'Completion bonus (up to 200 points)', text: ' — scaled by how many boards you solved, so multi-board modes reward partial progress' },
      { strong: 'Hint penalty', text: ' — in Six, Seven, and ProperNoundle, each revealed hint costs a flat penalty (60 points in ProperNoundle, 75 in Six and Seven) and fills a board row, which also costs one step of guess bonus. A winning score never drops below zero' },
      { strong: 'Photo finishes', text: ' — the speed bonus counts fractions of a point per second, so every second matters even when it does not show. Leaderboards display whole numbers; if two players land on the same whole number, the decimals appear on exactly those rows (say 2,328.8 vs 2,328.0) so you can see who edged it out. Identical decimals mean a true tie' },
    ],
    outro:
      'For example, solving a Classic puzzle in 3 guesses at 37 seconds earns 1,000 (base) + 900 (guess bonus) + about 210 (speed) + 200 (completion) — roughly 2,310 points.',
  },
  {
    title: 'What About Losses?',
    intro:
      'Running out of guesses never zeroes you out — a loss still banks credit for how far you got. What it never earns are the win bonuses: no 1,000-point base, no guess bonus, no speed bonus. So any win, however scrappy, always outscores even the best loss.',
    bullets: [
      {
        strong: 'Multi-board modes',
        text: ' (QuadWord, OctoWord, Succession, Deliverance) — you keep (boards solved ÷ total boards) × 200 points. Fall one short in OctoWord with 7 of 8 boards solved and you still bank 175 points.',
      },
      {
        strong: 'Gauntlet',
        text: ' — a depth ladder pays more for every stage you fully clear, plus 6 points per board solved in the stage that stopped you — so a deeper run always outscores a shallower one.',
      },
      {
        strong: 'Single-board modes',
        text: ' (Classic, Six, Seven, ProperNoundle) — near-miss credit: 12 points for every letter your best guess placed in the correct spot (the purple tiles).',
      },
    ],
    outro:
      'One more fine point, for medal chasers: when two players land the exact same score, the faster time takes the medal — and if score and time are both identical, they share it.',
  },
  {
    title: 'Tips for New Players',
    bullets: [
      { strong: 'Start with vowel-heavy words.', text: ' Words like ARISE, AUDIO, or OUIJA test multiple vowels in your first guess and quickly reveal which vowels are in play.' },
      { strong: 'Pay attention to gray tiles.', text: ' Eliminating letters is just as useful as finding correct ones. Cross off letters mentally to narrow the possibilities.' },
      { strong: 'Think about letter frequency.', text: ' Common consonants like R, S, T, L, and N appear in many words. Use them early to gather information.' },
      { strong: 'In multi-board modes, think broadly.', text: ' Pick guesses that use many different letters rather than targeting one specific board.' },
      { strong: 'In Succession, be conservative early.', text: ' Solving the first word in two guesses leaves you with eight for the remaining three — a much more comfortable budget.' },
      { strong: 'Play every day.', text: ' Even a single daily puzzle builds your streak and earns bonus XP. Consistency is rewarded.' },
    ],
  },
];
