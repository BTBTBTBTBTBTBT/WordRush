// ─────────────────────────────────────────────────────────────────────────
// Single source of truth for the app's static editorial copy: FAQ, Help
// (game-mode descriptions + help FAQ), About, and Support.
//
// Web pages/components import these directly (SSR). Native apps fetch the same
// data from /api/content and render it natively (see ContentService on iOS +
// Android), persisting the last fetch so it renders offline. Privacy + Terms
// are deliberately NOT here — they stay hardcoded per platform for offline /
// pre-sign-in compliance. Edit copy HERE and it propagates everywhere.
// ─────────────────────────────────────────────────────────────────────────

export interface FaqItem { q: string; a: string }
export interface FaqSection { heading: string; items: FaqItem[] }
export interface HelpMode { title: string; desc: string; accent: string; glyph?: string }
export interface ContentSubItem { heading: string; body: string; accent?: string }
export interface ContentSection { heading: string; paragraphs?: string[]; items?: ContentSubItem[] }

// ── FAQ (the standalone /faq page) ──────────────────────────────────────────
export const FAQ_SECTIONS: FaqSection[] = [
  {
    heading: 'Getting Started',
    items: [
      { q: 'Is Wordocious free?', a: 'Yes — a new daily puzzle in every mode is free, every day. An optional Pro subscription removes ads and unlocks unlimited replays beyond the daily, but the daily puzzles and leaderboards are always free.' },
      { q: 'Do I need an account to play?', a: 'You can browse every mode and read these guides without an account. To play, save streaks, earn medals, and appear on the daily leaderboards, sign in with Google or an email address.' },
      { q: 'How often do new puzzles appear?', a: 'Every mode gets one fresh puzzle per day, resetting at your local midnight. Everyone worldwide gets the same daily words, so scores are directly comparable.' },
    ],
  },
  {
    heading: 'How the Tiles Work',
    items: [
      { q: 'What do the tile colors mean?', a: 'Purple means the letter is correct and in the right position. Amber means the letter is in the word but in a different spot. Gray means the letter is not in the word at all. Use these clues to eliminate possibilities with each guess.' },
      { q: 'What happens with repeated letters?', a: 'Each tile is judged independently. If your guess has two of a letter but the answer has only one, one tile shows the matching color and the extra shows gray — a subtle clue that the letter appears only once.' },
    ],
  },
  {
    heading: 'Strategy Tips',
    items: [
      { q: 'What is a good starting word?', a: 'Open with a word rich in common letters and vowels — words like AROSE, RAISE, SLATE, or CRANE test five high-frequency letters at once and quickly narrow the field. Avoid repeated letters in your opener so every tile gives new information.' },
      { q: 'How do I solve multi-board modes (QuadWord, OctoWord)?', a: 'Every guess applies to all boards simultaneously, so spend your first two or three guesses on broad letter-coverage words rather than chasing any single board. Once a board has a few purple tiles, lock it in, then pivot your remaining guesses to the boards with the least information.' },
      { q: 'Any tips for the Gauntlet?', a: 'The Gauntlet chains five escalating stages into one run with a shared guess budget, so efficiency compounds. Bank guesses early on the easier stages — solving in three instead of five leaves a cushion for the harder boards later. Reuse confirmed letters across stages where the layout allows.' },
      { q: 'How do I win Six and Seven?', a: 'Longer words have more structure: prefixes, suffixes, and common letter pairs (TH, CH, ING, ER). Once you have a couple of purple tiles, think about which affixes fit. The extra guesses (seven and eight) give you room to probe letter positions methodically.' },
      { q: 'How do I score higher on the leaderboard?', a: 'Daily rank is a composite of how few guesses you used and how fast you solved. Solving in fewer guesses matters most, but speed breaks ties — so know your opening word cold and do not overthink the easy boards.' },
    ],
  },
  {
    heading: 'Progress, Medals & Pro',
    items: [
      { q: 'What is a Daily Sweep and a Flawless Victory?', a: 'Completing all of the day’s puzzles earns a Daily Sweep and bonus XP. Winning every one of them (not just completing) earns a Flawless Victory and a larger bonus. Streaks of sweeps and flawless days unlock achievements.' },
      { q: 'How do medals work?', a: 'Each daily puzzle has a leaderboard; the top finishers earn gold, silver, and bronze medals that accumulate on your profile. Medal counts feed several collection achievements.' },
      { q: 'Are there achievements to earn?', a: 'Yes — 75 achievements span five categories: beginner milestones, consistency (streaks and daily sweeps), skill (speed solves, perfect games, beating the Gauntlet), social (VS wins), and collection (medals). They unlock automatically as you hit each milestone, and your full set — locked and unlocked, with progress toward each — is displayed on your profile, so there is always a next goal to chase.' },
      { q: 'What does Pro unlock?', a: 'Pro removes ads, gives unlimited replays of every mode beyond the free daily, adds VS battles in every mode, grants streak shields, a profile badge, and extended stats. The daily puzzles stay free for everyone.' },
    ],
  },
];

