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
      'A structured month-long roadmap through every Wordocious skill tier: tile-reading fundamentals, an opening system, multi-board scanning, twist-mode adaptation, Gauntlet nerve, and finally the full nine-mode Daily Sweep.',
    dek: 'The distance from casual solver to nine-for-nine sweeper is about a month of deliberate play. Here’s the curriculum.',
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
          'Fold in the twist modes now. Succession rewards chain-thinking, Deliverance rewards budget discipline, and ProperNoundle deliberately breaks your letter statistics — proper nouns obey different frequency rules, so it trains flexibility more than any other mode. Expect your first ProperNoundle games to feel wrong; that disorientation is the lesson.',
          'Gauntlet is the nerve test: five chained stages where one bust ends the run. Enter it only after your Classic average sits comfortably under four guesses, and play it like a mountaineer — conservative information-first guessing on every stage, because the expected cost of a risky guess is the entire run, not one row.',
          'Finally, assemble the Daily Sweep: all nine modes, one day. Your first sweeps are about stamina and scheduling as much as skill — the composite score that ranks you on the sweep leaderboard rewards both accuracy and pace across the full slate. Once the first sweep lands, the game changes character: the question stops being "can I solve today’s puzzle" and becomes "how clean can the whole day be." That is the sweeper’s mindset, and it is a month away for almost anyone willing to train deliberately.',
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
          'Daily VS adds a scheduling wrinkle: the day’s VS result is part of your nine-mode Daily Sweep, and it is the one mode you cannot fully control — an opponent has a vote. Sweepers should play their VS match early in the day while focus is fresh, rather than leaving the least controllable mode for a tired midnight attempt. Warm up in Practice, run your tempo opening, and treat the first minute as the whole match — because statistically, it is.',
        ],
      },
    ],
    related: ['best-starting-words', 'daily-sweep-guide'],
  },
];

export function getArticle(slug: string): StrategyArticle | undefined {
  return STRATEGY_ARTICLES.find((a) => a.slug === slug);
}
