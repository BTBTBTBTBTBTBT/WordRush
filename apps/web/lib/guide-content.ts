/**
 * Mode guide content — substantive public pages for /guides/[slug].
 * Written as genuinely useful strategy material (not SEO filler): exact
 * rules, the real scoring formulas from daily-service.ts, and mode-specific
 * strategy. These pages are crawlable while gameplay sits behind sign-in.
 */

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
      'Guess the hidden five-letter word in six tries. Every guess must be a real word — random letter dumps are rejected. After each submission the tiles flip: purple means the letter is in the word and in the right position, amber means it is in the word but somewhere else, and gray means it is not in the word at all.',
      'Repeated letters are judged individually. If you guess a word with two of the same letter and the answer only contains one, exactly one tile colors and the duplicate shows gray — that gray duplicate is a clue in itself, telling you the letter appears only once.',
    ],
    scoring: [
      'A win is worth a 1,000-point base. You then earn one point for every second left under the five-minute cap — solve in 1:30 and the time bonus is 210. Completing the board adds a flat 200. There is no separate guess bonus in Classic; fewer guesses pay off indirectly because they make you faster.',
      'A typical strong Classic score lands between 1,350 and 1,450: solve in three or four guesses inside two minutes and you are competitive on the daily leaderboard, where everyone worldwide plays the same word.',
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
      'Wordocious Six mode guide: how 6-letter solving differs from Classic, when the 150-point hints are worth it, and the affix strategy longer words reward.',
    facts: [
      { label: 'Boards', value: '1' },
      { label: 'Guesses', value: '7' },
      { label: 'Word length', value: '6 letters' },
      { label: 'Hints', value: 'Vowel + consonant, −150 pts each' },
    ],
    rules: [
      'Same color feedback as Classic, but the answers are six letters long and you get seven guesses. The sixth letter changes the texture of the puzzle more than you would expect: there are more candidate words, but they are also more structured — prefixes, suffixes, and double letters appear far more often.',
      'Six introduces hints. You can reveal one vowel and one consonant from the answer; each reveal appears as its own row on the board showing the letter in its correct position, and each costs 150 points from your final score. A hint row also consumes nothing from your seven guesses — the price is purely in points.',
    ],
    scoring: [
      'Win base 1,000, plus one point per second under the six-minute cap, plus 200 for completion. Six also pays a guess bonus that Classic does not: 90 points for every unused guess. Solve in four and you bank 270 on top of everything else.',
      'Hints subtract 150 each at the end. The math matters: a hint that saves you two full guesses usually nets positive (180 guess bonus plus faster time vs. 150 cost), while a hint taken out of mild frustration on row two almost never pays for itself.',
    ],
    tips: [
      {
        heading: 'Think in affixes',
        body: 'Six-letter answers are full of -ING, -ED, -ER, -LY, RE-, UN-, and double letters. Once you have two or three placed letters, ask which prefix or suffix frames fit before brute-forcing letter positions. PLACED, HONEST, BRIGHT — most answers decompose into a familiar chunk plus a stem.',
      },
      {
        heading: 'Spend your opener on vowels',
        body: 'Six-letter words usually carry two or three vowels. An opener like SOIREE or AUDITS maps the vowel skeleton immediately, and the consonant frame falls out from there.',
      },
      {
        heading: 'The consonant hint beats the vowel hint',
        body: 'By mid-game you usually know the vowels from normal play — they are only five letters and appear constantly. The consonant reveal eliminates a much larger candidate space, so if you are taking exactly one hint, take that one.',
      },
      {
        heading: 'Use row seven as a free shot',
        body: 'With seven guesses and a 90-point-per-guess bonus, rows one and two can be pure information plays. Burning both on coverage words still leaves five solving rows — a luxury Classic never gives you.',
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
      'Wordocious Seven mode guide: strategy for 7-letter words, the 80-point guess bonus, hint economics, and why structure beats letter frequency at this length.',
    facts: [
      { label: 'Boards', value: '1' },
      { label: 'Guesses', value: '8' },
      { label: 'Word length', value: '7 letters' },
      { label: 'Hints', value: 'Vowel + consonant, −150 pts each' },
    ],
    rules: [
      'The longest solo word in Wordocious: a seven-letter answer with eight guesses to find it. Color feedback works exactly like Classic, and the same vowel/consonant hint system from Six is available at 150 points per reveal.',
      'At seven letters, almost every answer is built from recognizable parts — a root word wearing a prefix or suffix. The puzzle is less "which letters?" and more "which construction?"',
    ],
    scoring: [
      'Win base 1,000, one point per second under the seven-minute cap, 200 completion, and an 80-point bonus per unused guess. An efficient five-guess solve carries a 240-point guess bonus.',
      'Because the time cap is generous (7:00), Seven rewards methodical play more than raw speed — a careful 3:00 solve in five guesses beats a frantic 1:30 solve in eight.',
    ],
    tips: [
      {
        heading: 'Hunt the suffix first',
        body: 'A huge share of seven-letter answers end in -ING, -TION, -MENT, -ABLE, -ER, or -EST. One mid-game guess engineered to test a suffix hypothesis (e.g. placing -ING) can collapse hundreds of candidates into a handful.',
      },
      {
        heading: 'Two openers, ten letters',
        body: 'With eight rows you can afford a two-word opening that covers ten distinct letters — try AUCTION then SPHERES style pairings. By row three you will know more about this word than you would know about a Classic word at the same depth.',
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
      'Four hidden words, one shared keyboard. Every guess you submit is applied to all four boards simultaneously, each board coloring its own feedback. Solve a board and it locks with a checkmark; the rest keep accepting your guesses. Win by clearing all four within nine guesses.',
      'A dedicated quadrant keyboard shows each key split four ways — one sub-cell per board — so you can see at a glance that R is placed on board two, present on board three, and dead on the others.',
    ],
    scoring: [
      'Win base 1,000 plus one point per second under the ten-minute cap. The completion bonus scales: each solved board contributes 50 points (4/4 = 200), and you keep that partial credit even on a loss — solving three of four scores far better than solving one.',
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
      'QuadWord doubled: eight hidden words, thirteen shared guesses, every submission applied to all eight boards at once. Boards lock as they solve. The quadrant keyboard splits each key eight ways so per-board letter knowledge stays readable.',
      'Thirteen guesses across eight words leaves an average of 1.6 rows per word after your information-gathering opening — OctoWord is won or lost in the first four rows.',
    ],
    scoring: [
      'Win base 1,000, one point per second under the fifteen-minute cap, and 25 points per solved board (8/8 = 200, partial credit on losses). Guess count still matters for the leaderboard and your records: it is measured as total rows used, not per-board.',
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
      'Four words, solved strictly left to right. Only the active board shows its colors; the upcoming boards are masked until it is their turn. Here is the twist that defines the mode: every guess you have ever made is applied to each new board the moment it unlocks — board four has silently absorbed all of your previous rows.',
      'You have ten guesses for the whole chain. The keyboard colors track only the active board, so your eliminations reset visually with each unlock even though the guess history carries over.',
    ],
    scoring: [
      'Win base 1,000, one point per second under the eight-minute cap, 50 points per solved board. The recorded guess count is the total rows the run consumed — board one solved in row six and board four solved in row ten records as a ten-guess game.',
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
      'Every board starts with the same three guesses already played for you, their tiles fully evaluated. Your job is to rescue all four boards with just six guesses of your own, applied to every board simultaneously like QuadWord.',
      'The prefilled rows are deterministic per day — every player rescues the same situation, which makes the daily leaderboard a pure deduction contest. The keyboard is pre-colored from the prefills the moment the board loads.',
    ],
    scoring: [
      'Win base 1,000, one point per second under the eight-minute cap, 50 points per solved board. The recorded guess count covers only YOUR guesses — the three prefilled rows are free.',
      'Six own-guesses for four boards is the tightest budget of any multi-board mode. The compensation: you start with a mountain of information already on the table.',
    ],
    tips: [
      {
        heading: 'Spend a full minute reading before typing',
        body: 'Three evaluated rows per board is twelve rows of intelligence. Work each board like a logic grid first: list confirmed positions, floating ambers, and dead letters. Many boards are already solvable on paper before your first guess — find those.',
      },
      {
        heading: 'Your first guess should solve, not probe',
        body: 'Unlike QuadWord, there is no budget for coverage openers — the prefills WERE your coverage. If no board is solvable outright, pick a word that simultaneously solves your best board candidate AND tests ambers on the others.',
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
      'The Gauntlet chains five stages of increasing board count into a single run — from a lone Classic board up through multi-board finales, 21 boards in total. Each stage has its own guess budget; run out of rows on any stage and the entire run ends there.',
      'Between stages you get a review of what you cleared and what is coming. Your time and guess totals accumulate across the whole run — the Gauntlet is scored as one long game, not five small ones.',
    ],
    scoring: [
      'Win base 1,000, one point per second under the thirty-minute cap, and completion credit proportional to boards cleared across the entire run: each of the 21 boards is worth about 9.5 points of the 200-point completion pool, and partial runs keep partial credit.',
      'The recorded guess count is the sum across every stage, which is why an efficient early stage matters: a three-guess stage one and a five-guess stage one look identical on your screen at the time, but they are 2 guesses apart on the leaderboard forever.',
    ],
    tips: [
      {
        heading: 'The early stages are where runs are won',
        body: 'Late stages have enough boards that scores converge — everyone grinds them. The separation happens on the small early stages, where solving in three instead of five is realistic. Treat stage one like a speedrun.',
      },
      {
        heading: 'Reset your opener every stage',
        body: 'Each stage has fresh words, so your coverage suite resets too. Don’t improvise: the same two or three preplanned openers you would use in QuadWord or OctoWord apply to the corresponding Gauntlet stages.',
      },
      {
        heading: 'Protect the run, not the score',
        body: 'When a stage gets dicey — two rows left, two boards open — switch to pure survival. A slow, ugly stage clear keeps 100% of your future scoring alive; a bust forfeits every stage you would have cleared after it.',
      },
      {
        heading: 'Pace for thirty minutes',
        body: 'The time cap covers the entire run. A relaxed two minutes on early stages costs little, but aim to bank at least fifteen minutes for the multi-board finale — running dry on time bonus during stage five erases the careful play that got you there.',
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
      { label: 'Hints', value: 'Clue / vowel / consonant, −120 pts each' },
    ],
    rules: [
      'The answer is a proper noun — a person, place, brand, character, or title — and a category pill tells you which kind. Answers can be multi-word ("first last" names render with a visible gap), and unlike every other mode your guesses don’t need to be dictionary words: any letter string of the right length is accepted.',
      'Three hints are available, each costing 120 points: a Wikipedia-derived clue sentence about the answer, a vowel reveal, and a consonant reveal. The clue consumes one of your six board rows — vowel and consonant reveals appear as rows showing the revealed letter in position.',
    ],
    scoring: [
      'Win base 1,000, one point per second under the five-minute cap, 200 completion, plus a 100-point bonus per unused guess — the richest guess bonus in the game, because names can be genuinely hard.',
      'Hints subtract 120 each. Taking all three costs 360 points but frequently converts a loss into a win — and a hinted win at ~1,000 points still beats a hintless loss at a few hundred.',
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
];

export function getGuide(slug: string): ModeGuide | undefined {
  return MODE_GUIDES.find((g) => g.slug === slug);
}
