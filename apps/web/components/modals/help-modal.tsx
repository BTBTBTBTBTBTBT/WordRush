'use client';

import { useState, useEffect, useRef } from 'react';

import { X, Swords, TrendingUp, Shield, Skull, Crown } from 'lucide-react';
import { WordleGridIcon } from '@/components/ui/wordle-grid-icon';
import { SixIcon } from '@/components/ui/six-icon';
import { SevenIcon } from '@/components/ui/seven-icon';
import { useFocusTrap } from '@/hooks/use-focus-trap';

type HelpTab = 'how-to-play' | 'modes' | 'faq';

interface HelpModalProps {
  open: boolean;
  onClose: () => void;
}

/** A single example tile */
function ExampleTile({ letter, color }: { letter: string; color: 'green' | 'yellow' | 'gray' | 'empty' }) {
  const styles = {
    green: 'bg-green-500 border-green-500 text-white',
    yellow: 'bg-yellow-500 border-yellow-500 text-white',
    gray: 'bg-gray-500 border-gray-500 text-white',
    empty: 'bg-white border-gray-300 text-gray-800',
  };

  return (
    <div
      className={`w-9 h-9 flex items-center justify-center border-2 rounded font-black text-sm ${styles[color]}`}
    >
      {letter}
    </div>
  );
}

/** A row of 5 example tiles with a caption */
function ExampleRow({ letters, colors, caption }: {
  letters: string[];
  colors: ('green' | 'yellow' | 'gray' | 'empty')[];
  caption: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex gap-1 justify-center">
        {letters.map((letter, i) => (
          <ExampleTile key={i} letter={letter} color={colors[i]} />
        ))}
      </div>
      <p className="text-xs text-center" style={{ color: 'var(--color-text-secondary)' }}>{caption}</p>
    </div>
  );
}

const TABS: { id: HelpTab; label: string }[] = [
  { id: 'how-to-play', label: 'How to Play' },
  { id: 'modes', label: 'Game Modes' },
  { id: 'faq', label: 'FAQ' },
];

const GAME_MODES = [
  {
    icon: WordleGridIcon,
    title: 'Classic',
    desc: '1 word, 6 guesses. The original formula.',
    color: '#7c3aed',
  },
  {
    icon: Swords,
    title: 'VS Battle',
    desc: 'Race an opponent in real-time. First to solve wins.',
    color: '#0d9488',
  },
  {
    icon: null,
    romanNumeral: 'IV',
    title: 'QuadWord',
    desc: '4 words at once. 9 guesses total. Each guess applies to all 4 boards.',
    color: '#ec4899',
  },
  {
    icon: null,
    romanNumeral: 'VIII',
    title: 'OctoWord',
    desc: '8 words at once. 13 guesses. Same idea, bigger challenge.',
    color: '#7e22ce',
  },
  {
    icon: TrendingUp,
    title: 'Succession',
    desc: '4 words solved in order. Solve one to unlock the next. 10 guesses total.',
    color: '#2563eb',
  },
  {
    icon: Shield,
    title: 'Deliverance',
    desc: '4 boards with pre-filled hints to get you started. 6 guesses to solve them all.',
    color: '#059669',
  },
  {
    icon: SixIcon,
    title: 'Six',
    desc: 'Guess a 6-letter word in 7 tries. Same rules as Classic, bigger vocabulary.',
    color: '#06b6d4',
  },
  {
    icon: SevenIcon,
    title: 'Seven',
    desc: 'Guess a 7-letter word in 8 tries. The ultimate single-word challenge.',
    color: '#84cc16',
  },
  {
    icon: Skull,
    title: 'Gauntlet',
    desc: '5 stages of increasing difficulty — Classic through OctoWord. Survive them all.',
    color: '#d97706',
  },
  {
    icon: Crown,
    title: 'ProperNoundle',
    desc: 'Guess famous names instead of dictionary words. Themed daily puzzles.',
    color: '#dc2626',
  },
];

const FAQ_ITEMS = [
  {
    q: 'How are scores calculated?',
    a: "Solving earns a 1,000-point base, plus a speed bonus (your mode's time cap minus your solve time — faster is better) and a completion bonus of up to 200, scaled by how many boards you solved. Six, Seven, and ProperNoundle also add a guess bonus for solving in fewer guesses. Example: a Classic solve in 27s scores 1,000 + 273 (speed) + 200 (completion) = 1,473. Your daily-leaderboard rank is based on this composite score.",
  },
  {
    q: 'Do hints affect my score?',
    a: 'Yes. In Six, Seven, and ProperNoundle you can reveal a hint, but each one is subtracted from your score — 120 points per hint in ProperNoundle and 150 in Six and Seven. Hints never push a winning score below zero, and modes without hint buttons are unaffected.',
  },
  {
    q: 'How do XP and levels work?',
    a: "Win = 100 XP, loss = 25 XP. Bonuses: +50 for a win streak, +50 for a daily challenge, and medal XP (gold +100, silver +50, bronze +25). Play all 9 of the day's puzzles for a Daily Sweep (+200 XP), and win every one for a Flawless Victory (+400 XP more — 600 total). Every 1,000 XP = 1 level.",
  },
  {
    q: 'How do medals work?',
    a: "Finish in the top three of a mode's daily leaderboard to earn a gold, silver, or bronze medal, with extra medals for streak milestones and perfect games. Your medal tally is shown on your profile.",
  },
  {
    q: 'Are there achievements?',
    a: 'Yes — 70 achievements to unlock across beginner, consistency, skill, social, and collection challenges, from your First Win to a flawless Gauntlet run, 30-day streaks, winning 50 games in a single mode, and big medal hauls. They unlock automatically as you play, and your full collection (with progress toward each one) lives on your profile.',
  },
  {
    q: "What's a streak?",
    a: 'Play at least one daily puzzle each day to build your daily streak. Puzzles reset at your local midnight, and missing a day resets the streak — unless a Streak Shield saves it.',
  },
  {
    q: 'What are Streak Shields?',
    a: 'A Streak Shield automatically protects your streak the first time you miss a day. You earn shields through gameplay milestones, and your current count appears in the header.',
  },
  {
    q: 'What does PRO unlock?',
    a: 'PRO removes all ads and unlocks unlimited replays (free players get one play per mode per day), Unlimited mode for endless fresh puzzles, deep Pro Insights stats, and VS extras like sending invites and rematches.',
  },
  {
    q: 'Do daily puzzles use the same words for everyone?',
    a: 'Yes! Every player gets the same daily puzzles, so you can compare results on the leaderboard.',
  },
];

