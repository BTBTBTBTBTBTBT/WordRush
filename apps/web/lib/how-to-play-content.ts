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
        body: 'Challenge another player to a head-to-head race. Both players see the same word and compete to solve it first. The match happens in real time — you can see when your opponent submits guesses. Speed matters, but accuracy matters more. A wrong guess wastes precious time. Challenge friends directly or get matched with a random opponent of similar skill.',
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
        body: 'A multi-stage endurance test. You start with a single Classic puzzle, then face progressively harder challenges through QuadWord and OctoWord-style stages. Each stage is more demanding than the last. Completing the full Gauntlet requires consistent performance across every difficulty level. Only the most skilled players finish all five stages.',
      },
      {
        name: 'ProperNoundle — Famous Names & Cultural References', accent: '#dc2626',
        body: 'A twist on the classic formula: instead of dictionary words, you guess proper nouns — famous people, places, landmarks, and cultural references. Each daily puzzle belongs to a themed category such as current events, music, movies, sports, video games, history, or science. The answer can be multiple words long, and the board displays word breaks to help you visualize the full name. With over 670 puzzles in the pool, every day brings a fresh challenge.',
      },
    ],
  },
  {
    title: 'Scoring System',
    intro: 'Every solved puzzle earns a composite score — the number your daily-leaderboard rank is based on:',
    bullets: [
      { strong: 'Base score (1,000 points)', text: ' — awarded for solving the puzzle, regardless of performance' },
      { strong: 'Speed bonus', text: ' — your mode’s time cap minus your solve time. The clock starts when the puzzle loads and stops on the winning guess, so finishing faster is worth more (Classic’s cap is 5 minutes; longer modes allow more time)' },
      { strong: 'Completion bonus (up to 200 points)', text: ' — scaled by how many boards you solved, so multi-board modes reward partial progress' },
      { strong: 'Guess bonus', text: ' — in Six, Seven, and ProperNoundle only, extra points for solving in fewer guesses' },
      { strong: 'Hint penalty', text: ' — in Six, Seven, and ProperNoundle, each revealed hint is subtracted from your score (120 points each in ProperNoundle, 150 in Six and Seven). A winning score never drops below zero' },
    ],
    outro:
      'For example, solving a Classic puzzle in 27 seconds earns 1,000 (base) + 273 (speed) + 200 (completion) = 1,473 points. The dictionary modes have no guess bonus or hint penalty — speed and completion are what move your score.',
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