// ── Help sheet: game-mode descriptions ──────────────────────────────────────
// glyph is the share-style monogram (roman numeral / letter) used where an icon
// isn't rendered; web/natives keep their own icon rendering keyed by title.
export const HELP_MODES: HelpMode[] = [
  { title: 'Classic', desc: '1 word, 6 guesses. The original formula.', accent: '#7c3aed', glyph: 'C' },
  { title: 'VS Battle', desc: 'Race an opponent in real-time. First to solve wins.', accent: '#0d9488' },
  { title: 'QuadWord', desc: '4 words at once. 9 guesses total. Each guess applies to all 4 boards.', accent: '#ec4899', glyph: 'IV' },
  { title: 'OctoWord', desc: '8 words at once. 13 guesses. Same idea, bigger challenge.', accent: '#7e22ce', glyph: 'VIII' },
  { title: 'Succession', desc: '4 words solved in order. Solve one to unlock the next. 10 guesses total.', accent: '#2563eb' },
  { title: 'Deliverance', desc: '4 boards with pre-filled hints to get you started. 6 guesses to solve them all.', accent: '#059669' },
  { title: 'Six', desc: 'Guess a 6-letter word in 7 tries. Same rules as Classic, bigger vocabulary.', accent: '#06b6d4', glyph: '6' },
  { title: 'Seven', desc: 'Guess a 7-letter word in 8 tries. The ultimate single-word challenge.', accent: '#84cc16', glyph: '7' },
  { title: 'Gauntlet', desc: '5 stages of increasing difficulty — Classic through OctoWord. Survive them all.', accent: '#d97706' },
  { title: 'ProperNoundle', desc: 'Guess famous names instead of dictionary words. Themed daily puzzles.', accent: '#dc2626' },
];

// ── Help sheet: FAQ tab ─────────────────────────────────────────────────────
export const HELP_FAQ: FaqItem[] = [
  { q: 'How are scores calculated?', a: "Solving earns a 1,000-point base, plus a speed bonus (your mode's time cap minus your solve time — faster is better) and a completion bonus of up to 200, scaled by how many boards you solved. Six, Seven, and ProperNoundle also add a guess bonus for solving in fewer guesses. Example: a Classic solve in 27s scores 1,000 + 273 (speed) + 200 (completion) = 1,473. Your daily-leaderboard rank is based on this composite score." },
  { q: 'Do hints affect my score?', a: 'Yes. In Six, Seven, and ProperNoundle you can reveal a hint, but each one is subtracted from your score — 120 points per hint in ProperNoundle and 150 in Six and Seven. Hints never push a winning score below zero, and modes without hint buttons are unaffected.' },
  { q: 'How do XP and levels work?', a: "Win = 100 XP, loss = 25 XP. Bonuses: +50 for a win streak, +50 for a daily challenge, and medal XP (gold +100, silver +50, bronze +25). Play all 9 of the day's puzzles for a Daily Sweep (+200 XP), and win every one for a Flawless Victory (+400 XP more — 600 total). Every 1,000 XP = 1 level." },
  { q: 'How do medals work?', a: "Finish in the top three of a mode's daily leaderboard to earn a gold, silver, or bronze medal, with extra medals for streak milestones and perfect games. Your medal tally is shown on your profile." },
  { q: 'Are there achievements?', a: 'Yes — 75 achievements to unlock across beginner, consistency, skill, social, and collection challenges, from your First Win to a flawless Gauntlet run, 30-day streaks, winning 50 games in a single mode, and big medal hauls. They unlock automatically as you play, and your full collection (with progress toward each one) lives on your profile.' },
  { q: "What's a streak?", a: 'Play at least one daily puzzle each day to build your daily streak. Puzzles reset at your local midnight, and missing a day resets the streak — unless a Streak Shield saves it.' },
  { q: 'What are Streak Shields?', a: 'A Streak Shield automatically protects your streak the first time you miss a day. You earn shields through gameplay milestones, and your current count appears in the header.' },
  { q: 'What does PRO unlock?', a: 'PRO removes all ads and unlocks unlimited replays (free players get one play per mode per day), Unlimited mode for endless fresh puzzles, deep Pro Insights stats, and VS extras like sending invites and rematches.' },
  { q: 'Do daily puzzles use the same words for everyone?', a: 'Yes! Every player gets the same daily puzzles, so you can compare results on the leaderboard.' },
];

