/**
 * Strategy articles — original, evergreen, crawlable long-form content for
 * /strategy/[slug]. Written as genuinely useful word-game writing (not SEO
 * filler) so the public site carries real editorial value beyond the login wall.
 */

export interface StrategyArticle {
  slug: string;
  title: string;
  description: string;
  /** ~1-sentence dek shown under the title. */
  dek: string;
  /** Reading-time minutes (rough). */
  minutes: number;
  sections: { heading: string; body: string[] }[];
  related: string[];
}

export const STRATEGY_ARTICLES: StrategyArticle[] = [
  {
    slug: 'best-starting-words',
    title: 'The Best Starting Words for Daily Word Puzzles',
    description:
      'Why your opening guess matters more than any other, which five-letter starters cover the most ground, and how to build a two-word opening system that solves in fewer guesses.',
    dek: 'Your first guess is the only one you make with zero information — spend it on coverage, not a hunch.',
    minutes: 6,
    sections: [
      {
        heading: 'Why the opener is the highest-leverage guess',
        body: [
          'In a five-letter, six-guess puzzle, the first row is the only guess you ever make blind. Every later guess is shaped by what the board has already told you, so the opener is the single decision where pure strategy — not deduction — decides how much you learn. Treat it as an information-gathering instrument, not an attempt to win on row one.',
          'The math is simple: a good opener turns five tiles into five independent yes/no/where signals. A weak opener (one that repeats a letter, or leans on rare letters) wastes tiles that could have been testing something new. A duplicate letter in your first word can only ever return information about one letter, so you have effectively played a four-letter opener.',
        ],
      },
      {
        heading: 'What makes a strong starter',
        body: [
          'Three properties matter, in order. First, no repeated letters — every tile should test a different letter. Second, common letters — the answer is far more likely to contain E, A, R, I, O, T, N, or S than J, Q, X, or Z, so a starter built from high-frequency letters lights up more often. Third, a spread of vowels — most five-letter answers contain two vowels, and pinning them early collapses the search space fast.',
          'Classic strong openers that satisfy all three: SLATE, CRANE, TRACE, AROSE, RAISE, and STARE. Each tests two vowels and three of the most common consonants. There is no single "best" word — they are all within a rounding error of each other — so the real edge comes from picking one and learning it cold.',
        ],
      },
      {
        heading: 'Build a two-word opening system',
        body: [
          'The strongest players do not improvise their first two rows; they memorize a pair that, together, test ten distinct high-value letters. For example: open with SLATE, then — regardless of the result — follow with CORNY. Across those two words you have tested S, L, A, T, E, C, O, R, N, and Y: ten different letters, including three vowels, with zero overlap.',
          'The payoff is twofold. You learn an enormous amount by the end of row two, and — because you never deliberate over the first two guesses — you bank time. In modes where the leaderboard tiebreaker is speed, that saved time is free ranking. Reserve your thinking budget for row three onward, where deduction actually changes the outcome.',
        ],
      },
      {
        heading: 'When to break the rules',
        body: [
          'Adapt the system to the format. In six- and seven-letter modes, your opener should cover more vowels (think ORANGE for six letters), because longer words carry more of them. In multi-board modes like QuadWord and OctoWord, a fixed, letter-diverse opening sequence matters even more — you want to feed every board the same broad information before you start solving them individually.',
          'The one time to abandon coverage is the endgame. On your last guess with a narrow candidate list, switch from information-gathering to a committed best guess: bias toward common endings (-ER, -ED, -LY, -AL, -TY) and common openings (S-, C-, B-, T-, P-) rather than an exotic arrangement.',
        ],
      },
    ],
    related: ['solve-faster', 'modes-explained'],
  },
  {
    slug: 'solve-faster',
    title: 'How to Solve Word Puzzles in Fewer Guesses',
    description:
      'A practical deduction method: use gray tiles as hard filters, relocate amber letters efficiently, read repeated-letter clues, and avoid the traps that cost an extra row.',
    dek: 'Most lost guesses come from ignoring the eliminations — the gray tiles are half the puzzle.',
    minutes: 7,
    sections: [
      {
        heading: 'Gray tiles do the heavy lifting',
        body: [
          'New players fixate on the purple (correct spot) and amber (wrong spot) tiles, but eliminations shrink the candidate pool the fastest. After two good guesses you typically know eight to ten letters that are NOT in the answer. Before you type your next word, run it through that exclusion list — if it contains a known-gray letter, you are wasting a tile.',
          'A useful habit: keep a mental (or literal) "dead letters" list and treat it as a hard filter. The discipline of never reusing a gray letter alone will cut roughly half a guess off your average over time.',
        ],
      },
      {
        heading: 'Relocate ambers two at a time',
        body: [
          'An amber letter is in the word but not where you put it — so it has at most four remaining legal positions. The inefficient play is to test ambers one at a time. The efficient play is to choose a next guess that moves multiple ambers to new, untested positions simultaneously.',
          'Concretely: if R is amber in slot 2 and E is amber in slot 5, pick a real word that places R in slot 4 and E in slot 3 at once. One row resolves two positional unknowns. Players who relocate ambers in parallel routinely finish a full guess ahead of players who test them serially.',
        ],
      },
      {
        heading: 'Read the duplicate-letter clue',
        body: [
          'Repeated letters are judged individually, and that creates a clue most players miss. If you guess a word with two of the same letter and only one tile colors while the duplicate shows gray, the answer contains that letter exactly once. That gray duplicate is not a dead end — it is a precise count.',
          'The inverse trap is just as common: assuming a five-letter answer has five distinct letters. A large share of answers repeat a letter. When your candidate list is not collapsing, deliberately test a double (e.g. a word with two Ls or two Es) — confirming or ruling out a repeat often cracks the puzzle open.',
        ],
      },
      {
        heading: 'Manage the clock without rushing',
        body: [
          'Speed and accuracy are not opposites here. The time you save comes from not deliberating on guesses where deliberation does not help — the first two rows — not from rushing the rows where it does. Memorize your opening pair, play it instantly, then slow down for the deduction phase.',
          'On the daily leaderboard, where every player solves the same word, the tiebreaker is time. Two players who both solve in four guesses are separated entirely by how long they spent staring at row one. Bank that time up front and you climb the board without taking a single extra risk.',
        ],
      },
    ],
    related: ['best-starting-words', 'modes-explained'],
  },
  {
    slug: 'modes-explained',
    title: 'Every Wordocious Mode Explained',
    description:
      'A plain-English tour of all nine Wordocious modes — Classic, Six, Seven, QuadWord, OctoWord, Succession, Deliverance, Gauntlet, and ProperNoundle — plus real-time VS Battle.',
    dek: 'One daily word is just the start — here is what each mode actually asks of you, and which to play first.',
    minutes: 8,
    sections: [
      {
        heading: 'The single-board core: Classic, Six, Seven',
        body: [
          'Classic is the foundation: one hidden five-letter word, six guesses, the familiar purple/amber/gray feedback. Everything else is a variation on it. If you are new, start here — the openers and deduction habits you build in Classic transfer to every other mode.',
          'Six and Seven raise the word length to six and seven letters and grant an extra guess to match (seven and eight respectively). Longer words carry more vowels and more structure, so your opener should cover more ground — and common multi-letter endings (-TION, -MENT, -ABLE) become powerful late-game patterns.',
        ],
      },
      {
        heading: 'The multi-board challenge: QuadWord, OctoWord',
        body: [
          'QuadWord puts four boards on screen at once; OctoWord puts eight. Every guess you type is played against every unsolved board simultaneously, so the strategy inverts: instead of zeroing in on one word, you spend your early guesses feeding all the boards the same broad, letter-diverse information, then peel them off one at a time as each becomes obvious.',
          'The trap is tunnel vision — locking onto the board you can almost solve and starving the others of guesses. The discipline is to keep your first few words maximally diverse and only commit to a specific board once it is nearly forced.',
        ],
      },
      {
        heading: 'The twists: Succession, Deliverance, Gauntlet',
        body: [
          'Succession reveals its boards one at a time, in sequence — you cannot see the next word until you have solved the current one, so there is no parallel-information shortcut. Deliverance hands you boards that are partially pre-filled, turning each into a rescue puzzle where you finish someone else’s start.',
          'Gauntlet is the marathon: five modes chained into a single run, escalating in difficulty, where one run’s momentum carries across stages. It is the truest test of all-around skill, because you cannot lean on a single favorite format.',
        ],
      },
      {
        heading: 'The wild cards: ProperNoundle and VS Battle',
        body: [
          'ProperNoundle swaps the dictionary for proper nouns — famous names — and gives you a real clue drawn from an encyclopedia entry rather than a definition, because names are not in a standard dictionary. It rewards general knowledge as much as letter logic.',
          'VS Battle is the real-time mode: you and a live opponent race the exact same puzzle, with each other’s progress visible as you go. It is the same deduction skill under pressure, and the fastest way to find out how your solving speed stacks up against another human. Every player worldwide also shares one daily word per mode, so the daily leaderboard is a global, same-word competition.',
        ],
      },
    ],
    related: ['best-starting-words', 'solve-faster'],
  },
  {
    slug: 'multi-board-mastery',
    title: 'Multi-Board Mastery: How to Win QuadWord and OctoWord',
    description:
      'The guess-budget math behind four- and eight-board word puzzles, why tunnel vision loses games, and the feed-then-harvest rhythm that turns multi-board chaos into a routine.',
    dek: 'Four boards, nine guesses. Eight boards, thirteen. The math says you have no rows to waste — here is how not to waste them.',
    minutes: 7,
    sections: [
      {
        heading: 'Understand the guess budget first',
        body: [
          'In QuadWord you get nine guesses for four words — an average of 2.25 rows per board. In OctoWord it is thirteen guesses for eight words, about 1.6 rows each. Read those numbers again: in a single-board game you would call a two-guess solve exceptional, and multi-board modes quietly demand you average close to that across every board. The only way that is possible is that each guess scores information on every unsolved board at once.',
          'That reframing is the whole strategy. A guess is not "my attempt at board three" — it is a broadcast that every open board hears. The players who lose multi-board games are the ones who spend rows talking to one board while the other boards hear a word full of letters they have already ruled out.',
        ],
      },
      {
        heading: 'Feed first: the opening broadcast',
        body: [
          'Open with a fixed sequence of two or three letter-diverse words and play them no matter what the boards show. Something like SLATE, then CORNY, then — in OctoWord — a third word covering letters you have not yet touched. Across three words you can test fourteen or fifteen distinct letters, and every board on screen has now told you which of those letters it contains and where.',
          'It feels wrong to "ignore" a board that lit up three purple tiles on row one. Trust the budget math: the near-solved board is not going anywhere, and the information you feed the stubborn boards now is what prevents the endgame where two blank boards remain and three guesses are left.',
        ],
      },
      {
        heading: 'Harvest in the right order',
        body: [
          'After the broadcast phase, solve boards in order of certainty, not order of appearance. A board is ripe when the candidate list in your head is down to one — solve it immediately, because a solved board stops diluting your attention, and its answer often confirms letter positions that transfer to its neighbors.',
          'When two boards are both nearly ripe and share an unknown, prefer the guess that resolves both. If board two could be SHARD or SHARK and board five needs a D-or-K test anyway, the overlap decides your row for you. This cross-board deduction is the skill ceiling of the format — the tiles on one board are evidence about another.',
        ],
      },
      {
        heading: 'The endgame: when to gamble',
        body: [
          'Count rows against open boards constantly. The moment your remaining guesses equal your remaining boards, information time is over — every row must now be a committed solve attempt. Bias your commits toward the boards with the fewest candidates, and accept that a coin flip between two candidates is sometimes forced; taking it on the narrower board keeps the other boards\' options open longest.',
          'Even when a full clear is out of reach, keep solving: Wordocious banks partial credit per solved board, so turning a doomed run into a six-of-eight finish is worth real points and leaderboard places. The daily OctoWord leaderboard is largely decided by who salvages the most from imperfect runs.',
        ],
      },
    ],
    related: ['best-starting-words', 'gauntlet-survival'],
  },
  {
    slug: 'gauntlet-survival',
    title: 'Surviving the Gauntlet: A Stage-by-Stage Run Guide',
    description:
      'How to pace a five-stage Gauntlet run in Wordocious — where the guess budget actually breaks runs, what each stage punishes, and how to bank score even when a clear slips away.',
    dek: 'Five escalating stages, one run, no reset button. The Gauntlet is a pacing problem disguised as a word puzzle.',
    minutes: 6,
    sections: [
      {
        heading: 'The Gauntlet is one long game, not five short ones',
        body: [
          'A Gauntlet run chains escalating stages into a single continuous challenge, and the mistake almost everyone makes at first is playing stage one like a standalone puzzle — burning rows on low-stakes deduction they would never spend if they could see the whole run at once. Every guess you waste early is a guess the brutal late stages will ask for and not get.',
          'Treat the early stages as a warm-up you are trying to exit efficiently, not dramatically. A two-row hole dug in stage one is shallow; the same hole in stage four, when the boards are bigger and the margin is thinner, ends runs.',
        ],
      },
      {
        heading: 'Standardize the boring stages',
        body: [
          'The early single-board stages should be close to automatic: your practiced opener, your practiced follow-up, then a deduction. If you have a two-word opening system from Classic, this is exactly where it pays — you conserve both guesses and mental energy, and speed matters because the run\'s time feeds your score.',
          'Consistency beats brilliance here. The players with deep Gauntlet records are not solving stage one in two rows every day; they are never solving it in five.',
        ],
      },
      {
        heading: 'Respect the difficulty spike',
        body: [
          'The back half of the run is where multi-board and long-word skills arrive at once, while fatigue from the earlier stages has already collected. Before your first guess of a late stage, pause and re-read the stage rules — the format shifts between stages, and the single most common late-run death is autopiloting a strategy from the previous stage into a format it does not fit.',
          'Slow down exactly when the run speeds up. A ten-second breath before a late-stage opener costs almost nothing against the run clock and prevents the panicked, low-information guess that turns a live run into a post-mortem.',
        ],
      },
      {
        heading: 'A dead run still pays',
        body: [
          'Gauntlet scoring banks what you clear: a run that dies in stage four still records the stages and boards behind it. When a stage goes sideways, the right mindset is salvage, not surrender — grind out every board you can force, because the daily Gauntlet leaderboard is mostly populated by imperfect runs, and dying furthest along, fastest, wins real places.',
          'Then review the reveal. The stage recap shows you the words that killed you, and Gauntlet deaths are the most instructive in the game precisely because they happen under pressure. Yesterday\'s fatal word pattern is tomorrow\'s routine solve.',
        ],
      },
    ],
    related: ['multi-board-mastery', 'solve-faster'],
  },
  {
    slug: 'propernoundle-playbook',
    title: 'The ProperNoundle Playbook: Guessing Famous Names',
    description:
      'Why guessing proper nouns is a different skill from guessing dictionary words — how to use the daily category, read the encyclopedia clue, and treat name structure as evidence in ProperNoundle.',
    dek: 'The dictionary is gone, the answer is famous, and the clue is real. ProperNoundle rewards a different kind of thinking.',
    minutes: 6,
    sections: [
      {
        heading: 'A name is not a word',
        body: [
          'Everything you know about letter frequency was learned from dictionary words, and names only half-obey it. Names carry doubled letters, unusual vowel runs, and spellings imported from a dozen languages — the letter logic still works, but it is weaker evidence than in Classic, so lean on it less and on meaning more.',
          'The category is your anchor. ProperNoundle tells you the kind of famous name you are hunting each day — an athlete, a city, a screen character — and every deduction should run through it. Three letters of an athlete\'s name summon a shortlist in a way three letters of an arbitrary word never can.',
        ],
      },
      {
        heading: 'Read the clue like a researcher',
        body: [
          'ProperNoundle\'s hint is drawn from a real encyclopedia entry about the answer, not a dictionary definition — because names do not have definitions. Read it twice: once for the obvious subject, once for the incidental details. An era, a nationality, an achievement mentioned in passing — each one prunes the shortlist your category gave you.',
          'This is the mode where general knowledge and letter deduction genuinely meet. The endgame is a conversation between the two: the tiles rule out candidates the clue suggested, and the clue ranks the candidates the tiles allow.',
        ],
      },
      {
        heading: 'Guess names, not letter salads',
        body: [
          'When you are stuck in Classic, probing with a pure coverage word is fine. In ProperNoundle, your guesses must themselves be plausible names — so a probe costs more and must earn more. Choose probe names that test the letters splitting your shortlist: if you are torn between two families of candidates, guess the name that shares letters with one family and not the other.',
          'Mind the spaces. Multi-word names are entered without the space, which shifts every position you think you know — TRAE YOUNG plays as TRAEYOUNG, and the Y you were sure started the surname is actually the fifth tile. Recount positions against the smushed spelling before you commit a guess.',
        ],
      },
      {
        heading: 'Play the long game with categories',
        body: [
          'Categories recur, and each one has a shape: the plausible answers on a world-cities day skew shorter and vowel-heavy; an NBA-players day is full of consonant-heavy surnames. Regulars build an instinct for each category\'s population, which is why streaks in this mode reward showing up daily more than any dictionary mode does.',
          'When you lose, read the answer\'s entry. It is the only mode where losing teaches you a fact as well as a pattern — and the fact is the part that wins you a future daily.',
        ],
      },
    ],
    related: ['modes-explained', 'best-starting-words'],
  },
  {
    slug: 'daily-sweep-guide',
    title: 'The Daily Sweep: Streaks, Medals, and Playing Every Mode',
    description:
      'How the Wordocious daily system fits together — one shared word per mode, local-midnight resets, Daily Sweeps, Flawless Victories, medals, and the streak habits that compound XP.',
    dek: 'Every player in the world gets the same words you do today. Here is how to turn that into streaks, medals, and rank.',
    minutes: 6,
    sections: [
      {
        heading: 'One seed, one world',
        body: [
          'Every Wordocious mode has exactly one daily puzzle, and everyone on Earth plays the same one — the same hidden words, the same boards, the same clue. That single shared seed is what makes the daily leaderboard meaningful: your rank is a straight comparison against every other person who faced identical conditions, not a luck-of-the-draw lottery.',
          'The day resets at your local midnight. Finish a daily and it is banked; miss a day and it is gone — dailies do not accumulate, which is exactly what makes the streak the game\'s most honest stat.',
        ],
      },
      {
        heading: 'Sweep the board, then keep it clean',
        body: [
          'Completing every mode\'s daily in one day is a Daily Sweep, worth bonus XP on top of each puzzle\'s score. Winning them all — not just finishing — upgrades it to a Flawless Victory and a bigger bonus. If you are optimizing XP per minute, the sweep bonus means the last unplayed mode of the day is always worth more than replaying a favorite.',
          'Order matters less than momentum, but a sensible route exists: warm up on Classic, ride the rhythm into Six and Seven while your letter instincts are hot, take the multi-board modes in the middle, and save ProperNoundle for whenever your general-knowledge brain is awake. The Gauntlet, as the longest commitment, deserves an unhurried slot.',
        ],
      },
      {
        heading: 'Medals are a speed game',
        body: [
          'Each daily leaderboard pays gold, silver, and bronze to its top finishers, ranked by a composite of guesses and time. The composite is the key detail: a four-guess solve delivered fast routinely outranks a slow three-guess solve. If you want medals, practice your opening system until the first two rows cost you almost no clock — that is where most recoverable time lives.',
          'Podiums are also mode-shaped. The crowded modes demand near-perfect runs, while the longer formats — OctoWord, the Gauntlet — thin the field simply by asking more commitment. If your trophy case is empty, the marathon modes are the honest shortcut.',
        ],
      },
      {
        heading: 'Streaks compound, so protect them',
        body: [
          'A streak is one daily per calendar day, every day — and its value is less the XP than the practice cadence it enforces. Fifteen minutes of daily puzzles sharpens openers, endings, and category instincts faster than any amount of binge play, because each day\'s words are genuinely new information.',
          'Build the habit around your real midnight, keep one anchor mode you never skip on busy days, and let the sweep be the goal on free days rather than the obligation on all of them. The players at the top of the XP table are not the ones who grind hardest — they are the ones who never miss.',
        ],
      },
    ],
    related: ['solve-faster', 'modes-explained'],
  },
];

export function getArticle(slug: string): StrategyArticle | undefined {
  return STRATEGY_ARTICLES.find((a) => a.slug === slug);
}
