'use client';

import { useState, useEffect, useRef } from 'react';

import { X, Swords, TrendingUp, Shield, Skull, Crown } from 'lucide-react';
import { WordleGridIcon } from '@/components/ui/wordle-grid-icon';
import { SixIcon } from '@/components/ui/six-icon';
import { SevenIcon } from '@/components/ui/seven-icon';
import { useFocusTrap } from '@/hooks/use-focus-trap';
import { HELP_MODES, HELP_FAQ } from '@/lib/content/static-content';

type HelpTab = 'how-to-play' | 'modes' | 'faq';

interface HelpModalProps {
  open: boolean;
  onClose: () => void;
}

/** A single example tile */
function ExampleTile({ letter, color }: { letter: string; color: 'green' | 'yellow' | 'gray' | 'empty' }) {
  const styles = {
    green: 'tile-correct text-white',
    yellow: 'tile-present text-white',
    gray: 'tile-absent text-white',
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

// Game-mode descriptions + help FAQ are single-sourced in lib/content (shared
// with the native apps via /api/content). Icons stay web-native, mapped by
// title; roman numerals for the multi-board modes.
const MODE_ICONS: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  Classic: WordleGridIcon,
  'VS Battle': Swords,
  Succession: TrendingUp,
  Deliverance: Shield,
  Six: SixIcon,
  Seven: SevenIcon,
  Gauntlet: Skull,
  ProperNoundle: Crown,
};
const MODE_ROMAN: Record<string, string> = { QuadWord: 'IV', OctoWord: 'VIII' };

const GAME_MODES = HELP_MODES.map((m) => ({
  icon: MODE_ICONS[m.title] ?? null,
  romanNumeral: MODE_ROMAN[m.title],
  title: m.title,
  desc: m.desc,
  color: m.accent,
}));

const FAQ_ITEMS = HELP_FAQ;

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
          caption={<><strong className="text-violet-600">W</strong> is in the word and in the correct spot.</>}
        />
        <ExampleRow
          letters={['P', 'I', 'L', 'L', 'S']}
          colors={['empty', 'yellow', 'empty', 'empty', 'empty']}
          caption={<><strong className="text-amber-500">I</strong> is in the word but in the wrong spot.</>}
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
              <h2 className="text-xl font-black text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, #a78bfa, #ec4899)' }}>
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
