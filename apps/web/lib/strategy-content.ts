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
];

export function getArticle(slug: string): StrategyArticle | undefined {
  return STRATEGY_ARTICLES.find((a) => a.slug === slug);
}
