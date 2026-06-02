import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Wordocious FAQ & Strategy — Tips for Every Word Game Mode',
  description:
    'Answers to common Wordocious questions plus word-game strategy: best starting words, how to read green/yellow/gray tiles, juggling multi-board modes like QuadWord and OctoWord, beating the Gauntlet, and scoring higher on daily leaderboards.',
};

const SECTIONS: { heading: string; items: { q: string; a: string }[] }[] = [
  {
    heading: 'Getting Started',
    items: [
      { q: 'Is Wordocious free?', a: 'Yes — a new daily puzzle in every mode is free, every day. An optional Pro subscription removes ads and unlocks unlimited replays beyond the daily, but the daily puzzles and leaderboards are always free.' },
      { q: 'Do I need an account to play?', a: 'You can browse every mode and read these guides without an account. To play, save streaks, earn medals, and appear on the daily leaderboards, sign in with Google or an email address.' },
      { q: 'How often do new puzzles appear?', a: 'Every mode gets one fresh puzzle per day, resetting at your local midnight. Everyone worldwide gets the same daily words, so scores are directly comparable.' },
    ],
  },
  {
    heading: 'How the Tiles Work',
    items: [
      { q: 'What do the tile colors mean?', a: 'Green means the letter is correct and in the right position. Yellow means the letter is in the word but in a different spot. Gray means the letter is not in the word at all. Use these clues to eliminate possibilities with each guess.' },
      { q: 'What happens with repeated letters?', a: 'Each tile is judged independently. If your guess has two of a letter but the answer has only one, one tile shows the matching color and the extra shows gray — a subtle clue that the letter appears only once.' },
    ],
  },
  {
    heading: 'Strategy Tips',
    items: [
      { q: 'What is a good starting word?', a: 'Open with a word rich in common letters and vowels — words like AROSE, RAISE, SLATE, or CRANE test five high-frequency letters at once and quickly narrow the field. Avoid repeated letters in your opener so every tile gives new information.' },
      { q: 'How do I solve multi-board modes (QuadWord, OctoWord)?', a: 'Every guess applies to all boards simultaneously, so spend your first two or three guesses on broad letter-coverage words rather than chasing any single board. Once a board has a few greens, lock it in, then pivot your remaining guesses to the boards with the least information.' },
      { q: 'Any tips for the Gauntlet?', a: 'The Gauntlet chains five escalating stages into one run with a shared guess budget, so efficiency compounds. Bank guesses early on the easier stages — solving in three instead of five leaves a cushion for the harder boards later. Reuse confirmed letters across stages where the layout allows.' },
      { q: 'How do I win Six and Seven?', a: 'Longer words have more structure: prefixes, suffixes, and common letter pairs (TH, CH, ING, ER). Once you have a couple of greens, think about which affixes fit. The extra guesses (seven and eight) give you room to probe letter positions methodically.' },
      { q: 'How do I score higher on the leaderboard?', a: 'Daily rank is a composite of how few guesses you used and how fast you solved. Solving in fewer guesses matters most, but speed breaks ties — so know your opening word cold and do not overthink the easy boards.' },
    ],
  },
  {
    heading: 'Progress, Medals & Pro',
    items: [
      { q: 'What is a Daily Sweep and a Flawless Victory?', a: 'Completing all of the day’s puzzles earns a Daily Sweep and bonus XP. Winning every one of them (not just completing) earns a Flawless Victory and a larger bonus. Streaks of sweeps and flawless days unlock achievements.' },
      { q: 'How do medals work?', a: 'Each daily puzzle has a leaderboard; the top finishers earn gold, silver, and bronze medals that accumulate on your profile. Medal counts feed several collection achievements.' },
      { q: 'Are there achievements to earn?', a: 'Yes — 70 achievements span five categories: beginner milestones, consistency (streaks and daily sweeps), skill (speed solves, perfect games, beating the Gauntlet), social (VS wins), and collection (medals). They unlock automatically as you hit each milestone, and your full set — locked and unlocked, with progress toward each — is displayed on your profile, so there is always a next goal to chase.' },
      { q: 'What does Pro unlock?', a: 'Pro removes ads, gives unlimited replays of every mode beyond the free daily, adds VS battles in every mode, grants streak shields, a profile badge, and extended stats. The daily puzzles stay free for everyone.' },
    ],
  },
];

export default function FaqPage() {
  return (
    <div className="min-h-screen pb-12" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-bold mb-6" style={{ color: '#7c3aed' }}>
          <ArrowLeft className="w-4 h-4" />
          Back to Wordocious
        </Link>

        <h1 className="text-3xl font-black mb-2" style={{ color: 'var(--color-text)' }}>FAQ &amp; Strategy</h1>
        <p className="text-sm font-bold mb-6" style={{ color: 'var(--color-text-muted)' }}>
          Everything you need to start winning at Wordocious
        </p>

        <div className="space-y-4">
          {SECTIONS.map((section) => (
            <div key={section.heading} className="p-5" style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '16px' }}>
              <h2 className="text-sm font-black mb-3" style={{ color: 'var(--color-text)' }}>{section.heading}</h2>
              <div className="space-y-3">
                {section.items.map((item) => (
                  <div key={item.q}>
                    <h3 className="text-xs font-black mb-0.5" style={{ color: '#7c3aed' }}>{item.q}</h3>
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{item.a}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="p-5 text-center" style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '16px' }}>
            <p className="text-xs font-bold mb-1" style={{ color: 'var(--color-text)' }}>Ready to play?</p>
            <Link href="/" className="text-sm font-extrabold" style={{ color: '#7c3aed' }}>Start today&apos;s puzzles →</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
