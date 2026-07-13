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
];

export function getGuide(slug: string): ModeGuide | undefined {
  return MODE_GUIDES.find((g) => g.slug === slug);
}
