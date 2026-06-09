import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About Wordocious — Epic Word Battles',
  description:
    'Wordocious is a free online word puzzle game with 10 unique game modes including Classic, QuadWord, OctoWord, Succession, Deliverance, Six, Seven, Gauntlet, ProperNoundle, and real-time VS Battles. Play daily puzzles, climb leaderboards, and compete with friends.',
};

export default function AboutPage() {
  return (
    <div className="min-h-screen pb-12" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-bold mb-6" style={{ color: '#7c3aed' }}>
          <ArrowLeft className="w-4 h-4" />
          Back to Wordocious
        </Link>

        <h1 className="text-3xl font-black mb-2" style={{ color: 'var(--color-text)' }}>About Wordocious</h1>
        <p className="text-sm font-bold mb-6" style={{ color: 'var(--color-text-muted)' }}>Epic Word Battles &mdash; Daily Puzzles &amp; Multiplayer Showdowns</p>

        <div className="space-y-4">
          {/* Intro */}
          <div style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '16px' }} className="p-5">
            <h2 className="text-sm font-black mb-2" style={{ color: 'var(--color-text)' }}>What is Wordocious?</h2>
            <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--color-text-secondary)' }}>
              Wordocious is a free word puzzle game that goes far beyond the classic five-letter guess. With ten distinct game modes, daily challenges, real-time multiplayer battles, and global leaderboards, Wordocious gives word game fans something new to play every single day.
            </p>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
              Whether you enjoy a quick solo puzzle on your morning commute or a competitive showdown against friends, Wordocious has a mode for you. Every daily puzzle is the same for all players worldwide, so you can compare scores and strategies with anyone.
            </p>
          </div>

          {/* Game Modes Overview */}
          <div style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '16px' }} className="p-5">
            <h2 className="text-sm font-black mb-3" style={{ color: 'var(--color-text)' }}>10 Unique Game Modes</h2>
            <div className="space-y-3">
              <div>
                <h3 className="text-xs font-black" style={{ color: '#7c3aed' }}>Classic</h3>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                  The original word puzzle formula. Guess a single five-letter word in six attempts. After each guess, colored tiles reveal which letters are correct, misplaced, or not in the word at all. A perfect starting point for new players and a daily ritual for veterans.
                </p>
              </div>
              <div>
                <h3 className="text-xs font-black" style={{ color: '#0d9488' }}>VS Battle</h3>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                  Race against another player in real time. Both players receive the same word and compete to solve it first. Speed and accuracy both matter &mdash; the fastest correct solve wins the round. Challenge friends or get matched with a random opponent.
                </p>
              </div>
              <div>
                <h3 className="text-xs font-black" style={{ color: '#ec4899' }}>QuadWord</h3>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                  Solve four words simultaneously with just nine total guesses. Every guess you type applies to all four boards at once, so you need to think strategically about which letters give you the most information across all four puzzles.
                </p>
              </div>
              <div>
                <h3 className="text-xs font-black" style={{ color: '#7e22ce' }}>OctoWord</h3>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                  The ultimate multi-board challenge. Eight words, thirteen guesses, and the same simultaneous-solve mechanic as QuadWord. Managing eight boards at once demands careful planning and a deep vocabulary.
                </p>
              </div>
              <div>
                <h3 className="text-xs font-black" style={{ color: '#2563eb' }}>Succession</h3>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                  Four words solved in sequence. Finish one puzzle to unlock the next, but all four share a single pool of ten guesses. Balancing speed against guess conservation is key &mdash; waste too many guesses early and the later words become nearly impossible.
                </p>
              </div>
              <div>
                <h3 className="text-xs font-black" style={{ color: '#059669' }}>Deliverance</h3>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                  Four boards with pre-filled letter hints to help you get started. You have six guesses to solve all four words. The hints give you a head start, but the tight guess limit keeps things challenging. A great mode for players who enjoy deduction puzzles.
                </p>
              </div>
              <div>
                <h3 className="text-xs font-black" style={{ color: '#06b6d4' }}>Six</h3>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                  Step up from the classic formula with six-letter words and seven guesses. The extra letter opens up a much wider vocabulary, demanding sharper deduction and broader word knowledge. Same rules, bigger challenge.
                </p>
              </div>
              <div>
                <h3 className="text-xs font-black" style={{ color: '#84cc16' }}>Seven</h3>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                  The ultimate single-word challenge. Seven-letter words with eight guesses push your vocabulary to its limits. With thousands of possible solutions, every guess counts. Only the most dedicated word game masters will conquer Seven consistently.
                </p>
              </div>
              <div>
                <h3 className="text-xs font-black" style={{ color: '#d97706' }}>Gauntlet</h3>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                  Five stages of increasing difficulty, starting with a Classic single-word puzzle and building up through QuadWord and OctoWord. Survive all five stages to complete the Gauntlet. Each stage is harder than the last, testing your endurance and skill.
                </p>
              </div>
              <div>
                <h3 className="text-xs font-black" style={{ color: '#dc2626' }}>ProperNoundle</h3>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                  Instead of dictionary words, guess famous names, places, and cultural references. Each daily puzzle is themed &mdash; categories include current events, music, movies, sports, video games, history, and science. With over 670 unique puzzles, there is always something new to discover.
                </p>
              </div>
            </div>
          </div>

          {/* Daily Challenges & Streaks */}
          <div style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '16px' }} className="p-5">
            <h2 className="text-sm font-black mb-2" style={{ color: 'var(--color-text)' }}>Daily Challenges &amp; Streaks</h2>
            <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--color-text-secondary)' }}>
              Every game mode features a daily puzzle that resets at midnight in your local time. All players receive the same daily puzzle each day, making it easy to compare results with friends, family, or the global community.
            </p>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
              Play at least one daily puzzle each day to build your streak. Streaks reward consistency &mdash; the longer your streak, the more bonus XP you earn. If life gets in the way, Streak Shields can protect your streak from a missed day.
            </p>
          </div>

          {/* Leaderboards & Competition */}
          <div style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '16px' }} className="p-5">
            <h2 className="text-sm font-black mb-2" style={{ color: 'var(--color-text)' }}>Leaderboards &amp; Competition</h2>
            <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--color-text-secondary)' }}>
              Compete for the top spot on daily leaderboards across every game mode. Gold, silver, and bronze medals are awarded to the top performers each day, and your medal collection is displayed on your profile for everyone to see.
            </p>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
              Your profile tracks lifetime statistics including total games played, win rates, average scores, best streaks, and achievements. Level up by earning XP from wins, streaks, and daily challenges.
            </p>
          </div>

          {/* Scoring */}
          <div style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '16px' }} className="p-5">
            <h2 className="text-sm font-black mb-2" style={{ color: 'var(--color-text)' }}>How Scoring Works</h2>
            <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--color-text-secondary)' }}>
              Every completed puzzle earns a score based on three factors: a base score for solving the puzzle, a guess bonus for using fewer attempts, and a speed bonus for finishing quickly. Fewer guesses and faster times produce higher scores.
            </p>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
              XP is earned from every game: 100 XP for a win, 25 XP for a loss, plus bonuses for win streaks, daily challenges, and medal placements. Every 1,000 XP advances you one level.
            </p>
          </div>

          {/* Free & Pro */}
          <div style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '16px' }} className="p-5">
            <h2 className="text-sm font-black mb-2" style={{ color: 'var(--color-text)' }}>Free to Play</h2>
            <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--color-text-secondary)' }}>
              Wordocious is completely free to play. Every game mode, every daily puzzle, and every leaderboard is accessible without paying. Free players get one attempt per game mode per day.
            </p>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
              Wordocious Pro unlocks unlimited daily plays across all game modes and removes advertisements for an ad-free experience.
            </p>
          </div>

          {/* Links */}
          <div style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '16px' }} className="p-5">
            <h2 className="text-sm font-black mb-3" style={{ color: 'var(--color-text)' }}>More Information</h2>
            <div className="flex flex-wrap gap-3">
              <Link href="/how-to-play" className="text-xs font-bold underline" style={{ color: '#7c3aed' }}>How to Play</Link>
              <Link href="/privacy" className="text-xs font-bold underline" style={{ color: '#7c3aed' }}>Privacy Policy</Link>
              <Link href="/terms" className="text-xs font-bold underline" style={{ color: '#7c3aed' }}>Terms of Service</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
