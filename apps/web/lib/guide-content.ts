/**
 * Mode guide content — substantive public pages for /guides/[slug].
 * Written as genuinely useful strategy material (not SEO filler): exact
 * rules, the real scoring formulas from daily-service.ts, and mode-specific
 * strategy. These pages are crawlable while gameplay sits behind sign-in.
 */

import { MODES } from './modes.generated';

export interface ModeGuide {
  slug: string;
  title: string;
  accent: string;
  tagline: string;
  metaDescription: string;
  /** Quick-facts box. */
  facts: { label: string; value: string }[];
  /** "How it works" paragraphs. */
  rules: string[];
  /** Scoring explainer paragraphs (real formulas). */
  scoring: string[];
  /** Strategy tips — the meat of the page. */
  tips: { heading: string; body: string }[];
  related: string[];
  /**
   * "The buttons" card (More Games §19, founder round 13): one row per
   * on-screen control — the SAME icon the button carries (lucide name), its
   * label, and in plain words what it does, what it costs, and whether it can
   * count against you. Required for every More Games title.
   */
  controls?: { icon: string; label: string; body: string }[];
}

export const MODE_GUIDES: ModeGuide[] = [
  {
    slug: 'classic',
    title: 'Classic',
    accent: '#7c3aed',
    tagline: '1 word, 6 guesses — the foundation everything else builds on',
    metaDescription:
      'Complete guide to Classic mode in Wordocious: rules, the exact scoring formula, best starting words, and the elimination strategy that wins in fewer guesses.',
    facts: [
      { label: 'Boards', value: '1' },
      { label: 'Guesses', value: '6' },
      { label: 'Word length', value: '5 letters' },
      { label: 'Time bonus cap', value: '5:00' },
    ],
    rules: [
      'New to word games? Here is the whole idea. There is a hidden 5-letter word. You have six tries to find it. Type any real 5-letter word and press enter — then the five tiles change color to tell you how close you were. PURPLE means that letter is correct and in the right spot. AMBER means the letter is in the word but in a different spot. GRAY means the letter is not in the word at all. Use those colors to make a smarter next guess, and keep going until the whole row turns purple.',
      'One handy detail: repeated letters are scored one at a time. If the answer has only one E but your guess has two, only one of your E tiles will color — the extra E shows gray. That gray duplicate is itself a clue: it tells you the letter appears just once.',
    ],
    scoring: [
      'A win is worth a 1,000-point base, and guesses are what separate players: every guess you do not need is worth 300 points, so a three-guess solve banks 900 in guess bonus alone. Speed is the tiebreaker — up to 240 points scaled by how far under the five-minute cap you finish. Because the speed bonus maxes out below the value of a single guess, a faster solve can never outrank a more efficient one. Completing the board adds a flat 200.',
      'A typical strong Classic score lands between 2,100 and 2,400: solve in three or four guesses inside two minutes and you are competitive on the daily leaderboard, where everyone worldwide plays the same word.',
    ],
    tips: [
      {
        heading: 'Open with coverage, not a hunch',
        body: 'Your first guess exists to gather information. Words like SLATE, CRANE, AROSE, or RAISE test five high-frequency letters with no repeats, so every tile teaches you something. Resist opening with a "lucky" word that repeats letters — a duplicate tells you nothing new.',
      },
      {
        heading: 'Gray tiles are half the game',
        body: 'Players fixate on purple and amber, but eliminations shrink the candidate pool fastest. After two guesses you typically know 8–10 letters that are NOT in the word — mentally filter your next guess through that exclusion list before typing it.',
      },
      {
        heading: 'Position-hunt with ambers',
        body: 'An amber letter has at most four remaining legal positions. If you have two ambers, pick a next guess that relocates both at once instead of testing them one at a time. Moving R from slot 2 to slot 4 while moving E from slot 5 to slot 3 resolves two unknowns with one row.',
      },
      {
        heading: 'Know the common endings',
        body: 'Five-letter answers disproportionately end in -ER, -ED, -LY, -AL, and -TY, and start with S, C, B, T, or P. When you are down to your last two guesses, bias toward these patterns rather than exotic letter arrangements.',
      },
      {
        heading: 'Speed comes from not deliberating row one',
        body: 'The leaderboard tiebreaker is time. Memorize one opener and one follow-up (e.g. SLATE then CORNY covers ten distinct letters) and type them without thinking. Save your deliberation budget for rows three onward, where it actually changes outcomes.',
      },
    ],
    related: ['six', 'seven', 'quadword'],
  },
  {
    slug: 'six',
    title: 'Six',
    accent: '#06b6d4',
    tagline: '6-letter words, 7 guesses, and a hint system with real costs',
    metaDescription:
      'Wordocious Six mode guide: solving 6-letter words in 7 guesses, when hints are worth their cost, and the affix strategy longer words reward.',
    facts: [
      { label: 'Boards', value: '1' },
      { label: 'Guesses', value: '7' },
      { label: 'Word length', value: '6 letters' },
      { label: 'Hints', value: 'Vowel + consonant, −75 pts each' },
    ],
    rules: [
      'Guess a hidden 6-letter word in seven tries. Type any real 6-letter word and press enter, and each tile changes color to guide you: PURPLE means the letter is correct and in the right spot, AMBER means it is in the word but a different spot, and GRAY means it is not in the word at all. Read those colors to sharpen your next guess, and keep going until the whole row turns purple.',
      'Six also gives you two optional hints. You can reveal one vowel and one consonant from the answer — each shows up as an extra row with that letter already in its correct spot. Hints add an extra row to your board and each one subtracts 75 points from your score, so only use them when you are truly stuck.',
    ],
    scoring: [
      'Win base 1,000, plus 270 points for every guess you did not need — solve in four of your seven and you bank 810 in guess bonus. Speed adds up to 216 more, scaled by how far under the six-minute cap you finish; it is always worth less than one guess, so efficiency outranks pace. Completion adds a flat 200.',
      'Hints subtract 75 each at the end — but the real cost is the board row a hint occupies, which is a full 270-point guess step. A hint that saves you two rows of flailing still nets positive; one taken out of mild frustration on row two almost never pays for itself.',
    ],
    tips: [
      {
        heading: 'Think in affixes',
        body: 'Six-letter answers are full of -ING, -ED, -ER, -LY, RE-, UN-, and double letters. Once you have two or three placed letters, ask which prefix or suffix frames fit before brute-forcing letter positions. RELOAD, HONEST, BRIGHT — most answers decompose into a familiar chunk plus a stem.',
      },
      {
        heading: 'Spend your opener on vowels',
        body: 'Six-letter words usually carry two or three vowels. An opener like SOIREE or AROUSE maps the vowel skeleton immediately, and the consonant frame falls out from there.',
      },
      {
        heading: 'The consonant hint beats the vowel hint',
        body: 'By mid-game you usually know the vowels from normal play — they are only five letters and appear constantly. The consonant reveal eliminates a much larger candidate space, so if you are taking exactly one hint, take that one.',
      },
      {
        heading: 'Use row seven as a free shot',
        body: 'With seven guesses and a 270-point-per-guess bonus, information plays are expensive — but a coverage row that closes the answer two rows sooner still pays for itself. Burning rows one and two on words that share no letters leaves five full rows to actually close out the answer.',
      },
    ],
    related: ['seven', 'classic', 'propernoundle'],
  },
  {
    slug: 'seven',
    title: 'Seven',
    accent: '#84cc16',
    tagline: '7-letter words and 8 guesses — the long-word endgame',
    metaDescription:
      'Wordocious Seven mode guide: strategy for 7-letter words, the 240-point guess bonus, hint economics, and why structure beats letter frequency at this length.',
    facts: [
      { label: 'Boards', value: '1' },
      { label: 'Guesses', value: '8' },
      { label: 'Word length', value: '7 letters' },
      { label: 'Hints', value: 'Vowel + consonant, −75 pts each' },
    ],
    rules: [
      'Guess a hidden 7-letter word in eight tries — the longest solo word in Wordocious. Type a real word and press enter; each tile changes color to help you: PURPLE means the letter is correct and in the right spot, AMBER means it is in the word but a different spot, and GRAY means it is not in the word. Keep guessing until the row turns all purple.',
      'You also get two optional hints — reveal one vowel and one consonant from the answer. Each appears as an extra row with the letter already in its correct spot, adds an extra row to your board, and subtracts 75 points from your score, so save them for when you are truly stuck.',
    ],
    scoring: [
      'Win base 1,000, a 240-point bonus per unused guess, and up to 192 speed points scaled by how far under the seven-minute cap you finish — always worth less than one guess, so efficiency outranks pace. Completion adds 200. An efficient five-guess solve carries a 720-point guess bonus.',
      'Because the time cap is generous (7:00), Seven rewards methodical play more than raw speed — a careful 3:00 solve in five guesses beats a frantic 1:30 solve in eight.',
    ],
    tips: [
      {
        heading: 'Hunt the suffix first',
        body: 'A huge share of seven-letter answers end in -ING, -TION, -MENT, -ABLE, -ER, or -EST. One mid-game guess engineered to test a suffix hypothesis (e.g. placing -ING) can collapse hundreds of candidates into a handful.',
      },
      {
        heading: 'Two openers, ten letters',
        body: 'With eight rows you can afford a two-word opening that covers ten distinct letters — try AUCTION then FRESHLY style pairings. By row three you will already have tested most of the alphabet, so the back half of the game becomes placing known letters rather than discovering new ones.',
      },
      {
        heading: 'Watch for double letters',
        body: 'Sevens love doubles: LL, SS, EE, TT. If your placed letters leave a two-slot gap that nothing common fits, test a double before assuming a rare consonant.',
      },
      {
        heading: 'Hints late, not early',
        body: 'The candidate space at seven letters narrows naturally with each row, so a hint on row six resolves genuine ambiguity, while a hint on row two duplicates what normal play would have told you anyway. Same 150-point price — vastly different value.',
      },
    ],
    related: ['six', 'classic', 'gauntlet'],
  },
  {
    slug: 'quadword',
    title: 'QuadWord',
    accent: '#ec4899',
    tagline: '4 boards, 9 shared guesses — every word you type hits all four',
    metaDescription:
      'Wordocious QuadWord guide: multi-board strategy, the boards-solved scoring formula, coverage openers, and when to chase a board versus gather information.',
    facts: [
      { label: 'Boards', value: '4' },
      { label: 'Guesses', value: '9 (shared)' },
      { label: 'Time bonus cap', value: '10:00' },
      { label: 'Completion bonus', value: '50 pts per board' },
    ],
    rules: [
      'You are solving four hidden 5-letter words at the same time, with nine guesses total. Each of the four grids is a "board." When you type one word and press enter, that same guess is tried on all four boards at once, and every board colors its own tiles: PURPLE for a correct letter in the right spot, AMBER for a letter that is in that board\'s word but a different spot, and GRAY for a letter not in it. Solve a board and it locks with a checkmark; you keep guessing until all four are solved or you run out of guesses.',
      'Because one guess feeds four boards, your on-screen keyboard shows what you have learned for each board separately — each key is split into four small parts, one per board, colored by what that letter did there. It looks busy at first, but it just lets you see all four boards\' clues at a glance.',
    ],
    scoring: [
      'Win base 1,000 plus 150 points for every unused row of your nine — row efficiency dominates the leaderboard. Speed adds up to 120 more under the ten-minute cap, always worth less than one row. The completion bonus scales: each solved board contributes 50 points (4/4 = 200), and you keep that partial credit even on a loss — solving three of four scores far better than solving one.',
      'Nine guesses for four words means your average solve must take 2.25 rows. The information you extract per row, not your vocabulary, is what decides QuadWord games.',
    ],
    tips: [
      {
        heading: 'Three rows of pure coverage',
        body: 'Open with three preplanned words that share no letters — a classic trio covers 15 distinct letters. After those three rows you will usually see most of every board’s skeleton, and the remaining six guesses become four short endgames.',
      },
      {
        heading: 'Solve the most-known board first',
        body: 'Always attack the board with the most purple tiles. Each solve shrinks the problem: your subsequent guesses stop "wasting" rows on a finished board, and the quadrant keyboard gets visually simpler.',
      },
      {
        heading: 'Mind the shared-row side effects',
        body: 'Every solving guess is also an information guess for the other boards. When two candidate words would both solve board one, pick the one whose letters tell you more about boards two through four — that free information is the entire skill ceiling of this mode.',
      },
      {
        heading: 'Never guess into one board blind',
        body: 'With nine rows there is no budget for a coin-flip guess that only one board cares about. If a board has you stuck between three candidates, leave it and work elsewhere — a later solve elsewhere often disambiguates it for free.',
      },
    ],
    related: ['octoword', 'succession', 'deliverance'],
  },
  {
    slug: 'octoword',
    title: 'OctoWord',
    accent: '#7e22ce',
    tagline: '8 boards, 13 guesses — the marathon of parallel solving',
    metaDescription:
      'Wordocious OctoWord guide: how to manage 8 simultaneous boards in 13 guesses, opener sequencing, the 25-points-per-board formula, and triage strategy.',
    facts: [
      { label: 'Boards', value: '8' },
      { label: 'Guesses', value: '13 (shared)' },
      { label: 'Time bonus cap', value: '15:00' },
      { label: 'Completion bonus', value: '25 pts per board' },
    ],
    rules: [
      'You are solving eight hidden 5-letter words at the same time, with thirteen guesses total. Each grid is a "board." Type one word, press enter, and that guess is tried on all eight boards at once — each board colors its own tiles: PURPLE for a correct letter in the right spot, AMBER for a letter in that board\'s word but a different spot, and GRAY for a letter not in it. Each board locks with a checkmark once you solve it, and stops using up your guesses. Clear all eight before you run out.',
      'Since one guess feeds eight boards, your keyboard shows what you have learned for each board separately (each key is split into eight small parts). With only thirteen guesses for eight words, your first few guesses matter a lot — use them to test many common letters before you start locking in answers.',
    ],
    scoring: [
      'Win base 1,000, 90 points per unused row of your thirteen, up to 72 speed points under the fifteen-minute cap (a tiebreaker — never worth a full row), and 25 points per solved board (8/8 = 200, partial credit on losses). Guess count is measured as total rows used, not per-board — every row you save is worth more than any amount of speed.',
      'Because the time cap is long, OctoWord actually pays deliberation. A patient 9-minute clear outscores a sloppy 6-minute loss with six boards solved by hundreds of points.',
    ],
    tips: [
      {
        heading: 'Four openers, twenty letters',
        body: 'Commit rows one through four to a fixed coverage suite (no shared letters across the four words). Twenty distinct letters tested means nearly every board shows multiple colored tiles before you attempt a single solve.',
      },
      {
        heading: 'Triage ruthlessly',
        body: 'After the opening, sort boards into "known" (solve now), "one letter away" (solve next), and "fog" (ignore). Spend zero rows on fog boards — they clarify themselves as side effects of solving the others.',
      },
      {
        heading: 'Count your budget out loud',
        body: 'At any point, compare rows remaining to unsolved boards. Nine rows for six boards is comfortable; five rows for five boards means every single guess must solve a board — switch from information mode to commitment mode the moment the ratio hits 1:1.',
      },
      {
        heading: 'Beware the early lucky solve',
        body: 'Solving a board on row two feels great but skips its information harvest. If your "solve" word teaches the other seven boards nothing, the cheap win can cost you the run. Prefer solving words rich in untested letters.',
      },
    ],
    related: ['quadword', 'gauntlet', 'succession'],
  },
  {
    slug: 'succession',
    title: 'Succession',
    accent: '#2563eb',
    tagline: '4 boards solved strictly in order — guesses carry forward',
    metaDescription:
      'Wordocious Succession guide: the sequential 4-board mode where every guess carries to later boards. Banking strategy, the 10-guess budget, and order-aware play.',
    facts: [
      { label: 'Boards', value: '4 (in order)' },
      { label: 'Guesses', value: '10 (shared)' },
      { label: 'Time bonus cap', value: '8:00' },
      { label: 'Completion bonus', value: '50 pts per board' },
    ],
    rules: [
      'You solve four hidden 5-letter words one at a time, in order, with ten guesses shared across all four. You only work on one board at a time; the next boards stay hidden until you reach them. As always, tiles color PURPLE for a correct letter in the right spot, AMBER for a letter in the word but a different spot, and GRAY for a letter not in it.',
      'Here is the twist that makes Succession special: when you finish one word and move to the next, that next board already has all of your earlier guesses filled in for you. So the guesses you "spent" on board one keep working on boards two, three, and four. The keyboard colors only follow the board you are currently on, even though your guess history carries forward the whole way.',
    ],
    scoring: [
      'Win base 1,000, 180 points per unused row of your ten, up to 144 speed points under the eight-minute cap (a tiebreaker — never worth a full row), and 50 points per solved board. The recorded guess count is the total rows the run consumed — board one solved in row six and board four solved in row ten records as a ten-guess game.',
      'Losses keep partial completion credit, so pushing deep into the chain always beats stalling on an early board.',
    ],
    tips: [
      {
        heading: 'Your early rows echo forward',
        body: 'Because boards two through four inherit every prior guess, broad coverage words early in the run pay four times. A wasted narrow guess on board one is also a wasted row on the three boards that haven’t appeared yet.',
      },
      {
        heading: 'Bank guesses on board one',
        body: 'The budget math: ten rows, four boards. If board one eats five rows you are nearly drawing dead. Treat the first board as a speed round — coverage opener, second opener, solve. Three rows for board one is the pace that wins.',
      },
      {
        heading: 'Read the inherited rows on unlock',
        body: 'When a new board unlocks, its grid already shows colored feedback from all your previous guesses. Pause and actually read it before typing — players in a rhythm often re-guess letters the inherited rows already marked dead.',
      },
      {
        heading: 'Save flexible vocabulary for the back half',
        body: 'By board four, your usable letters are constrained by everything you have played. Avoid burning all the common-letter words early; keep one or two versatile candidates (mixed vowels, no repeats) in reserve for the final board’s endgame.',
      },
    ],
    related: ['quadword', 'deliverance', 'octoword'],
  },
  {
    slug: 'deliverance',
    title: 'Deliverance',
    accent: '#059669',
    tagline: '4 boards already in trouble — finish what the prefills started',
    metaDescription:
      'Wordocious Deliverance guide: the rescue mode where 3 rows are prefilled on every board. Reading inherited clues, the 6-guess budget, and deduction-first play.',
    facts: [
      { label: 'Boards', value: '4' },
      { label: 'Guesses', value: '6 (shared)' },
      { label: 'Prefilled rows', value: '3 per board' },
      { label: 'Time bonus cap', value: '8:00' },
    ],
    rules: [
      'Deliverance gives you a head start — and a challenge. There are four hidden 5-letter words, and each of the four boards opens with three guesses already played and colored for you (PURPLE = right letter, right spot; AMBER = in the word, wrong spot; GRAY = not in the word). Your job is to read those free clues and finish all four boards using only six guesses of your own. Each guess you type is tried on all four boards at once, so a single word gives you fresh feedback everywhere.',
      'Everyone gets the exact same starting position each day, so the daily leaderboard comes down to who reads the clues best. Your keyboard is already colored from those three opening guesses the moment the puzzle loads, so start by studying it before you type.',
    ],
    scoring: [
      'Win base 1,000, 240 points per unused guess of your six, up to 192 speed points under the eight-minute cap (a tiebreaker — never worth a full guess), and 50 points per solved board. The recorded guess count covers only YOUR guesses — the three prefilled rows are free.',
      'Six own-guesses for four boards is the tightest budget of any multi-board mode. The compensation: you start with a mountain of information already on the table.',
    ],
    tips: [
      {
        heading: 'Spend a full minute reading before typing',
        body: 'Three evaluated rows per board is twelve rows of intelligence. Work each board like a logic grid first: list confirmed positions, floating ambers, and dead letters. Many boards are already solvable on paper before your first guess — find those.',
      },
      {
        heading: 'Your first guess should solve, not probe',
        body: 'There is no budget here for throwaway coverage openers — the three prefilled rows already WERE your coverage. If no board is solvable outright, pick a word that simultaneously solves your best board candidate AND tests floating amber letters on the others.',
      },
      {
        heading: 'Trust the process of elimination on slots',
        body: 'Prefills frequently leave a board with one unknown slot and two candidate letters. Resolve those cheap boards immediately — each solve narrows the shared letter pool for the genuinely hard board that every Deliverance seems to include.',
      },
      {
        heading: 'The hard board is the schedule',
        body: 'Identify the board with the least prefill information and budget backwards from it. If it will clearly need three of your six rows, the other three boards must share the remaining three — which tells you exactly how aggressive to be early.',
      },
    ],
    related: ['quadword', 'succession', 'classic'],
  },
  {
    slug: 'gauntlet',
    title: 'Gauntlet',
    accent: '#d97706',
    tagline: '5 escalating stages, 21 boards, one run — the endurance test',
    metaDescription:
      'Wordocious Gauntlet guide: surviving all 5 stages and 21 boards, the run-cumulative scoring, stage-by-stage budgeting, and why early efficiency compounds.',
    facts: [
      { label: 'Stages', value: '5 (escalating)' },
      { label: 'Total boards', value: '21' },
      { label: 'Time bonus cap', value: '30:00' },
      { label: 'Fail condition', value: 'Bust any stage, lose the run' },
    ],
    rules: [
      'The Gauntlet is a five-stage marathon that gets harder as you go — 21 hidden words in total, all in one continuous run. Stage 1 is a single word on one board; later stages ask you to solve several words at the same time, up to eight boards at once in the finale. Each stage gives you a set number of guesses. Solve every word in a stage to advance; if you run out of guesses on any stage, the whole run ends right there. Tiles color to guide you: PURPLE for a right letter in the right spot, AMBER for a right letter in the wrong spot, GRAY for a letter that is not in the word.',
      'Between stages you get a quick recap of what you cleared and what is coming next. Your guesses, time, and score add up across all five stages — the Gauntlet is scored as one long game, not five short ones — so pace yourself.',
    ],
    scoring: [
      'Win base 1,000, 60 points per unused row of your forty-four across the whole run, up to 48 speed points under the thirty-minute cap (a tiebreaker — never worth a full row), and completion credit proportional to boards cleared: each of the 21 boards is worth about 9.5 points of the 200-point completion pool, and partial runs keep partial credit.',
      'The recorded guess count is the sum across every stage, which is why an efficient early stage matters: a three-guess stage one and a five-guess stage one look identical on your screen at the time, but they are 2 guesses apart on the leaderboard forever.',
    ],
    tips: [
      {
        heading: 'The early stages are where runs are won',
        body: 'Late stages have enough boards that scores converge — everyone grinds them. The separation happens on the small early stages, where solving in three instead of five is realistic. Treat stage one like a speedrun.',
      },
      {
        heading: 'Reset your opener every stage',
        body: 'Each stage has fresh words, so your coverage resets too. Don’t improvise: walk in with two or three preplanned opener words that share no letters between them, and reuse that same set at the start of every multi-board stage.',
      },
      {
        heading: 'Protect the run, not the score',
        body: 'When a stage gets dicey — two rows left, two boards open — switch to pure survival. A slow, ugly stage clear keeps 100% of your future scoring alive; a bust forfeits every stage you would have cleared after it.',
      },
      {
        heading: 'Pace for thirty minutes',
        body: 'The time cap covers the entire run, but speed is only a tiebreaker now — rows are the currency. Take the time you need to solve efficiently; a deliberate run that saves three rows beats a rushed one that finishes ten minutes faster, every time.',
      },
    ],
    related: ['octoword', 'quadword', 'seven'],
  },
  {
    slug: 'propernoundle',
    title: 'ProperNoundle',
    accent: '#dc2626',
    tagline: 'Famous names, places, and titles — the proper-noun puzzle',
    metaDescription:
      'Wordocious ProperNoundle guide: guessing proper nouns with category clues, the 3-hint system (Wikipedia clue, vowel, consonant), and name-shaped strategy.',
    facts: [
      { label: 'Boards', value: '1' },
      { label: 'Guesses', value: '6' },
      { label: 'Answers', value: 'Proper nouns (can be multi-word)' },
      { label: 'Hints', value: 'Clue / vowel / consonant, −60 pts each' },
    ],
    rules: [
      'Instead of an everyday word, the answer here is a famous name — a person, place, brand, character, or title (these are called proper nouns). A label at the top tells you which kind you are guessing. You have six tries. Type a guess of the right length, press enter, and the tiles color to guide you: PURPLE for a letter that is correct and in the right spot, AMBER for a letter in the name but a different spot, GRAY for a letter that is not in it. Two things set this apart from a normal word puzzle: the answer can be more than one word (a "first last" name shows a gap), and your guesses do NOT have to be real dictionary words — any sequence of letters of the right length is allowed, since you are spelling a name.',
      'Stuck? Three optional hints are available, each costing 60 points: a short clue sentence about the answer (drawn from Wikipedia), a revealed vowel, and a revealed consonant. Each hint shows up as an extra row on the board, so use them sparingly.',
    ],
    scoring: [
      'Win base 1,000, a 300-point bonus per unused guess — tied for the richest guess bonus in the game, because names can be genuinely hard — up to 240 speed points under the five-minute cap (a tiebreaker — never worth a full guess), plus 200 completion.',
      'Hints subtract 60 each, but each one also occupies a board row worth a full 300-point guess step, so the real cost is steeper than the sticker price. Taking all three still frequently converts a loss into a win — and a hinted win above 1,000 points beats a hintless loss at a few hundred.',
    ],
    tips: [
      {
        heading: 'The category is your first guess',
        body: 'Before typing anything, mine the category pill. "Athlete" plus a 6-letter answer with a gap pattern of 2+4 has shockingly few famous candidates. Brainstorm names that FIT THE SHAPE before worrying about letters.',
      },
      {
        heading: 'Vowel-heavy probe names',
        body: 'Since guesses don’t need to be real words, you can engineer probes. But famous-name letter distributions differ from dictionary words — A and N are everywhere in names. A first guess built from A, E, N, R, S earns more than a standard opener.',
      },
      {
        heading: 'Take the clue early, not late',
        body: 'Unique among hints: the Wikipedia clue costs a board row, so its value decays as rows run out. Taken at row two, it converts the puzzle from "guess any name" to "guess THIS person" with four rows to spare. Taken at row five, it leaves no room to use the knowledge.',
      },
      {
        heading: 'Multi-word answers: solve the short word first',
        body: 'In a "3 + 5" name, the three-letter word has very few possibilities (BOB, JAY, KIM, LEE, MAX, SAM…). Lock it, and the long word usually falls out of pop-culture memory rather than letter logic.',
      },
    ],
    related: ['classic', 'six', 'seven'],
  },
  // ── More Games (§4) ──────────────────────────────────────────────────────
  {
    slug: 'sudoku',
    title: 'Sudoku',
    accent: '#1e40af',
    tagline: 'One Medium puzzle a day, three mistakes, pencil notes — the classic number grid, the Wordocious way',
    metaDescription:
      'Wordocious Sudoku guide: the daily Medium puzzle, the three-mistake rule, how Notes and Hints work, the exact scoring formula, and the scanning strategy that solves without guessing.',
    facts: [
      { label: 'Board', value: '9 × 9, one puzzle a day' },
      { label: 'Daily difficulty', value: 'Medium (Pro Unlimited: Easy · Medium · Hard)' },
      { label: 'Mistakes allowed', value: '2 — the third ends the game' },
      { label: 'Time bonus cap', value: '30:00' },
      { label: 'Daily Sweep', value: 'Not counted — More Games are extra' },
    ],
    rules: [
      'Fill the grid so every row, every column and every 3 × 3 box contains the digits 1 to 9 exactly once. The puzzle starts with about a third of the cells filled in (the givens, in dark ink); those never change. Tap an empty cell, then tap a number on the pad. A correct digit turns purple and stays. A wrong digit turns red and counts as a mistake — you can erase it or overwrite it, but the mistake stands. Make three mistakes and the puzzle is over.',
      'Every puzzle has exactly one solution and is generated on your device from the day\'s seed, so everyone plays the same grid and nobody has to download anything. The daily is always Medium: solvable with careful scanning and a little pencil work, never guessing. Pro Unlimited lets you pick Easy (solvable by singles alone), Medium or Hard (you will need pencil marks).',
      'Notes are for thinking, not answering. Turn Notes on and tapping a number pencils that small candidate into the corner grid of the selected cell instead of placing it; tap again to remove it. Pencil marks are never judged and never count as mistakes. When you place a correct digit, that digit is cleared from the pencil marks in its row, column and box automatically. Undo steps back through placements and notes alike; it never refunds a mistake or a hint.',
      'The daily is the same for everyone and counts once on the leaderboard. Sudoku lives under More Games, so it never affects your Daily Sweep, Flawless Victory or the sweep celebration — those stay the eight word games.',
    ],
    scoring: [
      'A solve is worth a 1,000-point base plus a flat 200 for finishing. Mistakes are what separate players: the game treats your finish as mistakes + 1 out of a budget of 4, and every unused step is worth 300 points, so a clean solve banks 900 in mistake bonus, one mistake 600, two mistakes 300. Speed is the tiebreaker: up to 240 points scaled by how far under the 30-minute cap you finish, which can never outweigh a single mistake — a cleaner solve always outranks a faster one.',
      'Each Hint costs 100 points and fills the selected cell (or the first empty one) with the right digit. Hints never count as mistakes, but a solve with any hint is not a Perfect run and does not count toward the Pure Sudoku achievements. A lost puzzle still earns credit for the time spent and the cells you filled correctly, so it is always worth playing on.',
    ],
    controls: [
      { icon: 'undo-2', label: 'Undo', body: 'Steps back one action — a placement, an erase or a pencil mark. Free, unlimited, and it never gives a mistake or a hint back.' },
      { icon: 'eraser', label: 'Erase', body: 'Clears the selected cell: the digit you placed and any pencil marks. Givens cannot be erased. Free.' },
      { icon: 'pencil', label: 'Notes', body: 'A toggle. While it is filled in, the number pad writes small candidate marks into the selected cell instead of answers. Marks are never judged and never cost anything.' },
      { icon: 'lightbulb', label: 'Hint', body: 'Fills the selected cell (or the first empty one) with the correct digit. Costs 100 points of score, never a mistake, and rules out a Perfect run.' },
    ],
    tips: [
      {
        heading: 'Scan by box before you scan by cell',
        body: 'For each digit 1–9, look at where it already sits and cross-hatch the rows and columns it occupies. Any 3 × 3 box with only one open cell for that digit is a free placement. Working digit-by-digit is far faster than staring at one empty cell wondering what goes there.',
      },
      {
        heading: 'Hunt the row or column with the fewest gaps',
        body: 'A row with seven digits filled has two candidates for two cells. Check which of the two is blocked by a column or box and the other falls into place. Rows and columns near completion are the cheapest points on the board.',
      },
      {
        heading: 'Pencil marks only where they earn their keep',
        body: 'You do not need candidates in every cell. When a cell is down to two possibilities, mark both; when a digit has two possible homes in a box, mark both. A pair like that is exactly what the next placement will resolve — and the auto-clear will do the bookkeeping for you.',
      },
      {
        heading: 'Never place a digit you cannot justify',
        body: 'Three mistakes end the game and each one costs 300 points. If two digits both seem possible, that is a Notes moment, not a placement. The daily is built to be solved with logic alone, so a guess is never required — it is only ever a shortcut with a price.',
      },
      {
        heading: 'Use the highlight',
        body: 'Tapping a filled cell lights every copy of that digit on the board. With eight of a digit placed, the ninth is usually obvious; with six, the highlight shows exactly which boxes still owe one. The selected row, column and box are tinted for the same reason.',
      },
    ],
    related: ['classic', 'gauntlet', 'quadword'],
  },
  // ── More Games (§18b) — Starsweep. Always one word; it does NOT count
  // toward the Daily Sweep and the copy never calls it "the sweep".
  {
    slug: 'starsweep',
    title: 'Starsweep',
    accent: '#ca8a04',
    tagline: 'One star in every row, column and colour region, none touching — a pure logic puzzle you can finish without a single guess',
    metaDescription:
      'Wordocious Starsweep guide: the one-star rule, why stars can never touch, how crossing out and Auto-cross work, the exact scoring formula, and the region-counting strategy that solves every board by logic.',
    facts: [
      { label: 'Board', value: '7 × 7 Monday–Wednesday, 8 × 8 Thursday–Sunday' },
      { label: 'Pro Unlimited', value: '7 × 7 · 8 × 8 · 9 × 9' },
      { label: 'Mistakes allowed', value: '2 — the third ends the game' },
      { label: 'Time bonus cap', value: '10:00' },
      { label: 'Daily Sweep', value: 'Not counted — More Games are extra' },
    ],
    rules: [
      'The board is split into colour regions, one for every row. Place exactly one star in every row, every column and every region. Stars can never touch, not even at a corner, so once a star is down all eight cells around it are out. Every board has exactly one solution and is built on your device from the day\'s seed, so everyone plays the same board.',
      'Tap an empty cell once to cross it out (a small ×: "no star here"), tap again to place a star, tap a third time to clear it. A star in the right cell stays; a star in a wrong cell turns red and counts as a mistake — you can clear it, but the mistake stands. Three mistakes end the game. Crosses are notes for your own reasoning: they are never judged and never cost anything.',
      'Auto-cross is on by default: when you place a correct star, every cell it rules out — its row, its column, its region and the eight neighbours — is crossed out for you. Switch it off if you prefer to keep your own marks. Undo steps back through stars and crosses alike; it never refunds a mistake or a hint.',
      'The daily is the same for everyone and counts once on the leaderboard. Starsweep lives under More Games, so it never affects your Daily Sweep, Flawless Victory or the sweep celebration — those stay the eight word games.',
    ],
    scoring: [
      'A clear is worth a 1,000-point base plus a flat 200 for finishing. Mistakes are what separate players: the game treats your finish as mistakes + 1 out of a budget of 4, and every unused step is worth 300 points, so a clean board banks 900 in mistake bonus, one mistake 600, two mistakes 300. Speed is the tiebreaker: up to 240 points scaled by how far under the 10-minute cap you finish, which can never outweigh a single mistake — a cleaner board always outranks a faster one.',
      'Each Hint costs 100 points and places the star for the row of the cell you last tapped (or the first row still missing its star). Hints never count as mistakes, but a board cleared with any hint is not a Perfect run and does not count toward the Pure Starsweep achievements. A lost board still earns credit for the time spent, so it is always worth playing on.',
    ],
    controls: [
      { icon: 'undo-2', label: 'Undo', body: 'Steps back one action — a star, a cross or a clear. Free, unlimited, and it never gives a mistake or a hint back.' },
      { icon: 'eraser', label: 'Erase', body: 'Clears the cell you last tapped, whether it holds a cross or a star. Stars placed by a Hint cannot be erased. Free.' },
      { icon: 'x', label: 'Auto-cross', body: 'A toggle. While it is filled in, placing a correct star crosses out every cell it rules out for you. Purely a convenience; it never costs anything.' },
      { icon: 'lightbulb', label: 'Hint', body: 'Places the correct star for the row of the cell you last tapped, or the first row still missing one. Costs 100 points of score, never a mistake, and rules out a Perfect run.' },
    ],
    tips: [
      {
        heading: 'Start with the smallest region',
        body: 'A region of two or three cells has almost no room. Its star is one of those cells, so every cell that touches ALL of them can be crossed out immediately — and the row or column the region sits in is usually settled a move later.',
      },
      {
        heading: 'Count regions against rows',
        body: 'If two regions fit entirely inside two rows, those two rows\' stars must be in those regions, so every other cell in those rows is out. The same works for columns. This counting argument breaks open the middle of almost every 8 × 8 board.',
      },
      {
        heading: 'Cross before you star',
        body: 'The game is won by elimination, not inspiration. Mark the cells a star cannot go in, and the cell it must go in reveals itself. When a row is down to one uncrossed cell, that is your star — and it costs nothing to have been thorough.',
      },
      {
        heading: 'A tall region that spans one column owns it',
        body: 'When a region lives in a single column, its star takes that column, so no other region may place a star there. Cross the whole column outside the region and watch neighbouring regions collapse.',
      },
      {
        heading: 'Never place a star you cannot prove',
        body: 'Three mistakes end the game and each one costs 300 points. If two cells both seem possible, keep reasoning — the board is built to be solved by logic alone, so a guess is never required, only ever a shortcut with a price.',
      },
    ],
    related: ['sudoku', 'classic', 'gauntlet'],
  },
  // ── More Games (§15) — Letter Ladder ─────────────────────────────────────
  {
    slug: 'letter-ladder',
    title: 'Letter Ladder',
    accent: '#0284c7',
    tagline: 'Change one letter at a time from the start word to the end word — in as few moves as par',
    metaDescription:
      'Wordocious Letter Ladder guide: the one-letter rule, what par means, why rejected words are free, how Undo and Hint work, the exact scoring formula, and the strategy that finds the shortest route.',
    facts: [
      { label: 'Words', value: '5 letters, one rung at a time' },
      { label: 'Par', value: '4 on Monday–Tuesday, rising to 7 on Sunday' },
      { label: 'Moves allowed', value: 'Par + 5 — run out and the ladder is lost' },
      { label: 'Time bonus cap', value: '10:00' },
      { label: 'Daily Sweep', value: 'Not counted — More Games are extra' },
    ],
    rules: [
      'You start on one five-letter word and must reach another. Every rung is a real word that differs from the rung below it by exactly one letter, in one position: STONE to STORE, STORE to STARE. Type a word and press Enter; if it is accepted it joins the ladder and the next rung starts from it.',
      'Three things get a word turned away, and none of them costs you anything: it is not in the word list, it changes more than one letter (or none), or it is already on your ladder. Every ACCEPTED word is a move. Par is the shortest possible route through common words — the puzzle is built so that no obscure word can beat it — and you have par plus five moves before the ladder is lost.',
      'Undo takes the last rung off so you can try a different route. It is free, but the move you spent stays spent, so a wrong turn still costs you. Hint places the next word on a shortest route from where you stand; it counts as a move and never as a mistake. On a loss the board shows one shortest route so you can see how it was done.',
      'The daily is the same for everyone and counts once on the leaderboard. Letter Ladder lives under More Games, so it never affects your Daily Sweep, Flawless Victory or the sweep celebration — those stay the eight word games.',
    ],
    scoring: [
      'A climb is worth a 1,000-point base plus a flat 200 for finishing. Moves over par are what separate players: the game treats your finish as (moves − par + 1) out of a budget of 6, and every unused step is worth 300 points, so a climb exactly on par banks 1,500 in par bonus, one over par 1,200, two over 900. Speed is the tiebreaker: up to 240 points scaled by how far under the 10-minute cap you finish, which can never outweigh a single extra move — a shorter climb always outranks a faster one.',
      'Each Hint costs 100 points and counts as a move. Hints never lose you the ladder, but a climb with any hint is not a Perfect run and does not count toward the Pure Ladder achievements. A lost ladder still earns credit for the time spent, so it is always worth playing on.',
    ],
    controls: [
      { icon: 'undo-2', label: 'Undo', body: 'Takes the last rung off the ladder so you can go another way. Free — but the move you already spent stays spent.' },
      { icon: 'lightbulb', label: 'Hint', body: 'Places the next word on a shortest route from your current rung. Costs 100 points of score and one move, never a mistake, and rules out a Perfect run.' },
      { icon: 'corner-down-left', label: 'Enter', body: 'Submits the word you typed. If it is turned away (not a word, more than one letter changed, already used) nothing is spent.' },
      { icon: 'delete', label: 'Delete', body: 'Removes the last letter you typed on the current rung. Free.' },
    ],
    tips: [
      {
        heading: 'Count the letters that must change',
        body: 'Compare START and END position by position. If three letters differ, par is at least three and every move should change one of them unless it has to make a detour. A move that changes a letter already matching END is a step backwards.',
      },
      {
        heading: 'Look for the pivot vowel',
        body: 'Most ladders turn on a vowel swap in the middle: STONE to STANE is not a word, but STONE to STORE to STARE is. When a direct change is blocked, change a consonant first to open up the vowel you need.',
      },
      {
        heading: 'Work from both ends',
        body: 'It is often easier to see which words are one step away from END than to push forward blindly. Find END\'s neighbours in your head, then aim your ladder at one of them.',
      },
      {
        heading: 'Rejections are free — use them',
        body: 'Typing a word that turns out not to be in the list costs nothing, so test a promising rung rather than agonising. Only accepted words spend moves.',
      },
      {
        heading: 'Undo before you dig deeper',
        body: 'If a rung leads somewhere with no good next step, Undo now. The move is spent either way, but two more rungs down a dead end are two more moves you cannot get back.',
      },
    ],
    related: ['classic', 'succession', 'six'],
  },
  // ── More Games (§17) — Spyglass ──────────────────────────────────────────
  {
    slug: 'spyglass',
    title: 'Spyglass',
    accent: '#4d7c0f',
    tagline: 'Ten themed words hidden in a 10 × 10 grid — find them all, race the clock, spot them clean',
    metaDescription:
      'Wordocious Spyglass guide: how the daily word search works, why nothing reads backwards, what counts as a miss, how Hint and Reveal work, the exact scoring formula, and the scanning strategy that clears a grid fast.',
    facts: [
      { label: 'Grid', value: '10 × 10, ten words, one theme a day' },
      { label: 'Directions', value: 'Across, down and diagonal — always forwards, never backwards' },
      { label: 'Misses', value: 'Straight lines of 4+ letters that spell no listed word' },
      { label: 'Time bonus cap', value: '15:00' },
      { label: 'Daily Sweep', value: 'Not counted — More Games are extra' },
    ],
    rules: [
      'Every grid has a theme (the title above the board) and a list of ten words to find. The words run across, down, or diagonally, and in the daily they always read forwards — left to right, top to bottom, or up the diagonal — so nothing is hidden backwards. Themes rotate through fifteen families, a theme never returns within four months, and no word repeats within six weeks.',
      'To pick a word, tap its first letter and then its last letter, or press and drag across it. When the letters you covered spell a listed word (in either direction), it is marked found and struck through in the list. A short or crooked drag costs nothing. A straight line of four or more letters that is not on the list is a miss — misses count against your score but never end the game.',
      'Hint pulses the first letter of the next word you have not found. It costs score, never a miss. After five minutes a Reveal button appears; using it ends the grid as a loss and shows where the missing words were, with credit for everything you found. Find all ten and the grid is cleared.',
      'The daily is the same for everyone and counts once on the leaderboard. Spyglass lives under More Games, so it never affects your Daily Sweep, Flawless Victory or the sweep celebration — those stay the eight word games.',
    ],
    scoring: [
      'A clear is worth a 1,000-point base plus a flat 200 for finishing. Misses are what separate players: the game treats your finish as 10 + misses out of a budget of 15, and every unused step is worth 120 points, so a clean clear banks 600 in miss bonus, one miss 480, two misses 360. Speed is the tiebreaker: up to 96 points scaled by how far under the 15-minute cap you finish, so a clean clear ranks purely by time and a cleaner clear always outranks a faster one.',
      'Each Hint costs 60 points and never counts as a miss. A clear with any hint is not a Perfect run and does not count toward the Pure Spyglass achievements. A revealed grid still earns credit for every word you found (ten word-boards, each worth its share), so it is always worth finding one more.',
    ],
    controls: [
      { icon: 'lightbulb', label: 'Hint', body: 'Pulses the first letter of the next word you have not found. Costs 60 points of score, never a miss, and rules out a Perfect run.' },
      { icon: 'eye', label: 'Reveal', body: 'Available after five minutes. Ends the grid as a loss, shows the missing words, and keeps credit for everything you found.' },
    ],
    tips: [
      {
        heading: 'Scan for the rare letter',
        body: 'Pick the word with the least common letter — a Q, Z, X, K or J — and sweep the grid for that letter alone. There are usually only two or three, and one of them starts or ends your word.',
      },
      {
        heading: 'Read forwards only',
        body: 'The daily never hides a word backwards, so once you spot a first letter you only need to look right, down, down-right and up-right. That halves the search compared with an ordinary word search.',
      },
      {
        heading: 'Long words first',
        body: 'An eight- or nine-letter word has very few places it can fit, and finding it often runs through the middle of shorter words, giving you letters for free.',
      },
      {
        heading: 'Pairs beat single letters',
        body: 'Look for the first TWO letters together rather than one. A "TH" or "SP" pair stands out far more than a lone T, and it points you in the word\'s direction at the same time.',
      },
      {
        heading: 'Do not guess long lines',
        body: 'Only straight drags of four or more letters can miss. If you are not sure, tap the first letter and check the list before committing the second tap — looking is free, guessing is not.',
      },
    ],
    related: ['classic', 'letter-ladder', 'deliverance'],
  },
];

export function getGuide(slug: string): ModeGuide | undefined {
  return MODE_GUIDES.find((g) => g.slug === slug);
}

/**
 * The guides the PUBLIC surfaces list (/guides, /guides/[slug], sitemap,
 * mode landings, /api/guides): a mode's guide is public once its catalog
 * record is compiled in AND no longer remote-gated (More Games §19: nothing
 * leaks a game before the founder releases it). The in-game "?" sheet uses
 * getGuide() and sees every guide, gated or not.
 */
export const PUBLIC_MODE_GUIDES: ModeGuide[] = MODE_GUIDES.filter((g) => {
  const mode = MODES.find((m) => m.guideSlug === g.slug);
  return !mode || (mode.enabled && !mode.flagKey);
});

export function getPublicGuide(slug: string): ModeGuide | undefined {
  return PUBLIC_MODE_GUIDES.find((g) => g.slug === slug);
}
