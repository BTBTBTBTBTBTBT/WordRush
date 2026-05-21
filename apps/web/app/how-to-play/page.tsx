import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'How to Play Wordocious — Rules, Tips & Game Mode Guide',
  description:
    'Learn how to play Wordocious. Complete guide to all 10 game modes: Classic, VS Battle, QuadWord, OctoWord, Succession, Deliverance, Six, Seven, Gauntlet, and ProperNoundle. Scoring, streaks, medals, and tips for beginners.',
};

function TileExample({ letter, color }: { letter: string; color: 'green' | 'yellow' | 'gray' | 'empty' }) {
  const bg: Record<string, string> = {
    green: '#22c55e',
    yellow: '#eab308',
    gray: '#6b7280',
    empty: 'var(--color-surface)',
  };
  const text: Record<string, string> = {
    green: '#fff',
    yellow: '#fff',
    gray: '#fff',
    empty: 'var(--color-text)',
  };
  const border: Record<string, string> = {
    green: '#22c55e',
    yellow: '#eab308',
    gray: '#6b7280',
    empty: 'var(--color-border)',
  };

  return (
    <span
      className="inline-flex items-center justify-center font-black text-sm rounded"
      style={{
        width: 36,
        height: 36,
        background: bg[color],
        color: text[color],
        border: `2px solid ${border[color]}`,
      }}
    >
      {letter}
    </span>
  );
}

