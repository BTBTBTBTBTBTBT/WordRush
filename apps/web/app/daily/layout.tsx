import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Daily Challenge — Wordocious',
  description: 'Play all 9 daily word puzzles. Same words for everyone — compare your results.',
  openGraph: {
    title: 'Daily Challenge — Wordocious',
    description: 'Play all 9 daily word puzzles. Same words for everyone — compare your results.',
  },
};

// §229 (AdSense "Low value content" verdict, Aug 22): the leaderboard page
// is a client-rendered shell — a crawler saw six words of it, under an ad
// banner. Game pages pass review because their signed-out landing carries
// ~500 words of real explanation; this server-rendered section gives the
// Daily Challenge page the same substance (and new players a real primer).
function DailyChallengeExplainer() {
  return (
    <section
      className="max-w-2xl mx-auto px-5 pt-6 pb-36 text-sm leading-relaxed"
      style={{ color: 'var(--color-text-muted)' }}
      aria-label="About the Daily Challenge"
    >
      <h2 className="text-base font-black mb-2" style={{ color: 'var(--color-text)' }}>
        How the Daily Challenge works
      </h2>
      <p className="mb-3">
        Every day Wordocious deals one fresh puzzle in each of its nine game modes — Classic,
        QuadWord, OctoWord, Succession, Deliverance, Six, Seven, Gauntlet, and ProperNoundle.
        The words are the same for every player in the world that day, so the leaderboard is a
        fair race: everyone faced exactly the same boards. The day rolls over at midnight in your
        local time zone, and each mode can be played once per day.
      </p>
      <h3 className="font-black mt-4 mb-1" style={{ color: 'var(--color-text)' }}>Scoring</h3>
      <p className="mb-3">
        Each result earns a composite score. Guess efficiency matters most — solving in fewer
        guesses is worth far more than solving quickly — and a time bonus rewards speed on top.
        Multi-board modes add a bonus for every board solved, so a loss that cleared seven of
        eight OctoWord boards still scores well above one that cleared two. Hints in Six, Seven,
        and ProperNoundle cost points. Exact ties on score and time share the same rank.
      </p>
      <h3 className="font-black mt-4 mb-1" style={{ color: 'var(--color-text)' }}>The Sweep board</h3>
      <p className="mb-3">
        Finish all nine modes in a day and you have swept. The Sweep leaderboard ranks sweepers
        by their total points across every mode, with total time as the tiebreaker. Win all nine
        and the row earns the gold FLAWLESS badge; the nine dots under each player show how each
        mode went — bright for a near-perfect solve, faded for a slow one, red for a loss.
        Because the ranking is total points, nine slow wins can finish below eight sharp ones.
      </p>
      <h3 className="font-black mt-4 mb-1" style={{ color: 'var(--color-text)' }}>Medals and streaks</h3>
      <p className="mb-3">
        When the day closes, the top three in every mode receive gold, silver, and bronze medals
        that live permanently in their trophy case, and Yesterday&apos;s Winners stays visible for
        a day so the podium can be admired (or contested). Playing at least one daily each day
        builds your streak; the Friends view narrows every board to the people you actually know,
        with a weekly race that resets each Monday.
      </p>
      <p>
        New here? Start with Classic — one five-letter word, six guesses — and work up to the
        Gauntlet, which chains five stages into a single run where one miss ends it.
      </p>
    </section>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <DailyChallengeExplainer />
    </>
  );
}
