'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Grid3x3, Swords, Grid2x2, Timer, Flame, Shield, Zap, Crown } from 'lucide-react';

type HelpTab = 'how-to-play' | 'modes' | 'faq';

interface HelpModalProps {
  open: boolean;
  onClose: () => void;
}

/** A single example tile */
function ExampleTile({ letter, color }: { letter: string; color: 'green' | 'yellow' | 'gray' | 'empty' }) {
  const styles = {
    green: 'bg-green-600 border-green-600 text-white',
    yellow: 'bg-yellow-500 border-yellow-500 text-white',
    gray: 'bg-gray-400 border-gray-400 text-white',
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
      <p className="text-xs text-center" style={{ color: '#6b7280' }}>{caption}</p>
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
    icon: Grid3x3,
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
    icon: Grid2x2,
    title: 'QuadWord',
    desc: '4 words at once. 9 guesses total. Each guess applies to all 4 boards.',
    color: '#ec4899',
  },
  {
    icon: Timer,
    title: 'OctoWord',
    desc: '8 words at once. 13 guesses. Same idea, bigger challenge.',
    color: '#7e22ce',
    badge: 'PRO',
  },
  {
    icon: Flame,
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
    icon: Zap,
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
    q: "What's a streak?",
    a: 'Play at least one daily puzzle each day to build your streak. Miss a day and it resets — unless you use a Streak Shield.',
  },
  {
    q: 'What are Streak Shields?',
    a: "Shields protect your streak if you miss a day. You can earn them through gameplay or buy them with coins.",
  },
  {
    q: 'What are coins?',
    a: 'Earn coins by playing daily puzzles and winning VS matches. Spend them on shields and cosmetics.',
  },
  {
    q: 'What does PRO unlock?',
    a: 'Unlimited daily plays (free users get one per mode per day), OctoWord mode, and exclusive cosmetics.',
  },
  {
    q: 'Do daily puzzles use the same words for everyone?',
    a: 'Yes! All players get the same puzzle each day so you can compare results.',
  },
];

function HowToPlayContent() {
  return (
    <div className="space-y-4">
      <p className="text-sm font-medium" style={{ color: '#4a4a6a' }}>
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
        style={{ background: '#f8f7ff', border: '1px solid #ede9f6', color: '#6b7280' }}
      >
        Daily puzzles reset at midnight UTC. Everyone gets the same words so you can compare results.
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
            style={{ background: '#fafafa', border: '1px solid #f0f0f0' }}
          >
            <div
              className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: `${mode.color}18` }}
            >
              <Icon className="w-4 h-4" style={{ color: mode.color }} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-black" style={{ color: '#1a1a2e' }}>{mode.title}</span>
                {mode.badge && (
                  <span
                    className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded"
                    style={{ background: '#f3f0ff', color: '#7c3aed' }}
                  >
                    {mode.badge}
                  </span>
                )}
              </div>
              <p className="text-xs mt-0.5" style={{ color: '#6b7280' }}>{mode.desc}</p>
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
          <h4 className="text-sm font-black" style={{ color: '#1a1a2e' }}>{item.q}</h4>
          <p className="text-xs mt-0.5" style={{ color: '#6b7280' }}>{item.a}</p>
        </div>
      ))}
    </div>
  );
}

export function HelpModal({ open, onClose }: HelpModalProps) {
  const [activeTab, setActiveTab] = useState<HelpTab>('how-to-play');

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="relative w-full max-w-sm"
            style={{
              background: '#ffffff',
              border: '1.5px solid #ede9f6',
              borderRadius: '20px',
              overflow: 'hidden',
              boxShadow: '0 20px 60px rgba(0,0,0,0.12)',
              maxHeight: 'calc(100vh - 60px)',
              display: 'flex',
              flexDirection: 'column',
            }}
            onClick={(e) => e.stopPropagation()}
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
              style={{ color: '#9ca3af' }}
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="px-5 pt-4 pb-0 flex-shrink-0">
              <h2 className="text-xl font-black" style={{ color: '#1a1a2e' }}>
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
                      ? { background: '#1a1a2e', color: '#ffffff' }
                      : { background: '#f3f4f6', color: '#6b7280' }
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
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
