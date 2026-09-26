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
  /** The mode guide (guide-content.ts slug) this article is the playbook for, when it is about one game. */
  guide?: string;
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
      'A plain-English tour of every Wordocious mode — the eight daily word games (Classic, Six, Seven, QuadWord, OctoWord, Succession, Deliverance, Gauntlet), real-time VS Battle, and the ten extra dailies under More Games.',
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
      {
        heading: 'More Games: ten extra dailies outside the Sweep',
        body: [
          'The More Games tile opens a second shelf of daily puzzles that are not word-guessing at all. Sudocious is a Medium sudoku with three mistakes; Starsweep asks for one star per row, column and color region with none touching; Letter Ladder climbs one letter at a time against a par; Spyglass hides ten themed words forwards in a 10 × 10 grid; Hubbub builds words from seven letters around a required hub; Codebreaker is a letter-for-letter coded saying; Kindred hides four groups of four among sixteen words; Crosswordocious is a crossword of sayings with one word missing; Muddle is the newspaper scramble with a pun to finish; and ProperNoundle, the famous-names game, now lives here too.',
          'They earn XP, medals, leaderboard places and achievements like everything else, but they sit outside the Daily Sweep: the sweep and Flawless Victory stay the eight word games on the home grid, so a More Games result never pads or spoils them. Each title has its own playbook in this section and a full guide behind the ? button in play.',
        ],
      },
    ],
    related: ['best-starting-words', 'solve-faster', 'sudocious-playbook'],
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
    guide: 'gauntlet',
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
    related: ['modes-explained', 'best-starting-words', 'kindred-playbook'],
    guide: 'propernoundle',
  },
  {
    slug: 'sudocious-playbook',
    title: 'The Sudocious Playbook: Solving the Daily Sudoku Without Guessing',
    description:
      'How to solve the Wordocious daily sudoku by scanning instead of staring — the digit-by-digit cross-hatch, when to pencil Notes, why two mistakes are a budget not a cushion, and when a 100-point Hint beats a 300-point mistake.',
    dek: 'The daily is Medium and has one solution. Every guess you make is a shortcut with a price, and the price is 300 points.',
    minutes: 6,
    sections: [
      {
        heading: 'Scan digits, not cells',
        body: [
          'Beginners pick an empty cell and ask "what goes here?" — a question with up to nine answers and no fast way to check them. Strong solvers ask the reverse: "where does the 7 go in this box?" Pick a digit, find every copy already placed, and cross-hatch the rows and columns those copies occupy. Any 3 × 3 box left with a single open cell for that digit is a free, provable placement. Run 1 through 9 once and you will usually place six to ten digits before you have to think at all.',
          'Then repeat. Every placement changes the picture for the digits that follow, so a second pass through 1–9 finds placements the first could not. The rhythm — scan, place, rescan — is why the highlight matters: tap any filled digit and every copy lights up, so the cross-hatch is drawn for you.',
        ],
      },
      {
        heading: 'Hunt the nearly finished lines',
        body: [
          'A row or column with seven digits placed has two gaps and two missing digits. One of the two will be blocked in one gap by a crossing column or box, which forces the other — and both fall in a moment. Rows near completion are the cheapest points on the board; when the digit scan stalls, sweep the grid for any line or box with only two or three gaps and finish it.',
          'The same reasoning works on boxes. A box with two open cells and two missing digits is a pair waiting to be resolved by whichever row or column already contains one of them. Train yourself to see "two gaps" as a flag, not a detail.',
        ],
      },
      {
        heading: 'Notes are for pairs, not for everything',
        body: [
          'Sudocious lets you pencil candidates into any cell for free, and the reflex is to fill every empty cell with every possibility. Do not. A board covered in marks is harder to read than an empty one, and the daily rarely needs it. Use Notes surgically: when a cell is down to exactly two candidates, mark both; when a digit has exactly two possible homes inside a box, mark both cells. Those pairs are precisely what the next placement will resolve, and the game clears a penciled digit from its row, column and box the moment you place it, so the bookkeeping is done for you.',
          'A pair of pairs is the Medium puzzle\'s deepest trick. If two cells in a row each hold only the candidates 4 and 9, then 4 and 9 live in those two cells and nowhere else in that row — so you can strike them from every other cell in the line. Spotting a naked pair is usually the moment a stuck grid opens up again.',
        ],
      },
      {
        heading: 'Two mistakes are a budget, not a cushion',
        body: [
          'The scoring is blunt: your finish is counted as mistakes plus one out of a budget of four, and every unused step is worth 300 points. A clean grid banks 900; one mistake drops you to 600; two to 300; the third ends the puzzle. Speed is worth at most 240 points across a 30-minute cap, so no amount of pace recovers a single wrong digit. That arithmetic should change how you play: a placement you cannot prove is not a fast move, it is a 300-point coin flip.',
          'When two digits both seem possible for a cell, that is a Notes moment, not a placement. The daily is built to be solved by logic alone — if you are stuck, there is a deduction you have not found yet, and the way to find it is to rescan from 1, not to gamble.',
        ],
      },
      {
        heading: 'When a Hint beats a mistake',
        body: [
          'A Hint fills the selected cell (or the first empty one) with the correct digit for 100 points. It never counts as a mistake and never ends the game, though it does rule out a Perfect run and the Pure Sudocious achievements. Compare the prices: a Hint costs 100, a wrong guess costs 300 and moves you a step closer to losing everything. If you have exhausted the scan and are about to guess between two candidates, take the Hint on that exact cell — you keep the 200-point difference and, more importantly, the cell you were stuck on is usually the key that unlocks the rest of the grid.',
          'The Hint is not for speed. Using it to skip thinking on a cell you could have solved costs you 100 points and the Perfect run for nothing. Use Undo freely instead — it is unlimited and free, though it never refunds a mistake or a hint — and save the Hint for a genuine dead end.',
        ],
      },
      {
        heading: 'Pace for the leaderboard',
        body: [
          'Because everyone plays the same grid, the Sudocious leaderboard is a pure comparison of cleanliness first and time second. Almost every strong finish is a zero-mistake grid, so the podium is decided by the clock — and the clock is won in the opening two minutes, when the digit scan places the easy dozen. Do the first full pass through 1–9 without pausing to think about anything else, then slow down for the pairs.',
          'Pro Unlimited lets you drill Easy grids (solvable by singles alone) and Hard grids (which demand pencil marks) without touching your daily. The Easy drills make the scan automatic; the Hard drills teach the pair logic the daily only occasionally needs. Like every More Games title, none of it touches your Daily Sweep.',
        ],
      },
    ],
    related: ['starsweep-playbook', 'kindred-playbook', 'modes-explained'],
    guide: 'sudocious',
  },
  {
    slug: 'starsweep-playbook',
    title: 'The Starsweep Playbook: Forced Placements and the Art of Crossing Out',
    description:
      'How to clear the Wordocious daily star puzzle by pure logic — smallest-region openings, the region-counting argument that cracks the middle of every 8 × 8, why crosses come before stars, and how the three-mistake budget prices every hunch.',
    dek: 'One star per row, column and color region, none touching. The board never needs a guess — it needs you to cross out more cells first.',
    minutes: 6,
    sections: [
      {
        heading: 'Open with the smallest region',
        body: [
          'Every region owns exactly one star, and a region of two or three cells has almost nowhere to put it. Whichever of its cells holds the star, every cell that touches all of them is dead — stars cannot share a corner, let alone an edge — so you can cross those neighbors out before you place anything. On a 7 × 7 board a two-cell region often settles its row or column in a single move.',
          'Then look at the row and column the small region occupies. Its star takes that row, so no other region may place a star in that row: cross every cell of the row that lies outside the small region. That one deduction routinely eliminates five or six cells and pulls the next region into focus.',
        ],
      },
      {
        heading: 'Count regions against rows',
        body: [
          'The argument that breaks the middle of every 8 × 8 is a counting one. If two regions fit entirely inside two rows, those two rows\' stars must belong to those two regions — there are only two stars to go around — so every cell in those rows that belongs to any other region is out. The same holds for columns, and for three regions inside three rows. Look for it whenever a couple of regions sit stacked on top of one another.',
          'The mirror image is just as useful. If a region spans exactly one column, its star takes that column and no other region may use it: cross the whole column outside the region. Tall thin regions and wide flat regions are gifts, because they own a line outright.',
        ],
      },
      {
        heading: 'Cross before you star',
        body: [
          'Starsweep is won by elimination, not inspiration. Tap a cell once to cross it out; the mark is free, never judged and never counted, and it is where the actual solving happens. Every cross you place is a fact about the board that stays visible, so the more you mark, the less you have to hold in your head. When a row is down to one uncrossed cell, that cell is the star — and it cost you nothing to have been thorough.',
          'Auto-cross is on by default and does the mechanical half of this for you: place a correct star and its row, column, region and eight neighbors are crossed automatically. Leave it on. Your job is the other half — the crosses that follow from reasoning about regions, not from a star already placed.',
        ],
      },
      {
        heading: 'Price every hunch at 300 points',
        body: [
          'The scoring treats your finish as mistakes plus one out of a budget of four, with every unused step worth 300 points: a clean board banks 900, one mistake 600, two 300, and the third mistake ends the game. Speed is worth at most 240 points across the ten-minute cap, so a faster board can never outrank a cleaner one. Read that as a rule: a star you cannot prove is a 300-point bet with a one-in-two or worse chance of paying off, plus a step toward losing the whole day.',
          'When two cells both look possible for a region\'s star, do not pick. Cross out something else — look for a neighboring region\'s forced line, or the counting argument — and one of the two candidates will die on its own. The board is built so that this always works.',
        ],
      },
      {
        heading: 'The Hint is a row, not a cell',
        body: [
          'A Hint places the correct star for the row of the cell you last tapped (or the first row still missing one) for 100 points. It never counts as a mistake, but it rules out a Perfect run and the Pure Starsweep achievements. Because a wrong star costs 300 and a Hint costs 100, the Hint is the right call the moment you are genuinely about to guess — tap a cell in the row you are stuck on first, so the hint lands where you need it.',
          'Use Undo before you use the Hint. Undo is free and unlimited, walking back stars and crosses alike, and a wrong cross earlier in the solve is the most common reason a board seems to have no legal move. Step back a few actions, recheck the crosses against the region rule, and the "impossible" board usually resolves.',
        ],
      },
      {
        heading: 'Thursday is a different game',
        body: [
          'Monday to Wednesday the board is 7 × 7; Thursday to Sunday it is 8 × 8, and the extra row is more than a 15% increase in difficulty. Eight regions give the counting argument more to bite on and the small-region opening less to work with, so the middle game — regions against rows — is where the weekend boards are decided. If you only have time to practice one thing, practice the count.',
          'Pro Unlimited adds a 9 × 9 board, which is the best training there is: it forces the counting logic on every board and makes the daily 8 × 8 feel roomy. As with every More Games title, none of this touches your Daily Sweep — Starsweep is extra XP, medals and a leaderboard, not a sweep cell.',
        ],
      },
    ],
    related: ['sudocious-playbook', 'kindred-playbook', 'modes-explained'],
    guide: 'starsweep',
  },
  {
    slug: 'letter-ladder-playbook',
    title: 'The Letter Ladder Playbook: Finding the Shortest Route to Par',
    description:
      'How to climb the Wordocious daily word ladder on par — counting the letters that must change, finding the pivot vowel, working backwards from the end word, and why rejected words and Undo are free while every accepted rung costs a move.',
    dek: 'Par is the shortest route through common words, and every step over it costs 300 points. Plan the climb before you type the first rung.',
    minutes: 6,
    sections: [
      {
        heading: 'Count the differences first',
        body: [
          'Before you type anything, line START and END up letter by letter and count the positions that differ. If three letters differ, par is at least three, and an ideal climb changes one of those three letters on every rung and nothing else. A move that changes a letter already matching END is a step backwards — sometimes a necessary detour, but never a free one.',
          'The count also tells you how much slack you have. Par runs from 4 moves on Monday and Tuesday to 7 on Sunday, and you always get par plus five accepted moves before the ladder is lost. A Sunday ladder with four differing letters and a par of 7 is telling you that the direct route is blocked and three detour moves are built in — so look for the block early rather than discovering it on rung four.',
        ],
      },
      {
        heading: 'Find the pivot vowel',
        body: [
          'Most ladders turn on a vowel swap in the middle of the word, and most blocked routes are blocked because the vowel cannot change yet. STONE to STANE is not a word, but STONE to STORE to STARE is: the consonant change opens a word in which the vowel is free to move. When the letter you want to change produces a non-word, change a neighboring consonant first and try the vowel again a rung later.',
          'Think in word families. -ATE, -INE, -OLD, -ARE, -AND are dense neighborhoods with many one-letter neighbors; -UMP or -ISK are sparse. If your route can pass through a dense family it will find rungs easily, so steer toward one when the direct path stalls.',
        ],
      },
      {
        heading: 'Climb from both ends',
        body: [
          'It is often easier to see which words are one step away from END than to push forward blindly from START. List END\'s neighbors in your head — every word one letter different — and pick the one that shares the most letters with your current rung. Now you are aiming at a target two or three moves closer than END itself.',
          'When both ends have obvious neighbors, meet in the middle: find a word that is one step from a START-neighbor and one step from an END-neighbor, and the whole ladder is drawn before you type. Planning a five-move route in your head takes twenty seconds; typing it takes ten. Discovering it rung by rung takes three minutes and two Undos.',
        ],
      },
      {
        heading: 'Rejections are free — spend them',
        body: [
          'Letter Ladder turns a word away for three reasons: it is not in the word list, it changes more than one letter (or none), or it is already on your ladder. None of these costs anything — no move, no mistake, no time penalty beyond the second it took to type. Only an ACCEPTED word is a move. So when you are unsure whether a rung is a word, type it. Agonizing over whether STANE exists costs more than finding out.',
          'This also means the word list is your ally. It is built from common words — par is always achievable through everyday vocabulary, and no obscure word can beat it — so if your route needs an unusual word, you are probably on the wrong route rather than short of vocabulary.',
        ],
      },
      {
        heading: 'Undo early, not late',
        body: [
          'Undo removes the last rung so you can go another way. It is free — but the move you spent on that rung stays spent, because the game counts accepted words, not rungs currently on the ladder. That changes when to use it: the moment a rung leads somewhere with no good next step, Undo now. Two more rungs down a dead end are two more moves you can never recover, and the ladder is lost at par plus five.',
          'The scoring makes the cost concrete. Your finish is counted as moves over par plus one, out of a budget of six, and every unused step is worth 300 points — a climb exactly on par banks 1,500, one over 1,200, two over 900. Speed adds at most 240 points across a ten-minute cap, so a shorter climb always beats a faster one. Every detour you avoid is worth more than any amount of pace.',
        ],
      },
      {
        heading: 'Hints count as moves',
        body: [
          'A Hint places the next word on a shortest route from where you stand, for 100 points of score — and it counts as one of your moves, though never as a mistake, and it rules out a Perfect run. Because the hint is always on a shortest route, it is most valuable when you are on the right path and simply cannot see the next word: it costs 100 points instead of the 300 an extra rung would. It is least valuable when you have already wandered, since it does not undo your detour.',
          'On a loss the board shows one shortest route. Read it. Ladders reuse the same pivots — the same vowel swaps, the same dense word families — and the route you missed today is the one you will see coming next week. Like every More Games title, Letter Ladder is extra: it earns XP and medals, but your Daily Sweep is the eight word games and this climb never changes it.',
        ],
      },
    ],
    related: ['best-starting-words', 'muddle-playbook', 'hubbub-playbook'],
    guide: 'letter-ladder',
  },
  {
    slug: 'spyglass-playbook',
    title: 'The Spyglass Playbook: Clearing the Daily Word Search Clean and Fast',
    description:
      'How to clear the Wordocious daily word search with zero misses — scanning for rare letters and letter pairs, using the forwards-only rule to halve the search, taking long words first, and knowing exactly what a miss is so you never spend one.',
    dek: 'Nothing reads backwards, only straight lines of four or more can miss, and a clean clear ranks purely on time. Here is how to earn the clean part.',
    minutes: 6,
    sections: [
      {
        heading: 'Forwards only — use it',
        body: [
          'In the daily Spyglass grid every word reads forwards: left to right, top to bottom, or along a diagonal from top-left to bottom-right or bottom-left to top-right. Nothing is hidden backwards. That is not a small mercy — it halves the directions you must check from eight to four. Once you find a word\'s first letter you look right, down, down-right and up-right, and nowhere else.',
          'It also tells you where words can start. A nine-letter word cannot begin in the rightmost eight columns if it runs across, or in the bottom eight rows if it runs down. Long words on a 10 × 10 grid are confined to a small band of possible starting cells, which is why they are the easiest to place once you decide to look for them.',
        ],
      },
      {
        heading: 'Hunt the rare letter',
        body: [
          'Read the word list before you look at the grid, and pick the word with the least common letter — a Q, Z, X, K, J or V. Sweep the whole grid for that one letter. There are usually only two or three copies, and one of them belongs to your word. Checking four directions from three cells is a ten-second job; scanning for a common letter like E or S means checking twenty cells.',
          'When no word has a rare letter, hunt a rare pair instead. TH, SP, CH, QU, WH stand out far more than a lone T, and a pair points along the word\'s direction at the same time: find the T, look for the H beside it in each of the four forward directions, and you have both the start and the line.',
        ],
      },
      {
        heading: 'Long words first',
        body: [
          'An eight- or nine-letter word has very few places it can fit and, because the grid is only 10 × 10, it usually runs straight through the middle of several shorter words. Finding it first hands you a spine of confirmed letters, and the shorter words then reveal themselves as crossings of that spine. Two long words placed early will often make three or four short ones obvious.',
          'The theme helps here too. Every grid has a title, and the ten words belong to it; when you have found six, the remaining four are drawn from the same family, so guess what they might be before you read the list and you will spot them faster.',
        ],
      },
      {
        heading: 'Know exactly what a miss is',
        body: [
          'A miss is a straight line of four or more letters that spells no listed word. That is the whole definition. A short drag, a crooked drag, a tap on a single letter, a two-cell line — all free. A listed word dragged in either direction counts as found, so you never miss by dragging the right cells the wrong way. The only way to spend a miss is to commit a real four-plus line that is not a word, and the fix is simple: tap the first letter, look at the list, and only tap the last letter when you are sure.',
          'Misses never end the game, but they are what separate players. Your finish is counted as ten plus misses out of a budget of fifteen, and every unused step is worth 120 points — a clean clear banks 600, one miss 480, two 360. Speed is worth at most 96 points across the fifteen-minute cap, so a single miss costs more than the entire speed bonus. Looking is free; guessing is not.',
        ],
      },
      {
        heading: 'Hint and Reveal have different jobs',
        body: [
          'Hint pulses the first letter of the next word you have not found. It costs 60 points and never counts as a miss, but it rules out a Perfect run and the Pure Spyglass achievements. Since a miss costs 120, a Hint is half the price of a wrong guess — use it when you have scanned for a word\'s rare letters twice and still cannot see it, and never as a substitute for reading the grid.',
          'After five minutes a Reveal button appears. It ends the grid as a loss, shows where the missing words were, and keeps credit for everything you found — each of the ten words is its own board, so nine found is still a strong partial score. Reveal is for a grid that has beaten you, not a slow one; a clean clear at fourteen minutes outscores a reveal at six by more than a thousand points.',
        ],
      },
      {
        heading: 'Pace the clean clear',
        body: [
          'Because every strong finish is a zero-miss clear, the Spyglass podium is decided by time, and time is decided by method. Read the list once, rank the words by their rarest letter, take the long words and the rare-letter words first, and let the crossings give you the rest. The last two words are usually short, common-letter words — sweep the grid row by row for their first pair, not their first letter.',
          'Themes rotate through fifteen families, a theme never returns within four months and no word repeats within six weeks, so you cannot memorize the grid — but you can memorize the method. Like every More Games title, Spyglass earns XP, medals and a leaderboard place while leaving your Daily Sweep exactly where the eight word games put it.',
        ],
      },
    ],
    related: ['hubbub-playbook', 'crosswordocious-playbook', 'letter-frequency-atlas'],
    guide: 'spyglass',
  },
  {
    slug: 'hubbub-playbook',
    title: 'The Hubbub Playbook: Pangram Hunting and the Climb to Pandemonium',
    description:
      'How to climb the Wordocious seven-letter hub game — why the pangram comes first, how to build long words from prefixes and suffixes, what each rank threshold means for your score, why the board stays open after you solve, and what the two hints really cost.',
    dek: 'Hubbub rank solves the puzzle at half the maximum. Every rank after that is worth 300 points, and the pangram is the fastest way there.',
    minutes: 7,
    sections: [
      {
        heading: 'The pangram is your opening move',
        body: [
          'Every Hubbub puzzle contains at least one word that uses all seven letters, and it is worth its length plus seven — a seven-letter pangram scores 14, an eight-letter one 15, against 1 point for a four-letter word. That is often a fifth of the way to Hubbub in a single entry. Spend your first minute on it before you type anything else, while the letters are fresh and you have no half-found words distracting you.',
          'Hunt it structurally. Look at the six outer letters for a common ending — -ING, -ER, -ED, -LY, -ION — and ask which stem the center letter completes. If the letters include I, N and G, the pangram almost certainly ends in -ING and you need a four-letter stem from the other four. If they include T, I, O, N, try -TION or -ATION. Most pangrams are an ordinary word wearing a familiar suffix.',
        ],
      },
      {
        heading: 'Milk every word you find',
        body: [
          'A word you have already found is the seed of three more. If UNDER is on the board, try UNDERLINE, UNDERLINED, UNDERLINING. If a verb is there, try its -ED, -ING and -ER forms; if a noun is there, look for its plural if S is in the set (it often is not — Hubbub puzzles are frequently built without an S, precisely so plurals cannot pad the list). Building on a found word is the fastest way to add long, high-value words, because you already know the stem is legal.',
          'Repeats are allowed, and that matters more than it sounds: LEVEL uses one letter three times, BANANA uses one three times and another twice. When the letters seem exhausted, ask which could be doubled or tripled and try those shapes.',
        ],
      },
      {
        heading: 'Know the rank thresholds',
        body: [
          'Your rank is your share of the puzzle\'s maximum score, which is set by the common words alone. The ranks run Hush, Murmur, Chatter, Banter, Clamor, Racket, and then Hubbub at 50%, Uproar at 70%, Thunder at 85% and Pandemonium at 100% — every scoring word found. Hubbub solves the puzzle and records your result once, and it is the only threshold that changes a loss into a win.',
          'The scoring runs off those thresholds. A solve is worth the 1,000-point base plus 200 for finishing, and your rank is counted as your finish out of a budget of five: Hubbub banks 300 in rank bonus, Uproar 600, Thunder 900, Pandemonium 1,200. Speed is worth at most 240 points across a thirty-minute cap, so a higher rank always beats a faster one. Reaching Uproar instead of stopping at Hubbub is worth more than the entire speed bonus.',
        ],
      },
      {
        heading: 'The board stays open — use it',
        body: [
          'When you reach Hubbub the puzzle is solved and your result is recorded, but the board does not close. Keep going and every rank you climb afterwards raises your leaderboard score in place, without earning XP twice. This is unusual and it should change your routine: reach Hubbub early in the day, bank the win, and come back later with fresh eyes for Uproar and Thunder. Words you could not see at breakfast are often obvious at lunch.',
          'If you stop short of Hubbub, "End puzzle and see answers" records a loss at the rank you reached — with credit for your share of the maximum in twenty steps — and shows every word. Do not end early. A loss at Racket is still worth points, but the same puzzle at Hubbub after another ten minutes is worth 1,200 more.',
        ],
      },
      {
        heading: 'Four-letter words come last',
        body: [
          'A four-letter word is worth exactly 1 point, and a puzzle has a lot of them. They still count toward Pandemonium, but they will not carry you to Hubbub — twenty of them equal one good pangram. Spend your sharp early minutes on five-, six- and seven-letter words, which score their length and move the rank bar visibly. Sweep the four-letter words up at the end, when the long words are exhausted and you are hunting the last few percent for Thunder or Pandemonium.',
          'Shuffle when you stall. Seeing the same arrangement hides words; Shuffle (or Space) rearranges the six outer letters and the brain finds new pairs in the new order. It is free and unlimited, and most players use it far too little.',
        ],
      },
      {
        heading: 'Hints, and why every word is worth typing',
        body: [
          'Two hints exist and neither counts against your rank. "Starts with…" shows the first two letters and the length of the next word you have not found, for 50 points; "Reveal a word" costs two hints (100 points) and places that word, points included. Both rule out a Perfect run and the Pure Hubbub achievements. The 50-point hint is the better buy almost every time — two letters and a length is usually enough to see the word yourself, and you keep half the price.',
          'A word you are unsure of is free to try. If it is on the friendly list it scores like any other word — the everyday list sets the puzzle\'s maximum, but a rarer word you know counts in full and can lift your rank just the same — and if it is not on the list, nothing is lost. There is no penalty for a rejected word in Hubbub, so type everything that looks plausible. Only your rank and your time are recorded, and, like every More Games title, none of it touches your Daily Sweep.',
        ],
      },
    ],
    related: ['spyglass-playbook', 'letter-frequency-atlas', 'letter-ladder-playbook'],
    guide: 'hubbub',
  },
  {
    slug: 'codebreaker-playbook',
    title: 'The Codebreaker Playbook: Frequency, Pattern, and the Cost of a Check',
    description:
      'How to crack the Wordocious daily coded saying fast — starting from the three given letters and the short words, reading the frequency strip, using apostrophes and doubles as fixed points, and why you should pencil boldly and Check almost never.',
    dek: 'Penciled letters are free and the code cracks itself when every letter is right. The only thing that costs you is asking the game to check your work.',
    minutes: 7,
    sections: [
      {
        heading: 'Start where the puzzle starts you',
        body: [
          'Codebreaker hands you the three most frequent letters of the saying, already filled in and locked in the game\'s color. Those three are almost always drawn from E, T, A, O, I, N and S, and they touch most of the words in the sentence. Read every word that contains a given letter before you type anything — the puzzle is designed so that a way in is always visible.',
          'The short words are that way in. A one-letter word is A or I. A two-letter word is one of a dozen — OF, TO, IN, IT, IS, AS, AT, ON, BE, WE, HE, SO — and if it contains a given letter you can usually name it outright. A three-letter word ending in a given E is THE more often than anything else, which fixes T and H everywhere they appear. Two or three of these and a third of the code is broken.',
        ],
      },
      {
        heading: 'Trust the frequency strip',
        body: [
          'The strip of code letters under the board is ordered by how often each appears, and English is stubbornly consistent about frequency: after the three given letters, the next most common code letters almost always stand for the rest of E, T, A, O, I, N, S, H and R. When you have a candidate word with one unknown letter, check the unknown against the strip — a very common code letter is a vowel or one of T, N, S, R, and a code letter that appears exactly once is far more likely to be a B, K, V or W than an E.',
          'Frequency also settles doubles. Two identical code letters side by side are almost always LL, SS, EE, OO, TT or FF, and if the pair is a common code letter it is EE or OO, while a rare one is a consonant pair. That single rule places two letters at once.',
        ],
      },
      {
        heading: 'Apostrophes and endings are fixed points',
        body: [
          'A letter after an apostrophe is nearly always S or T — IT\'S, DON\'T, CAN\'T, WON\'T, YOU\'RE for the two-letter case. A word ending in a given E preceded by a common code letter is probably -RE, -SE, -TE or -LE. A four-letter word ending in two identical unknowns is very often -ALL, -ILL or -ELL. These endings are patterns you can read off the shape of the word before you know a single letter in it.',
          'A saying of 30 to 90 letters is a sentence you already know, and sentences have grammar: a three-letter word at the start is often THE or YOU, and the last word is the one the whole sentence points at. Guess the sentence, not the letters.',
        ],
      },
      {
        heading: 'Pencil boldly',
        body: [
          'Every letter you type is a pencil mark. It lands in every box with that code letter, you can type over it, Delete it everywhere at once, and nothing is marked or counted while you experiment. The game only warns you when you have used the same plain letter for two different code letters, turning both red — because a saying cannot have two letters that both mean E. So try a whole word at once and read the sentence back. A wrong guess usually looks wrong immediately, and undoing it is free.',
          'Penciling a full hypothesis is faster than being careful: if you think a five-letter word is THERE, type all five and let the other words tell you whether the R holds.',
        ],
      },
      {
        heading: 'Check almost never',
        body: [
          'Check is the only action that counts against you. It looks at every penciled letter, locks the right ones and clears the wrong ones with a red flash — and it is recorded. Your finish is counted as checks plus one out of a budget of four, with every unused check worth 250 points: no Check banks 750, one Check 500, two 250, three or more nothing. Speed is worth at most 240 points across a twenty-minute cap, so a single Check costs more than the whole speed bonus. The bonus falls per Check, not per wrong letter, which means one Check that catches five errors costs exactly what one Check that catches none does.',
          'That arithmetic gives you a policy. Never Check early. Pencil the whole saying, read it aloud, fix what reads wrong — the puzzle completes itself the moment every letter is right, so a fully correct board never needs a Check at all. Reserve Check for two or three genuinely doubtful letters, and take one Check, not two.',
        ],
      },
      {
        heading: 'Hint before Check, Reveal only when beaten',
        body: [
          'Hint fills in the most frequent letter you have not yet solved and locks it, for 100 points. It never counts as a Check, though it rules out a Perfect run and the Pure Codebreaker achievements. Because a Check costs 250 and a Hint costs 100, the Hint is the better buy whenever you are stuck rather than merely unsure — it hands you a common letter that usually appears in several words and opens all of them at once.',
          'Reveal appears after five minutes and shows the whole saying, recording the puzzle as a loss with credit for the time you put in. It is for a puzzle that has beaten you, and those are rare: these are sayings everyone knows, so once four or five words are readable, saying the sentence aloud almost always finishes it. On a holiday the saying belongs to the day, which is one more clue. Like every More Games title, Codebreaker earns XP and medals without touching your Daily Sweep.',
        ],
      },
    ],
    related: ['crosswordocious-playbook', 'letter-frequency-atlas', 'kindred-playbook'],
    guide: 'codebreaker',
  },
  {
    slug: 'kindred-playbook',
    title: 'The Kindred Playbook: Red Herrings, Odd Ones Out, and Hint Economics',
    description:
      'How to solve the Wordocious daily groups-of-four puzzle before four mistakes — counting candidates to find the crowded category, reading every word twice, using "One away…" properly, and why a hint is always cheaper than a guess.',
    dek: 'Sixteen words, four groups, four mistakes. The puzzle is built to mislead you, so count before you commit.',
    minutes: 6,
    sections: [
      {
        heading: 'Count candidates before you touch anything',
        body: [
          'Kindred deals sixteen words and hides four groups of four among them, and the setter\'s whole craft is making five or six words look like they belong to the same group. So before you select a single word, name every idea you can see and count how many words fit it. If five words look like fruit, one of them is a red herring that belongs somewhere else. A group with exactly four candidates is safe; a group with five or more is a trap until you find its odd one out.',
          'Work the safe group first. Locking four words in shrinks the board to twelve and removes one red herring from every crowded category at the same time. The puzzle gets easier with every group you solve, so solve the certain one to earn the uncertain ones.',
        ],
      },
      {
        heading: 'Read every word two ways',
        body: [
          'LIME is a fruit and a color. HUSKY is a dog and a voice. BASS is a fish and a note. The hardest group — four pips — is nearly always hiding in plain sight as ordinary words with a second reading: words that precede or follow a common word (MOUNTAIN ___, ___ BALL), homophones, anagrams, words that contain a hidden shorter word, things that come in a set. When a word seems to fit nowhere, that is the tell that its meaning is not the one you are reading.',
          'The pips are information after the fact. A group locks with one to four pips showing how hard it was — one pip is a plain category, four is wordplay — so if your first two groups came up with one and two pips, the remaining eight words hold the three- and four-pip groups, and you should be looking for the sly link, not the obvious one.',
        ],
      },
      {
        heading: 'Make "One away…" work for you',
        body: [
          'When three of your four belong together, the game tells you "One away…", and that is a real clue: keep three, swap one. Do not start over. If you have four candidates for the fourth slot, you can find the right one in at most four swaps — but you will usually find it in one or two, because "One away" also tells you which of your other ideas has been stealing a word from this group.',
          'A set you have already tried is free to try again. This matters in the endgame: if you are down to eight words and unsure which two-and-two split is right, resubmitting an earlier set costs nothing, so you are never punished twice for the same idea. Be systematic about which swaps you have tried rather than cycling at random.',
        ],
      },
      {
        heading: 'A hint is always cheaper than a guess',
        body: [
          'The scoring counts the sets you submitted — four is perfect, seven is the worst possible win — out of a budget of seven, with every unused submission worth 250 points: a flawless solve banks 750, one mistake 500, two 250, three nothing. Speed is worth at most 240 points across a ten-minute cap, so a single wrong set costs more than the whole speed bonus. Every guess you cannot justify is a 250-point bet.',
          'Against that, the hints are cheap. "Name a category" reveals the label of the easiest group you have not found for 100 points — you still have to find its four words, but you now know which idea is real. "Show a pair" rings two words that belong together for 200. Neither costs a mistake, both can be used more than once, and both are cheaper than a wrong submission. When you are down to your last mistake and torn between two sets, name a category: it costs 100, tells you which of your two ideas is a real group, and saves the puzzle.',
        ],
      },
      {
        heading: 'Hardest first, or last — decide on purpose',
        body: [
          'Once three groups are locked, the fourth is whatever remains, so the wordplay group very often solves itself — you never have to see the link, only to eliminate the other three. That is the default plan: obvious group, then the next-safest, and let the four-pip group fall out at the end for free.',
          'The alternative is deliberate. If you can see the wordplay group early — the hidden-word or the fill-in pattern jumps out — submitting it first earns the Hardest First achievement and removes the hardest red herrings from the board in one move. The mistake is doing it on a hunch: a four-pip group submitted with three candidates and a guess is exactly the 250-point bet the whole puzzle is designed to tempt you into.',
        ],
      },
      {
        heading: 'Shuffle, and read the holiday',
        body: [
          'Shuffle rearranges the unsolved words and it is free. Position creates false patterns — three words in a row look like a group because they are in a row — and a shuffle breaks the pattern your eye has fixed on. Use it whenever you have stared at the same twelve words for more than thirty seconds.',
          'On a holiday the puzzle belongs to the day, which narrows the categories before you read a word. Kindred hints and mistakes never touch your Daily Sweep — like every More Games title it is extra XP, medals and a leaderboard — so a rough day here is a rough day here and nothing more.',
        ],
      },
    ],
    related: ['codebreaker-playbook', 'sudocious-playbook', 'propernoundle-playbook'],
    guide: 'kindred',
  },
  {
    slug: 'crosswordocious-playbook',
    title: 'The Crosswordocious Playbook: Theme First, Crossings Second, Check Last',
    description:
      'How to fill the Wordocious daily sayings crossword clean — reading the title as a clue, hearing the saying instead of parsing it, placing the long answers early, and why letters are free to change while every Check costs 200 points.',
    dek: 'Every clue is a saying you already know with one word missing. The grid completes itself when it is right — so Check is a tax, not a step.',
    minutes: 6,
    sections: [
      {
        heading: 'The title is the first clue',
        body: [
          'Crosswordocious is themed, and the theme is the title. Most answers belong to it; a few are simply other sayings, and nothing on the board says which is which. So read the title before the clues and prime the family: if the title is "Down by the Sea", you are expecting ANCHOR, TIDE, SAILS and HARBOR, and a clue that does not fit the sea is telling you it is one of the plain sayings.',
          'On a holiday the puzzle belongs to the day, which makes the theme even louder. A Thanksgiving grid will lean on gratitude, harvest and family sayings; a Fourth of July grid on freedom and fireworks. Guess the answers before you read the clues and you will recognize them when you do.',
        ],
      },
      {
        heading: 'Hear the saying, do not parse it',
        body: [
          'Every clue is a familiar phrase with one word blanked out — "Calm before the ____", "A penny for your ____". These are not cryptic clues and they do not reward analysis; they reward recognition. Read the clue aloud, or silently as a sentence, and let the blank fill itself. The letter count in the grid then confirms the word or tells you to reach for the other version of the saying.',
          'When the saying does not come, do not reason letter by letter — move on. Crossings will give you two or three letters of the stubborn word, and a saying with its missing word half-spelled is a saying you will hear instantly.',
        ],
      },
      {
        heading: 'Long answers first',
        body: [
          'The grid is a sparse criss-cross of ten to thirteen entries in which every answer crosses at least one other. An eight- or nine-letter answer crosses more entries than a four-letter one, so two long answers placed early hand you a letter in half the grid. Scan the clue lists for the longest entries, solve those, and the short entries become fill-in-the-blanks with letters already showing.',
          'Use the two directions deliberately. Tap a cell twice or press Space to flip between Across and Down at the same cell; the active clue sits above the keyboard so you never scroll to read it. When an Across answer stalls, flip to the Down that crosses its blank cell — a letter from the other direction is the cheapest hint in the game.',
        ],
      },
      {
        heading: 'Letters are free — change them',
        body: [
          'Nothing is judged while you work. Type a letter, type over it, Delete it, try the other version of the saying — none of it costs anything and none of it is recorded. So when two words could fill a blank, type one and read the crossings. If the crossing entries still read as words, keep it; if one turns into nonsense, type the other. You have learned the answer by experiment, for free, in the time a Check would have cost you 200 points.',
          'The grid completes itself the moment every cell is right. There is no submit button and no final Check required, which means a careful solver can finish a grid without ever paying the Check tax at all.',
        ],
      },
      {
        heading: 'Check economics',
        body: [
          'Check locks every letter that is right and clears every letter that is wrong with a red flash, and each Check is recorded. Your finish is counted as checks plus one out of a budget of six, with every unused check worth 200 points: no Check banks 1,000, one Check 800, two 600, down to nothing at five. Speed is worth at most 240 points across the fifteen-minute cap, so one Check costs almost the entire speed bonus and two cost more than it.',
          'Because the bonus falls per Check and not per wrong letter, a Check should be a single, late, deliberate act. Fill the whole grid, read every entry back against its saying, fix what reads wrong, and only then — if two or three cells remain genuinely doubtful — take one Check to settle them all at once. A Check on a half-empty grid is the worst move in the game: it costs 200 points to confirm letters the crossings would have confirmed for free.',
        ],
      },
      {
        heading: 'Reveals, and when to stop',
        body: [
          'Reveal letter fills and locks the selected cell for 60 points; Reveal word fills the active entry for 120. Neither counts as a Check, both rule out a Perfect run and the Pure Crosswordocious achievements. A single revealed letter is the right call when one crossing is blocking a whole corner and no saying will come — 60 points to unlock three entries is a bargain — but a revealed word is rarely worth it when its crossings could have spelled it for you.',
          'Reveal all shows the whole grid and records the puzzle as a loss; you tap it twice, so a slip never costs you the day. Use it only when you would honestly rather see the answers than keep going — a finished grid with two Checks still outscores a reveal by more than a thousand points. And like every More Games title, Crosswordocious earns XP, medals and its own leaderboard without ever touching the eight-game Daily Sweep.',
        ],
      },
    ],
    related: ['codebreaker-playbook', 'muddle-playbook', 'spyglass-playbook'],
    guide: 'crosswordocious',
  },
  {
    slug: 'muddle-playbook',
    title: 'The Muddle Playbook: Circled Letters, Endings, and the Punchline',
    description:
      'How to solve the Wordocious daily scramble in five checks — spotting the ending in a scramble, pairing consonants, letting the caption tell you the pun, skipping stubborn words, and why one letter hint is cheaper than one wrong word.',
    dek: 'Four scrambled words, one pun, and every full word checks itself. Five checks is perfect; here is how to stay near it.',
    minutes: 6,
    sections: [
      {
        heading: 'Understand what a check is',
        body: [
          'Muddle has no submit button. The moment the boxes under a word are full, the word checks itself: right, and it locks and sends its ringed letters down to the punchline row; wrong, and the row shakes, the letters return to the scramble, and one check is spent. Every check counts, right or wrong. Four words plus the punchline is five checks — the perfect run — and the thirteenth check loses the puzzle.',
          'The scoring follows directly. Your finish is counted as your number of checks out of a budget of thirteen, with every unused check worth 150 points: a perfect five-check solve banks 1,200, one wrong word 1,050, two 900. Speed is worth at most 240 points across an eight-minute cap, so two wrong words cost more than the entire speed bonus. The habit this demands is simple — never let a word fill itself until you believe it.',
        ],
      },
      {
        heading: 'Find the ending first',
        body: [
          'Five- and six-letter English words overwhelmingly end in -ED, -ER, -LY, -ING, -S or -Y. Look at the scramble for those letters, set the ending aside in your head, and the remaining three or four letters are a much smaller puzzle. If the scramble contains I, N and G, the word almost certainly ends in -ING and you are looking for a three-letter stem. If it has an E and a D, try -ED before anything else.',
          'Do the same at the front. Consonant clusters travel together — TH, CH, SH, ST, BR, PL, TR — so if you can see one in the scramble, try it as the first two letters, then as the last two. Between a likely opening pair and a likely ending you often have four of six letters placed before you have "solved" anything.',
        ],
      },
      {
        heading: 'Circled letters are the second puzzle',
        body: [
          'Some boxes carry a ring. Those letters, taken in word order, are exactly the letters of the punchline — the pun that fills the caption\'s blank. Once all four words are solved the punchline row opens, and you spell it from the ringed letters the same way, checking itself when full. So every word you solve is also feeding you letters for the joke, and the joke is the reason to look at the cartoon.',
          'Read the caption before you finish the words. The punchline is a familiar phrase or a pun that fits the picture, and once two or three words are locked you usually have enough ringed letters to guess it. That guess then works backwards: if you know the punchline needs an R and a K, the unsolved word\'s ringed boxes must supply them, which tells you where the R and K go in the scramble.',
        ],
      },
      {
        heading: 'Skip the stubborn word',
        body: [
          'You do not have to solve the words in order. Tap another row and solve the easy ones first; their ringed letters shrink the punchline puzzle, and a punchline you can guess will often hand you the missing word backwards. Staring at one scramble for two minutes costs time; solving the other three in that time costs nothing and usually solves the stubborn one for you.',
          'Delete and Clear are free. Delete takes back the last letter you placed and Clear empties the row (pinned letters stay), so a half-placed word that suddenly looks wrong can be undone before it fills and checks itself. The one thing to avoid is filling the last box on a hunch — that is the only way to spend a check, and it is entirely under your control.',
        ],
      },
      {
        heading: 'One letter hint beats one wrong word',
        body: [
          'Two hints never count as checks. "Letter" places the next correct letter of a word (or the punchline) and pins it there for 75 points; "Solve" fills the whole word for two hints, 150 points. Both rule out a Perfect run and the Pure Muddle achievements. Compare them to a wrong word, which costs 150 points of check bonus and gains you nothing: a Letter hint is half the price and usually enough, because a five-letter scramble with one letter pinned in place is a very different puzzle from a five-letter scramble.',
          'The rule of thumb: if a word has beaten you twice, take the Letter. If it has beaten you twice and you are on your tenth check, take the Solve — losing the puzzle at thirteen costs far more than 150 points. Never Solve a word you have not yet tried; the hint is for a dead end, not a shortcut.',
        ],
      },
      {
        heading: 'Pace the perfect five',
        body: [
          'Because every strong Muddle finish is a five- or six-check solve, the podium is decided by time inside the eight-minute cap, and time is won by method rather than speed-typing. Endings first, consonant pairs second, caption third, punchline as soon as you can guess it. The whole puzzle fits on one screen so that your eye can move between the cartoon, the words and the ringed letters without scrolling — use all three.',
          'On a holiday the joke belongs to the day, which narrows the pun before you read a word. Like every More Games title, Muddle earns XP, medals and its own leaderboard while leaving your Daily Sweep exactly where the eight word games put it — so a thirteen-check day here is a bad joke, not a broken sweep.',
        ],
      },
    ],
    related: ['letter-ladder-playbook', 'crosswordocious-playbook', 'hubbub-playbook'],
    guide: 'muddle',
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
          'Order matters less than momentum, but a sensible route exists: warm up on Classic, ride the rhythm into Six and Seven while your letter instincts are hot, take the multi-board modes in the middle, and give the Gauntlet, as the longest commitment, an unhurried slot. The sweep is the eight word games on the home grid; ProperNoundle and the other More Games titles are extra dailies that earn XP and medals but never change whether you swept.',
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
  {
    slug: 'letter-frequency-atlas',
    title: 'The Wordocious Letter Atlas: What 2,412 Curated Answers Reveal',
    description:
      'Original letter-frequency research computed from the actual Wordocious answer bank: which letters appear most, where they sit, the endings that dominate, and how to convert the numbers into better guesses.',
    dek: 'We counted every letter in every answer so you don’t have to — here’s the map, and how to play it.',
    minutes: 9,
    sections: [
      {
        heading: 'The headline numbers',
        body: [
          'Every daily Classic answer in Wordocious is drawn from a curated bank of 2,412 five-letter words — common enough to be fair, varied enough to stay interesting. We counted every letter in every one of them. The results explain, in hard numbers, why some guesses feel efficient and others feel wasted.',
          'E appears in 48% of all answers — nearly one in two. A follows at 40%, then R at 36%, O and T at 29%, I at 28%, S at 27%, L at 25%, and N at 24%. That top group is exactly the pool a strong opening word should draw from: guess a word built from these and you are statistically guaranteed to light up tiles most days.',
          'At the other end of the atlas: Q appears in just 1.0% of answers, J in 1.3%, Z in 1.7%, and X in 1.9%. Even V (6.6%) and W (8.2%) are comparative rarities. The practical rule: never spend an early guess on a rare-letter word. Test the rare letters only when the board has narrowed and a specific candidate demands it.',
        ],
      },
      {
        heading: 'Position matters as much as presence',
        body: [
          'Knowing a letter is likely in the answer is half the picture; knowing where it likes to sit is the other half. First position is dominated by S — 16% of all answers start with it, nearly double the next contender. C (9%), B (8%), T (7%), P (6%), and F (6%) round out the leaders. When your candidate list is long, biasing toward S-starting words is the percentage play.',
          'Last position tells an even sharper story. E ends 17% of answers, but the surprise is Y: it closes 15% of the entire bank. Y is a deceptive letter overall — it appears in 17% of answers, and when it does appear, 88% of the time it is the final letter. If you have a yellow Y anywhere on the board, your default assumption should be that it belongs at the end.',
          'Two-letter endings concentrate hard: -ER closes 148 answers, -ED 116, then -CH (58), -SE (49), -CK (48), -TY (45), -AL (43), and -LY (41). When you are down to your last guesses with a couple of letters floating, running through these ending frames — does the evidence fit an -ER word? an -ED word? — resolves endgames faster than letter-by-letter trial.',
        ],
      },
      {
        heading: 'The vowel budget',
        body: [
          'Vowel structure is remarkably consistent: 60% of answers contain exactly two vowels, 31% contain just one, 9% squeeze in three, and only four words in the entire bank carry four. So the baseline assumption for any unsolved board is two vowels — and once you have confirmed two, additional vowel-hunting is usually a wasted tile.',
          'This is also the quiet argument for two-vowel openers like SLATE or CRANE over three-vowel openers like ADIEU. The three-vowel word over-tests a hypothesis that is only true 9% of the time, while under-testing the consonant structure that actually distinguishes most answers. Match your opener to the shape of the bank, not to a hunch about vowels.',
        ],
      },
      {
        heading: 'Turning the atlas into a routine',
        body: [
          'Here is the whole atlas compressed into a pre-game routine. Open with a no-repeat word built from the E-A-R-O-T-I-S-L-N pool. Read the result against the base rates: no S showing? You have still eliminated the single most common starting letter. Yellow Y? Slide it to the end. Two vowels confirmed? Stop hunting vowels and grind consonants.',
          'In the endgame, lean on the frames: S- up front, -ER/-ED/-Y at the back, and never re-test the rare letters unless a specific surviving candidate contains one. None of these rules solves a puzzle by itself — but each one tilts a guess a few percentage points in your favor, and across six rows those points compound into the difference between solving in five and solving in three.',
          'Want to see the atlas applied to a single word? Every entry in our Word of the Day archive breaks down a real answer with these exact statistics — how common its letters are, which answers sit one letter away, and what its pattern rewards.',
        ],
      },
    ],
    related: ['best-starting-words', 'repeated-letter-traps'],
  },
  {
    slug: 'repeated-letter-traps',
    title: 'Repeated Letters: The Trap Hiding in a Third of All Answers',
    description:
      'One in three Wordocious answers contains a repeated letter, and repeats break the assumptions behind most players’ guessing systems. How to detect a repeat early and solve through it without burning rows.',
    dek: '32% of answers repeat a letter. Players who never consider repeats donate a full guess to the house.',
    minutes: 7,
    sections: [
      {
        heading: 'The scale of the trap',
        body: [
          'Count every answer in the Wordocious bank and 780 of the 2,412 — a flat 32% — contain at least one repeated letter. That means roughly two mornings a week, the daily Classic answer breaks the quiet assumption built into most guessing habits: that five tiles means five different letters.',
          'The repeat offenders are not exotic. E doubles in 169 answers, O in 90, A in 81, L in 68, T in 64, and R in 56 — the same common letters your opener already tests. The trap is not that repeats use strange letters; it is that they reuse the letters you have already found, in places you have stopped looking.',
        ],
      },
      {
        heading: 'Why repeats wreck standard deduction',
        body: [
          'The standard system — eliminate grays, relocate yellows, keep greens — silently assumes each letter appears once. Repeats violate it in both directions. A green E in slot 2 does not tell you there is no second E in slot 5. And the tile feedback for a doubled guess against a single-letter answer (one colored, one gray) reads, to most players, like a contradiction rather than a count.',
          'The tell-tale symptom is the "impossible board": you have four confirmed letters, one open slot, and no remaining letter of the alphabet seems to fit. Nine times out of ten the missing letter is not missing at all — it is a second copy of a letter already on the board. When a board feels impossible, repeats should be your first hypothesis, not your last.',
        ],
      },
      {
        heading: 'Detecting a repeat early',
        body: [
          'You can hunt repeats deliberately. If mid-game evidence points toward a common doubler — an E, O, A, L, T, or R confirmed but position-ambiguous — spend a guess on a word that uses that letter twice in the positions still open. The tile colors on the doubled guess resolve the count directly: two colored tiles means the answer really does carry two copies.',
          'Pattern knowledge shortcuts this further. Doubles cluster in recognizable frames: -LL- and -SS- in the middle or end (HELLO-type and CLASS-type shapes), -EE- and -OO- cores (GREEN-type, FLOOR-type), and double letters straddling common endings (-TTER, -NNER). When your surviving candidates include one of these shapes, test it before a fifth single-letter theory.',
        ],
      },
      {
        heading: 'The discipline that saves the row',
        body: [
          'Make one habit change: every time you reach row four with an unsolved board, explicitly ask "what does this look like with a doubled letter?" before guessing. Run the confirmed letters through the double frames — could that yellow L be two Ls? could the E be at both ends? It takes five seconds, and it catches the 32% case before it costs you rows five and six.',
          'Repeats also change multi-board play. In QuadWord and OctoWord, a board that stalls while its siblings solve is disproportionately likely to be hiding a repeat — single-copy answers get swept up by your shared guesses, while doubled answers linger. Prioritize the repeat hypothesis on whichever board has resisted the longest.',
          'For a worked example, browse the Word of the Day archive: every entry flags whether the day’s word repeats a letter and how that repeat changes the solve, so you can build the instinct against real answers.',
        ],
      },
    ],
    related: ['letter-frequency-atlas', 'solve-faster'],
  },
  {
    slug: 'beginner-to-sweeper',
    title: 'From First Guess to Daily Sweeper: A 30-Day Progression Plan',
    description:
      'A structured month-long roadmap through every Wordocious skill tier: tile-reading fundamentals, an opening system, multi-board scanning, twist-mode adaptation, Gauntlet nerve, and finally the full eight-mode Daily Sweep.',
    dek: 'The distance from casual solver to eight-for-eight sweeper is about a month of deliberate play. Here’s the curriculum.',
    minutes: 8,
    sections: [
      {
        heading: 'Days 1–7: own the fundamentals in Classic',
        body: [
          'Spend the first week exclusively in Classic and Practice, with two goals: never reuse a gray letter, and never guess a word that contradicts a yellow’s known exclusions. These sound trivial; they are not. Most streak-ending guesses violate one of them under time pressure. Practice mode exists precisely so you can drill without burning your daily.',
          'Adopt one fixed opener this week — SLATE, CRANE, or any no-repeat word from the high-frequency pool — and play it every game. Fixing the opener converts your first row from a decision into a habit, which frees your full attention for the rows where deduction actually happens.',
        ],
      },
      {
        heading: 'Days 8–14: length changes, system holds',
        body: [
          'Add Six and Seven. The deduction system is unchanged; what changes is vocabulary confidence and vowel structure — longer answers carry more vowels and more multi-syllable shapes, so extend your opener accordingly (a six-letter opener like ORANGE covers the shifted vowel budget).',
          'This week also introduces the endgame frames: common endings like -ER, -ED, -LY, and -TION become dramatically more powerful at six and seven letters, where suffixes make up a larger share of the word. If you learn to see a six-letter board as "four letters plus a frame," the extra length becomes an advantage rather than a threat.',
        ],
      },
      {
        heading: 'Days 15–21: multi-board scanning',
        body: [
          'QuadWord first, then OctoWord. The skill being trained is fundamentally new: instead of deducing one answer deeply, you are triaging many boards quickly. Play a fixed two- or three-word opening across all boards before solving any single one — every board deserves the same broad information base before you commit guesses to kills.',
          'Then solve in order of certainty, not order of position: knock out the board you are surest of, because every solved board effectively refunds information to the others through the shared guess pool. The scanning rhythm — sweep the boards, rank by certainty, solve the surest — is exactly the muscle Gauntlet and the Sweep will demand later.',
        ],
      },
      {
        heading: 'Days 22–30: twists, the Gauntlet, and the Sweep',
        body: [
          'Fold in the twist modes now. Succession rewards chain-thinking and Deliverance rewards budget discipline. For a stretch, open the More Games tile and play ProperNoundle, which deliberately breaks your letter statistics — proper nouns obey different frequency rules, so it trains flexibility more than any word mode. Expect your first ProperNoundle games to feel wrong; that disorientation is the lesson, and it earns XP without touching your sweep.',
          'Gauntlet is the nerve test: five chained stages where one bust ends the run. Enter it only after your Classic average sits comfortably under four guesses, and play it like a mountaineer — conservative information-first guessing on every stage, because the expected cost of a risky guess is the entire run, not one row.',
          'Finally, assemble the Daily Sweep: all eight word modes, one day. Your first sweeps are about stamina and scheduling as much as skill — the composite score that ranks you on the sweep leaderboard rewards both accuracy and pace across the full slate. Once the first sweep lands, the game changes character: the question stops being "can I solve today’s puzzle" and becomes "how clean can the whole day be." That is the sweeper’s mindset, and it is a month away for almost anyone willing to train deliberately.',
        ],
      },
    ],
    related: ['daily-sweep-guide', 'multi-board-mastery'],
  },
  {
    slug: 'vs-battle-tactics',
    title: 'Winning VS Battles: Head-to-Head Word Puzzle Tactics',
    description:
      'Live VS play is a different sport from solo solving: same word, real opponent, first correct solve wins. Opening tempo, when to deviate from coverage, reading the opponent clock, and closing games you’re behind in.',
    dek: 'In VS, a perfect slow solve loses to a sloppy fast one. Speed changes every rule you learned solo.',
    minutes: 7,
    sections: [
      {
        heading: 'What actually decides a VS match',
        body: [
          'In Wordocious VS, you and a live opponent race the same hidden word — first correct solve takes the match. That single change inverts solo priorities: solo play optimizes guesses used, VS play optimizes time to solution. A five-guess solve in ninety seconds beats a three-guess solve in two minutes, every time.',
          'The largest source of lost matches is not bad deduction — it is deliberation. Solo habits teach you to stare at row three until certainty arrives. In VS, the seconds you spend polishing a guess from 70% to 85% confidence are usually worth less than the information the 70% guess would already have bought you. Type the good guess now instead of the great guess later.',
        ],
      },
      {
        heading: 'Tempo openings',
        body: [
          'Your opening two rows should be fully automatic — the same fixed, letter-diverse pair you play in every match, entered as fast as you can physically type them. Any thinking during rows one and two is pure clock donation; there is no board state yet that could improve on a memorized coverage pair.',
          'This is also why a practiced VS player banks a reliable twenty-plus seconds on most opponents before deduction even begins. Two instant rows of ten distinct high-frequency letters put you at the real decision point — rows three through six — ahead on both information and time. The match is usually decided by who reaches that point first, not by who deduces better once there.',
        ],
      },
      {
        heading: 'Risk shifts with the scoreboard',
        body: [
          'VS strategy is situational in a way solo never is. When you sense you are ahead on the clock, play textbook: coverage guesses, clean elimination, take the solve when it is safe. When you are behind — your opponent’s progress bar is moving faster, or the clock has run long — expected value flips toward aggression: commit to your best candidate a row earlier than solo discipline would allow.',
          'The deeper principle: in a race, the value of certainty depends on your position. Leaders buy certainty because time is on their side; trailers sell certainty for speed because a 40% shot at first place beats a 100% chance of a tidy second. Practicing both gears — and noticing which one the match state calls for — is most of VS mastery.',
        ],
      },
      {
        heading: 'The rematch meta and daily VS',
        body: [
          'Matches cluster into sessions — rematches against the same opponent are common, and they carry information. An opponent who opened SLATE twice will open it a third time; if you are trailing in a series, varying your own opener denies them the same read. Across a rematch series, the player who adapts openings, risk timing, and even typing cadence holds a real edge over the player who runs one script.',
          'Daily VS adds a scheduling wrinkle: it sits alongside your eight-mode Daily Sweep rather than inside it, but it is the one daily you cannot fully control — an opponent has a vote. Sweepers should play their VS match early in the day while focus is fresh, rather than leaving the least controllable mode for a tired midnight attempt. Warm up in Practice, run your tempo opening, and treat the first minute as the whole match — because statistically, it is.',
        ],
      },
    ],
    related: ['best-starting-words', 'daily-sweep-guide'],
  },
];

export function getArticle(slug: string): StrategyArticle | undefined {
  return STRATEGY_ARTICLES.find((a) => a.slug === slug);
}
