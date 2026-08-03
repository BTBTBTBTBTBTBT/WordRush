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
  accent: string;   // hex heading colour
  body: string;
}

export interface HTPSection {
  title: string;
  intro?: string;
  bullets?: HTPBullet[];
  tilesHeading?: string;
  tiles?: HTPTileRow[];
  modes?: HTPMode[];
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
    title: 'Game Mode Guide',
    modes: [
      {
        name: 'Classic — 1 Word, 6 Guesses', accent: '#7c3aed',
        body: 'The standard word puzzle experience. You have six attempts to guess a single five-letter word. Start with a word that contains common letters like E, A, R, S, and T to eliminate possibilities quickly. Pay attention to gray tiles — knowing which letters are not in the word is just as valuable as finding correct ones.',
      },
      {
        name: 'VS Battle — Real-Time Multiplayer', accent: '#0d9488',
        body: 'A head-to-head race on the same puzzle. The match happens in real time — you can see when your opponent submits guesses. Speed matters, but accuracy matters more: a wrong guess wastes precious time. Invite a friend with a link, queue up for a live opponent, or battle one of the built-in bot opponents — each has its own personality and difficulty, so there is always a match waiting.',
      },
      {
        name: 'QuadWord — 4 Words, 9 Guesses', accent: '#ec4899',
        body: 'Solve four different words at the same time using a shared pool of nine guesses. Every word you type is checked against all four boards simultaneously. The strategy shifts compared to Classic — choose guesses that give useful information across multiple boards rather than targeting a single word. Once a board is solved, it locks in and you can focus on the remaining ones.',
      },
      {
        name: 'OctoWord — 8 Words, 13 Guesses', accent: '#7e22ce',
        body: 'The biggest multi-board challenge in Wordocious. Eight words, thirteen guesses, and every guess applies to all unsolved boards. This mode rewards broad vocabulary and strategic opening words. Start with guesses that use many different common letters to light up as many boards as possible before narrowing down individual answers.',
      },
      {
        name: 'Succession — 4 Words in Sequence, 10 Guesses', accent: '#2563eb',
        body: 'Four puzzles solved one after another, sharing a total pool of ten guesses. Solve the first word to reveal the second, and so on. The challenge is budget management — if you spend too many guesses on early words, you will not have enough for the later ones. Aim to solve each word in two to three guesses to stay on track.',
      },
      {
        name: 'Deliverance — 4 Boards with Hints, 6 Guesses', accent: '#059669',
        body: 'Four boards that come pre-loaded with letter hints to give you a head start. Some tiles are already revealed before you make your first guess. With only six guesses to solve all four words, you need to use the given hints wisely. Look for patterns in the revealed letters to deduce the answers quickly.',
      },
      {
        name: 'Six — 6-Letter Words, 7 Guesses', accent: '#06b6d4',
        body: 'The same Classic rules applied to six-letter words. You get seven guesses to find the answer. The extra letter opens up a much wider pool of possible words, demanding deeper vocabulary knowledge and more strategic letter placement. A natural step up for players who have mastered the five-letter format.',
      },
      {
        name: 'Seven — 7-Letter Words, 8 Guesses', accent: '#84cc16',
        body: 'The biggest single-word challenge in Wordocious. Seven-letter words with eight guesses push your vocabulary and deduction skills to their absolute limits. With thousands of possible solutions, every guess needs to eliminate as many possibilities as it can. Recommended for experienced players looking for a real test.',
      },
      {
        name: 'Gauntlet — 5 Stages of Increasing Difficulty', accent: '#d97706',
        body: 'A five-stage endurance test: The Opening (a single word), then QuadWord, Succession, Deliverance, and finally OctoWord. Each stage is more demanding than the last, and one failed stage ends the run. Completing the full Gauntlet requires consistent performance across every style of play — only the most skilled players finish all five stages.',
      },
      {
        name: 'ProperNoundle — Famous Names & Cultural References', accent: '#dc2626',
        body: 'A twist on the classic formula: instead of dictionary words, you guess proper nouns — famous people, places, landmarks, and cultural references. Each daily puzzle belongs to a themed category such as current events, music, movies, sports, video games, history, or science. The answer can be multiple words long, and the board displays word breaks to help you visualize the full name. With more than 650 puzzles in the pool, every day brings a fresh challenge.',
      },
    ],
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
    title: 'XP, Levels & Achievements',
    intro: 'Every game earns experience points that contribute to your overall level:',
    bullets: [
      { strong: 'Win:', text: ' 100 XP' },
      { strong: 'Loss:', text: ' 25 XP (you still earn XP for trying)' },
      { strong: 'Win streak bonus:', text: ' +50 XP' },
      { strong: 'Daily challenge bonus:', text: ' +50 XP' },
      { strong: 'Daily Sweep:', text: ' +200 XP for playing all 9 of the day’s puzzles' },
      { strong: 'Flawless Victory:', text: ' +400 XP more for winning every one (600 XP total with the Sweep)' },
      { strong: 'Medal XP:', text: ' Gold +100, Silver +50, Bronze +25' },
    ],
    outro:
      'Every 1,000 XP advances you one level. Your level and total XP are displayed on your profile alongside your achievements, medal collection, and lifetime statistics.',
  },
  {
    title: 'Streaks & Streak Shields',
    intro:
      'Play at least one daily puzzle each day to build your streak. Your streak counter increases by one every consecutive day you play. Miss a day and the streak resets to zero.',
    outro:
      'Streak Shields are special items that protect your streak if you miss a day. When you miss a day and have a shield available, it is automatically used to keep your streak alive. Shields can be earned through gameplay milestones and achievements.',
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