export default function HowToPlayPage() {
  return (
    <div className="min-h-screen pb-12" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-bold mb-6" style={{ color: '#7c3aed' }}>
          <ArrowLeft className="w-4 h-4" />
          Back to Wordocious
        </Link>

        <h1 className="text-3xl font-black mb-2" style={{ color: 'var(--color-text)' }}>How to Play</h1>
        <p className="text-sm font-bold mb-6" style={{ color: 'var(--color-text-muted)' }}>Everything you need to know to get started</p>

        <div className="space-y-4">
          {/* Basic Rules */}
          <div style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '16px' }} className="p-5">
            <h2 className="text-sm font-black mb-2" style={{ color: 'var(--color-text)' }}>The Basics</h2>
            <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--color-text-secondary)' }}>
              Guess the five-letter word. Each guess must be a valid English word. After you submit a guess, the tiles change color to show how close you are to the answer.
            </p>
            <ul className="text-xs leading-relaxed space-y-1.5 mb-4" style={{ color: 'var(--color-text-secondary)' }}>
              <li className="flex gap-2"><span style={{ color: '#7c3aed' }}>&#8226;</span> <span>Type a five-letter word and press Enter to submit your guess</span></li>
              <li className="flex gap-2"><span style={{ color: '#7c3aed' }}>&#8226;</span> <span>Each guess must be a real word from the dictionary</span></li>
              <li className="flex gap-2"><span style={{ color: '#7c3aed' }}>&#8226;</span> <span>Use the color clues from previous guesses to narrow down the answer</span></li>
              <li className="flex gap-2"><span style={{ color: '#7c3aed' }}>&#8226;</span> <span>You have a limited number of guesses depending on the game mode</span></li>
            </ul>

            <h3 className="text-xs font-black mb-2" style={{ color: 'var(--color-text)' }}>Understanding Tile Colors</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex gap-1 flex-shrink-0">
                  <TileExample letter="W" color="green" />
                  <TileExample letter="E" color="empty" />
                  <TileExample letter="A" color="empty" />
                  <TileExample letter="R" color="empty" />
                  <TileExample letter="Y" color="empty" />
                </div>
                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  <strong style={{ color: '#22c55e' }}>Green</strong> &mdash; the letter is in the word and in the correct position.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex gap-1 flex-shrink-0">
                  <TileExample letter="P" color="empty" />
                  <TileExample letter="I" color="yellow" />
                  <TileExample letter="L" color="empty" />
                  <TileExample letter="L" color="empty" />
                  <TileExample letter="S" color="empty" />
                </div>
                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  <strong style={{ color: '#eab308' }}>Yellow</strong> &mdash; the letter is in the word but in the wrong position.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex gap-1 flex-shrink-0">
                  <TileExample letter="V" color="empty" />
                  <TileExample letter="A" color="empty" />
                  <TileExample letter="G" color="empty" />
                  <TileExample letter="U" color="gray" />
                  <TileExample letter="E" color="empty" />
                </div>
                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  <strong style={{ color: '#6b7280' }}>Gray</strong> &mdash; the letter is not in the word at all.
                </p>
              </div>
            </div>
          </div>

          {/* Game Mode Details */}
          <div style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '16px' }} className="p-5">
            <h2 className="text-sm font-black mb-3" style={{ color: 'var(--color-text)' }}>Game Mode Guide</h2>

            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-black mb-1" style={{ color: '#7c3aed' }}>Classic &mdash; 1 Word, 6 Guesses</h3>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                  The standard word puzzle experience. You have six attempts to guess a single five-letter word. Start with a word that contains common letters like E, A, R, S, and T to eliminate possibilities quickly. Pay attention to gray tiles &mdash; knowing which letters are not in the word is just as valuable as finding correct ones.
                </p>
              </div>

              <div>
                <h3 className="text-xs font-black mb-1" style={{ color: '#0d9488' }}>VS Battle &mdash; Real-Time Multiplayer</h3>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                  Challenge another player to a head-to-head race. Both players see the same word and compete to solve it first. The match happens in real time &mdash; you can see when your opponent submits guesses. Speed matters, but accuracy matters more. A wrong guess wastes precious time. Challenge friends directly or get matched with a random opponent of similar skill.
                </p>
              </div>

              <div>
                <h3 className="text-xs font-black mb-1" style={{ color: '#ec4899' }}>QuadWord &mdash; 4 Words, 9 Guesses</h3>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                  Solve four different words at the same time using a shared pool of nine guesses. Every word you type is checked against all four boards simultaneously. The strategy shifts compared to Classic &mdash; choose guesses that give useful information across multiple boards rather than targeting a single word. Once a board is solved, it locks in and you can focus on the remaining ones.
                </p>
              </div>

              <div>
                <h3 className="text-xs font-black mb-1" style={{ color: '#7e22ce' }}>OctoWord &mdash; 8 Words, 13 Guesses</h3>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                  The biggest multi-board challenge in Wordocious. Eight words, thirteen guesses, and every guess applies to all unsolved boards. This mode rewards broad vocabulary and strategic opening words. Start with guesses that use many different common letters to light up as many boards as possible before narrowing down individual answers.
                </p>
              </div>

              <div>
                <h3 className="text-xs font-black mb-1" style={{ color: '#2563eb' }}>Succession &mdash; 4 Words in Sequence, 10 Guesses</h3>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                  Four puzzles solved one after another, sharing a total pool of ten guesses. Solve the first word to reveal the second, and so on. The challenge is budget management &mdash; if you spend too many guesses on early words, you will not have enough for the later ones. Aim to solve each word in two to three guesses to stay on track.
                </p>
              </div>

              <div>
                <h3 className="text-xs font-black mb-1" style={{ color: '#059669' }}>Deliverance &mdash; 4 Boards with Hints, 6 Guesses</h3>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                  Four boards that come pre-loaded with letter hints to give you a head start. Some tiles are already revealed before you make your first guess. With only six guesses to solve all four words, you need to use the given hints wisely. Look for patterns in the revealed letters to deduce the answers quickly.
                </p>
              </div>

              <div>
                <h3 className="text-xs font-black mb-1" style={{ color: '#06b6d4' }}>Six &mdash; 6-Letter Words, 7 Guesses</h3>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                  The same Classic rules applied to six-letter words. You get seven guesses to find the answer. The extra letter opens up a much wider pool of possible words, demanding deeper vocabulary knowledge and more strategic letter placement. A natural step up for players who have mastered the five-letter format.
                </p>
              </div>

              <div>
                <h3 className="text-xs font-black mb-1" style={{ color: '#84cc16' }}>Seven &mdash; 7-Letter Words, 8 Guesses</h3>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                  The biggest single-word challenge in Wordocious. Seven-letter words with eight guesses push your vocabulary and deduction skills to their absolute limits. With thousands of possible solutions, every guess needs to eliminate as many possibilities as it can. Recommended for experienced players looking for a real test.
                </p>
              </div>

              <div>
                <h3 className="text-xs font-black mb-1" style={{ color: '#d97706' }}>Gauntlet &mdash; 5 Stages of Increasing Difficulty</h3>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                  A multi-stage endurance test. You start with a single Classic puzzle, then face progressively harder challenges through QuadWord and OctoWord-style stages. Each stage is more demanding than the last. Completing the full Gauntlet requires consistent performance across every difficulty level. Only the most skilled players finish all five stages.
                </p>
              </div>

              <div>
                <h3 className="text-xs font-black mb-1" style={{ color: '#dc2626' }}>ProperNoundle &mdash; Famous Names &amp; Cultural References</h3>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                  A twist on the classic formula: instead of dictionary words, you guess proper nouns &mdash; famous people, places, landmarks, and cultural references. Each daily puzzle belongs to a themed category such as current events, music, movies, sports, video games, history, or science. The answer can be multiple words long, and the board displays word breaks to help you visualize the full name. With over 670 puzzles in the pool, every day brings a fresh challenge.
                </p>
              </div>
            </div>
          </div>

          {/* Scoring */}
          <div style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '16px' }} className="p-5">
            <h2 className="text-sm font-black mb-2" style={{ color: 'var(--color-text)' }}>Scoring System</h2>
            <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--color-text-secondary)' }}>
              Every solved puzzle earns a score calculated from three components:
            </p>
            <ul className="text-xs leading-relaxed space-y-1.5 mb-3" style={{ color: 'var(--color-text-secondary)' }}>
              <li className="flex gap-2"><span style={{ color: '#7c3aed' }}>&#8226;</span> <span><strong>Base score (1,000 points)</strong> &mdash; awarded for solving the puzzle regardless of performance</span></li>
              <li className="flex gap-2"><span style={{ color: '#7c3aed' }}>&#8226;</span> <span><strong>Guess bonus</strong> &mdash; earn extra points for using fewer guesses. Solving in fewer attempts earns a larger bonus</span></li>
              <li className="flex gap-2"><span style={{ color: '#7c3aed' }}>&#8226;</span> <span><strong>Speed bonus</strong> &mdash; finish faster to earn more points. The clock starts when the puzzle loads and stops when you submit the winning guess</span></li>
              <li className="flex gap-2"><span style={{ color: '#7c3aed' }}>&#8226;</span> <span><strong>Completion bonus (200 points)</strong> &mdash; awarded for fully completing the puzzle</span></li>
            </ul>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
              For example, solving a Classic puzzle in 4 guesses in 13 seconds would earn approximately 1,000 (base) + 200 (guess bonus) + 287 (speed bonus) + 200 (completion) = 1,687 points.
            </p>
          </div>

          {/* XP & Levels */}
          <div style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '16px' }} className="p-5">
            <h2 className="text-sm font-black mb-2" style={{ color: 'var(--color-text)' }}>XP, Levels &amp; Achievements</h2>
            <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--color-text-secondary)' }}>
              Every game earns experience points that contribute to your overall level:
            </p>
            <ul className="text-xs leading-relaxed space-y-1.5 mb-3" style={{ color: 'var(--color-text-secondary)' }}>
              <li className="flex gap-2"><span style={{ color: '#7c3aed' }}>&#8226;</span> <span><strong>Win:</strong> 100 XP</span></li>
              <li className="flex gap-2"><span style={{ color: '#7c3aed' }}>&#8226;</span> <span><strong>Loss:</strong> 25 XP (you still earn XP for trying)</span></li>
              <li className="flex gap-2"><span style={{ color: '#7c3aed' }}>&#8226;</span> <span><strong>Win streak bonus:</strong> +50 XP</span></li>
              <li className="flex gap-2"><span style={{ color: '#7c3aed' }}>&#8226;</span> <span><strong>Daily challenge bonus:</strong> +50 XP</span></li>
              <li className="flex gap-2"><span style={{ color: '#7c3aed' }}>&#8226;</span> <span><strong>Medal XP:</strong> Gold +100, Silver +50, Bronze +25</span></li>
            </ul>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
              Every 1,000 XP advances you one level. Your level and total XP are displayed on your profile alongside your achievements, medal collection, and lifetime statistics.
            </p>
          </div>

          {/* Streaks & Shields */}
          <div style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '16px' }} className="p-5">
            <h2 className="text-sm font-black mb-2" style={{ color: 'var(--color-text)' }}>Streaks &amp; Streak Shields</h2>
            <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--color-text-secondary)' }}>
              Play at least one daily puzzle each day to build your streak. Your streak counter increases by one every consecutive day you play. Miss a day and the streak resets to zero.
            </p>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
              Streak Shields are special items that protect your streak if you miss a day. When you miss a day and have a shield available, it is automatically used to keep your streak alive. Shields can be earned through gameplay milestones and achievements.
            </p>
          </div>

          {/* Tips */}
          <div style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '16px' }} className="p-5">
            <h2 className="text-sm font-black mb-2" style={{ color: 'var(--color-text)' }}>Tips for New Players</h2>
            <ul className="text-xs leading-relaxed space-y-1.5" style={{ color: 'var(--color-text-secondary)' }}>
              <li className="flex gap-2"><span style={{ color: '#7c3aed' }}>&#8226;</span> <span><strong>Start with vowel-heavy words.</strong> Words like ARISE, AUDIO, or OUIJA test multiple vowels in your first guess and quickly reveal which vowels are in play.</span></li>
              <li className="flex gap-2"><span style={{ color: '#7c3aed' }}>&#8226;</span> <span><strong>Pay attention to gray tiles.</strong> Eliminating letters is just as useful as finding correct ones. Cross off letters mentally to narrow the possibilities.</span></li>
              <li className="flex gap-2"><span style={{ color: '#7c3aed' }}>&#8226;</span> <span><strong>Think about letter frequency.</strong> Common consonants like R, S, T, L, and N appear in many words. Use them early to gather information.</span></li>
              <li className="flex gap-2"><span style={{ color: '#7c3aed' }}>&#8226;</span> <span><strong>In multi-board modes, think broadly.</strong> Pick guesses that use many different letters rather than targeting one specific board.</span></li>
              <li className="flex gap-2"><span style={{ color: '#7c3aed' }}>&#8226;</span> <span><strong>In Succession, be conservative early.</strong> Solving the first word in two guesses leaves you with eight for the remaining three &mdash; a much more comfortable budget.</span></li>
              <li className="flex gap-2"><span style={{ color: '#7c3aed' }}>&#8226;</span> <span><strong>Play every day.</strong> Even a single daily puzzle builds your streak and earns bonus XP. Consistency is rewarded.</span></li>
            </ul>
          </div>

          {/* Links */}
          <div style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '16px' }} className="p-5">
            <h2 className="text-sm font-black mb-3" style={{ color: 'var(--color-text)' }}>More Information</h2>
            <div className="flex flex-wrap gap-3">
              <Link href="/about" className="text-xs font-bold underline" style={{ color: '#7c3aed' }}>About Wordocious</Link>
              <Link href="/privacy" className="text-xs font-bold underline" style={{ color: '#7c3aed' }}>Privacy Policy</Link>
              <Link href="/terms" className="text-xs font-bold underline" style={{ color: '#7c3aed' }}>Terms of Service</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