// ── About page ──────────────────────────────────────────────────────────────
export const ABOUT_SECTIONS: ContentSection[] = [
  {
    heading: 'What is Wordocious?',
    paragraphs: [
      'Wordocious is a free word puzzle game that goes far beyond the classic five-letter guess. With ten distinct game modes, daily challenges, real-time multiplayer battles, and global leaderboards, Wordocious gives word game fans something new to play every single day.',
      'Whether you enjoy a quick solo puzzle on your morning commute or a competitive showdown against friends, Wordocious has a mode for you. Every daily puzzle is the same for all players worldwide, so you can compare scores and strategies with anyone.',
    ],
  },
  {
    heading: '10 Unique Game Modes',
    items: [
      { heading: 'Classic', accent: '#7c3aed', body: 'The original word puzzle formula. Guess a single five-letter word in six attempts. After each guess, colored tiles reveal which letters are correct, misplaced, or not in the word at all. A perfect starting point for new players and a daily ritual for veterans.' },
      { heading: 'VS Battle', accent: '#0d9488', body: 'Race against another player in real time. Both players receive the same word and compete to solve it first. Speed and accuracy both matter — the fastest correct solve wins the round. Challenge friends or get matched with a random opponent.' },
      { heading: 'QuadWord', accent: '#ec4899', body: 'Solve four words simultaneously with just nine total guesses. Every guess you type applies to all four boards at once, so you need to think strategically about which letters give you the most information across all four puzzles.' },
      { heading: 'OctoWord', accent: '#7e22ce', body: 'The ultimate multi-board challenge. Eight words, thirteen guesses, and the same simultaneous-solve mechanic as QuadWord. Managing eight boards at once demands careful planning and a deep vocabulary.' },
      { heading: 'Succession', accent: '#2563eb', body: 'Four words solved in sequence. Finish one puzzle to unlock the next, but all four share a single pool of ten guesses. Balancing speed against guess conservation is key — waste too many guesses early and the later words become nearly impossible.' },
      { heading: 'Deliverance', accent: '#059669', body: 'Four boards with pre-filled letter hints to help you get started. You have six guesses to solve all four words. The hints give you a head start, but the tight guess limit keeps things challenging. A great mode for players who enjoy deduction puzzles.' },
      { heading: 'Six', accent: '#06b6d4', body: 'Step up from the classic formula with six-letter words and seven guesses. The extra letter opens up a much wider vocabulary, demanding sharper deduction and broader word knowledge. Same rules, bigger challenge.' },
      { heading: 'Seven', accent: '#84cc16', body: 'The ultimate single-word challenge. Seven-letter words with eight guesses push your vocabulary to its limits. With thousands of possible solutions, every guess counts. Only the most dedicated word game masters will conquer Seven consistently.' },
      { heading: 'Gauntlet', accent: '#d97706', body: 'Five stages of increasing difficulty, starting with a Classic single-word puzzle and building up through QuadWord and OctoWord. Survive all five stages to complete the Gauntlet. Each stage is harder than the last, testing your endurance and skill.' },
      { heading: 'ProperNoundle', accent: '#dc2626', body: 'Instead of dictionary words, guess famous names, places, and cultural references. Each daily puzzle is themed — categories include current events, music, movies, sports, video games, history, and science. With over 670 unique puzzles, there is always something new to discover.' },
    ],
  },
  {
    heading: 'Daily Challenges & Streaks',
    paragraphs: [
      'Every game mode features a daily puzzle that resets at midnight in your local time. All players receive the same daily puzzle each day, making it easy to compare results with friends, family, or the global community.',
      'Play at least one daily puzzle each day to build your streak. Streaks reward consistency — the longer your streak, the more bonus XP you earn. If life gets in the way, Streak Shields can protect your streak from a missed day.',
    ],
  },
  {
    heading: 'Leaderboards & Competition',
    paragraphs: [
      'Compete for the top spot on daily leaderboards across every game mode. Gold, silver, and bronze medals are awarded to the top performers each day, and your medal collection is displayed on your profile for everyone to see.',
      'Your profile tracks lifetime statistics including total games played, win rates, average scores, best streaks, and achievements. Level up by earning XP from wins, streaks, and daily challenges.',
    ],
  },
  {
    heading: 'How Scoring Works',
    paragraphs: [
      'Every completed puzzle earns a score based on three factors: a base score for solving the puzzle, a guess bonus for using fewer attempts, and a speed bonus for finishing quickly. Fewer guesses and faster times produce higher scores.',
      'XP is earned from every game: 100 XP for a win, 25 XP for a loss, plus bonuses for win streaks, daily challenges, and medal placements. Every 1,000 XP advances you one level.',
    ],
  },
  {
    heading: 'Free to Play',
    paragraphs: [
      'Wordocious is completely free to play. Every game mode, every daily puzzle, and every leaderboard is accessible without paying. Free players get one attempt per game mode per day.',
      'Wordocious Pro unlocks unlimited daily plays across all game modes and removes advertisements for an ad-free experience.',
    ],
  },
];