function HowToPlayContent() {
  return (
    <div className="space-y-4">
      <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
        Guess the 5-letter word. Each guess must be a valid word. After each guess, the tiles change color to show how close you are.
      </p>

      <div className="space-y-4">
        <ExampleRow
          letters={['W', 'E', 'A', 'R', 'Y']}
          colors={['green', 'empty', 'empty', 'empty', 'empty']}
          caption={<><strong className="text-green-600">W</strong> is in the word and in the correct spot.</>}
        />
        <ExampleRow
          letters={['P', 'I', 'L', 'L', 'S']}
          colors={['empty', 'yellow', 'empty', 'empty', 'empty']}
          caption={<><strong className="text-yellow-500">I</strong> is in the word but in the wrong spot.</>}
        />
        <ExampleRow
          letters={['V', 'A', 'G', 'U', 'E']}
          colors={['empty', 'empty', 'empty', 'gray', 'empty']}
          caption={<><strong className="text-gray-500">U</strong> is not in the word at all.</>}
        />
      </div>

      <div
        className="px-3 py-2.5 rounded-xl text-xs font-medium"
        style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
      >
        Daily puzzles reset at your local midnight. Every player gets the same word of the day so you can compare results.
      </div>
    </div>
  );
}

function GameModesContent() {
  return (
    <div className="space-y-2">
      {GAME_MODES.map((mode) => {
        const Icon = mode.icon;
        return (
          <div
            key={mode.title}
            className="flex items-start gap-3 px-3 py-2.5 rounded-xl"
            style={{ background: 'var(--color-surface-hover)', border: '1px solid var(--color-divider)' }}
          >
            <div
              className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: `${mode.color}18` }}
            >
              {mode.romanNumeral ? (
                <span className="text-[11px] font-black leading-none" style={{ color: mode.color }}>{mode.romanNumeral}</span>
              ) : Icon ? (
                <Icon className="w-4 h-4" style={{ color: mode.color }} />
              ) : null}
            </div>
            <div className="min-w-0">
              <span className="text-sm font-black" style={{ color: 'var(--color-text)' }}>{mode.title}</span>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>{mode.desc}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FAQContent() {
  return (
    <div className="space-y-3">
      {FAQ_ITEMS.map((item, i) => (
        <div key={i}>
          <h4 className="text-sm font-black" style={{ color: 'var(--color-text)' }}>{item.q}</h4>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>{item.a}</p>
        </div>
      ))}
    </div>
  );
}

export function HelpModal({ open, onClose }: HelpModalProps) {
  const [activeTab, setActiveTab] = useState<HelpTab>('how-to-play');
  const focusRef = useRef<HTMLDivElement>(null);
  useFocusTrap(focusRef, open);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-modal-overlay"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
          onClick={onClose}
        >
          <div
            ref={focusRef}
            className="relative w-full max-w-sm animate-modal-content"
            style={{
              background: 'var(--color-surface)',
              border: '1.5px solid var(--color-border)',
              borderRadius: '20px',
              overflow: 'hidden',
              boxShadow: '0 20px 60px rgba(0,0,0,0.12)',
              height: 'min(540px, calc(100vh - 60px))',
              display: 'flex',
              flexDirection: 'column',
            }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Help"
          >
            {/* Top accent bar */}
            <div
              className="h-1.5 flex-shrink-0"
              style={{
                background: 'linear-gradient(90deg, #a78bfa, #ec4899, #fbbf24)',
              }}
            />

            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 transition-opacity hover:opacity-80 z-10"
              style={{ color: 'var(--color-text-muted)' }}
              aria-label="Close"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>

            {/* Header */}
            <div className="px-5 pt-4 pb-0 flex-shrink-0">
              <h2 className="text-xl font-black" style={{ color: 'var(--color-text)' }}>
                {activeTab === 'how-to-play' && 'How to Play'}
                {activeTab === 'modes' && 'Game Modes'}
                {activeTab === 'faq' && 'FAQ'}
              </h2>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 px-5 pt-3 pb-2 flex-shrink-0">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="px-3 py-1.5 rounded-full text-xs font-bold transition-all"
                  style={
                    activeTab === tab.id
                      ? { background: 'var(--color-text)', color: 'var(--color-surface)' }
                      : { background: 'var(--color-surface-alt)', color: 'var(--color-text-secondary)' }
                  }
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Content — scrollable */}
            <div className="px-5 pb-5 pt-1 overflow-y-auto flex-1 min-h-0">
              {activeTab === 'how-to-play' && <HowToPlayContent />}
              {activeTab === 'modes' && <GameModesContent />}
              {activeTab === 'faq' && <FAQContent />}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