// ── Support page (each Q is a heading, A is the paragraph) ───────────────────
export const SUPPORT_SECTIONS: ContentSection[] = [
  { heading: 'How do I play Wordocious?', paragraphs: ['Wordocious is a word puzzle game with multiple modes. In each mode, you guess hidden words by typing guesses and using color-coded feedback to narrow things down. Purple means the letter is correct and in the right spot. Amber means the letter is in the word but in the wrong position. Gray means the letter isn’t in the word at all. Each mode has its own twist — from single-word puzzles to multi-board challenges!'] },
  { heading: 'What are the different game modes?', paragraphs: ['Wordocious offers a variety of modes to keep things fresh. There are daily puzzles that everyone shares, multi-board modes like QuadWord and OctoWord where you solve multiple puzzles at once, timed challenges like Gauntlet, and more. Head to the home page to see all available modes and find your favorite.'] },
  { heading: 'How are daily scores calculated?', paragraphs: ['Your daily score is a composite: a base score of 1,000 points for completing the puzzle, a speed bonus for finishing quickly, and — on multi-board modes — a completion bonus based on how many boards you solved. Hint modes (Six, Seven, ProperNoundle) also award a guess bonus for using fewer guesses. For example, Classic solved in 13 seconds: 1,000 base + 287 speed bonus (300s cap − 13s) = 1,287 points. The fewer guesses and less time you take, the higher your score.'] },
  { heading: 'How do XP and levels work?', paragraphs: ['You earn XP after every game. Winning awards 100 XP and losing awards 25 XP. You can earn bonus XP from win streaks (+50), completing daily challenges (+50), and earning medals (gold +100, silver +50, bronze +25). Your level is based on your total XP — every 1,000 XP advances you one level. Check your progress on your profile page.'] },
  { heading: 'How do streaks work?', paragraphs: ['Your streak counts how many consecutive days you’ve completed a daily puzzle. Play and solve at least one daily puzzle each day to keep your streak alive. If you miss a day, your current streak resets to zero — but your best streak is always saved. Streaks reset at midnight based on your local time.'] },
  { heading: 'What is Wordocious Pro?', paragraphs: ['Pro is an optional subscription that unlocks extra features and game modes. It’s designed for players who want even more from Wordocious. You can subscribe from your profile page, and you can cancel anytime — you’ll keep Pro access through the end of your billing period. Wordocious is completely playable for free, and Pro is just a bonus for those who want it.'] },
  { heading: 'How do I cancel my Pro subscription?', paragraphs: ['You can cancel your Pro subscription at any time from your profile settings. Once cancelled, you’ll continue to have Pro access until the end of your current billing cycle. No questions asked, no hidden fees.'] },
  { heading: 'My stats aren’t showing up. What do I do?', paragraphs: ['Make sure you’re signed in to your account. Game stats are saved to your profile, so if you played while signed out, those results may not be linked to your account. Try refreshing the page or signing out and back in. If the issue persists, reach out to us and we’ll help sort it out.'] },
  { heading: 'I found a bug or have a suggestion!', paragraphs: ['We love hearing from players. Whether it’s a bug report, a feature idea, or just a kind word, feel free to reach out. Your feedback helps make Wordocious better for everyone.'] },
  { heading: 'Contact Support', paragraphs: ['Can’t find what you’re looking for? Send us an email at support@wordocious.com and we’ll get back to you as soon as we can.'] },
];
