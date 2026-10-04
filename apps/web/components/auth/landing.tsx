'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Swords, TrendingUp, Shield, Skull, Crown, Grid3x3, Star, Shuffle, Hexagon, Quote, Group, KeyRound, TextSearch,
} from 'lucide-react';
import { WordleGridIcon } from '@/components/ui/wordle-grid-icon';
import { SixIcon } from '@/components/ui/six-icon';
import { SevenIcon } from '@/components/ui/seven-icon';
import { LadderIcon } from '@/components/ui/ladder-icon';
import { GameTileBar, gameTileSurface } from '@/components/ui/game-tile';
import { GameArt } from '@/components/ui/game-art';
import { ArtTitle } from '@/components/ui/art-title';
import { CastRow } from '@/components/ui/mascot';
import { CandyButton } from '@/components/ui/candy-button';
import { CastButton } from '@/components/ui/cast-button';
import { softRow } from '@/components/ui/soft-popup';
import { softBackground } from '@/lib/soft-surface';
import { ART_SIZE } from '@/lib/art';
import { HEADLINE, headlineMaxWidth } from '@/lib/headline';
import { MODES as CATALOG } from '@/lib/modes.generated';
import dynamic from 'next/dynamic';
// Loaded on the "Sign in" tap only (founder, 2026-09-29).
const LoginScreen = dynamic(() => import('./login-screen').then((m) => m.LoginScreen));
import { useAuth } from '@/lib/auth-context';

type IconCmp = React.ComponentType<{ className?: string; style?: React.CSSProperties }>;

/**
 * Public marketing landing shown to signed-out visitors (and AdSense / search
 * crawlers) so the site presents real content, not a bare login wall. Matches
 * the app aesthetic (wordmark gradient, tinted cards, mode accents, candy buttons).
 * "Sign in to play" reveals the existing LoginScreen — gameplay stays
 * login-gated.
 */
// Icons mirror the signed-in home grid (app/page.tsx MODE_CARDS and
// components/home/mode-chrome.tsx): real game icons everywhere, except
// QuadWord/OctoWord which brand with roman numerals.
// `art`: the catalog id of the game's 3D icon (docs/ART_SPEC.md §3); defaults to the guide slug's mode.
type LandingMode = { title: string; desc: string; accent: string; roman?: string; guide?: string; Icon?: IconCmp; art?: string };
const MODE_ID_BY_GUIDE: Record<string, string> = Object.fromEntries(
  CATALOG.filter((m) => m.guideSlug).map((m) => [m.guideSlug as string, m.id]),
);
// The eight Daily Sweep word games (VS Battle has its own card under More Games).
const VS_MODE: LandingMode = { title: 'VS Battle', desc: 'Race a friend or a live opponent on the same puzzle.', accent: '#0d9488', Icon: Swords, art: 'vs' };
const MODES: LandingMode[] = [
  { title: 'Classic', desc: 'Guess the hidden 5-letter word in six tries.', accent: '#7c3aed', guide: 'classic', Icon: WordleGridIcon },
  { title: 'QuadWord', desc: 'Solve four words at once with nine shared guesses.', accent: '#ec4899', roman: 'IV', guide: 'quadword' },
  { title: 'OctoWord', desc: 'Eight boards, thirteen guesses — the ultimate grid.', accent: '#7e22ce', roman: 'VIII', guide: 'octoword' },
  { title: 'Succession', desc: 'Four words, unlocked and solved one at a time.', accent: '#2563eb', guide: 'succession', Icon: TrendingUp },
  { title: 'Deliverance', desc: 'Four boards that start with letters already placed.', accent: '#059669', guide: 'deliverance', Icon: Shield },
  { title: 'Six', desc: 'Longer six-letter words in seven tries.', accent: '#06b6d4', guide: 'six', Icon: SixIcon },
  { title: 'Seven', desc: 'Seven-letter words in eight tries for word pros.', accent: '#84cc16', guide: 'seven', Icon: SevenIcon },
  { title: 'Gauntlet', desc: 'Five escalating stages chained into one run.', accent: '#d97706', guide: 'gauntlet', Icon: Skull },
];
// The More Games tile: ten extra dailies outside the Daily Sweep (catalog order,
// accents from lib/modes.generated.ts, icons from components/home/mode-chrome.tsx).
const MORE_GAMES: LandingMode[] = [
  { title: 'ProperNoundle', desc: 'Guess famous names from a daily category.', accent: '#dc2626', guide: 'propernoundle', Icon: Crown },
  { title: 'Sudocious', desc: 'A Medium 9 × 9 sudoku a day — three mistakes, pencil notes, one solution.', accent: '#1e40af', guide: 'sudocious', Icon: Grid3x3 },
  { title: 'Muddle', desc: 'Unscramble four words, then spell the pun from their circled letters.', accent: '#f97316', guide: 'muddle', Icon: Shuffle },
  { title: 'Hubbub', desc: 'Seven letters, one hub — make words, find the pangram, climb the ranks.', accent: '#c026d3', guide: 'hubbub', Icon: Hexagon },
  { title: 'Crosswordocious', desc: 'A themed crossword where every clue is a saying with one word missing.', accent: '#475569', guide: 'crosswordocious', Icon: Quote },
  { title: 'Kindred', desc: 'Sixteen words hide four groups of four — find them before four mistakes.', accent: '#9f1239', guide: 'kindred', Icon: Group },
  { title: 'Letter Ladder', desc: 'Change one letter at a time from the start word to the end word, on par.', accent: '#0284c7', guide: 'letter-ladder', Icon: LadderIcon },
  { title: 'Codebreaker', desc: 'Crack a well-known saying written in a letter-for-letter code.', accent: '#92400e', guide: 'codebreaker', Icon: KeyRound },
  { title: 'Spyglass', desc: 'Ten themed words hidden forwards in a 10 × 10 grid — clear it clean.', accent: '#4d7c0f', guide: 'spyglass', Icon: TextSearch },
  { title: 'Starsweep', desc: 'One star in every row, column and color region, none touching.', accent: '#ca8a04', guide: 'starsweep', Icon: Star },
];

function ModeCard({ m }: { m: LandingMode }) {
  const artId = m.art ?? (m.guide ? MODE_ID_BY_GUIDE[m.guide] : undefined);
  const oldGlyph = m.roman ? m.roman : m.Icon ? <m.Icon className="w-4 h-4" style={{ color: m.accent }} /> : m.title.charAt(0);
  return (
    // One game-tile style (docs/GAME_TILE_STYLE.md): the home card's tint, border and top bar.
    <div className="relative overflow-hidden p-4 pt-5" style={gameTileSurface(m.accent)}>
      <GameTileBar accent={m.accent} />
      <div className="flex items-center gap-2 mb-1">
        <span className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black" style={{ background: `${m.accent}15`, color: m.accent }}>
          {artId ? <GameArt id={artId} size={26} fallback={oldGlyph} /> : oldGlyph}
        </span>
        <h3 className="text-sm font-black" style={{ color: 'var(--color-text)' }}>{m.title}</h3>
      </div>
      <p className="text-xs font-medium leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{m.desc}</p>
      {m.guide && (
        <Link href={`/guides/${m.guide}`} className="inline-block text-[11px] font-extrabold mt-1.5" style={{ color: m.accent }}>
          Rules, scoring &amp; strategy →
        </Link>
      )}
    </div>
  );
}

const FAQ: { q: string; a: string }[] = [
  { q: 'Is Wordocious free to play?', a: 'Yes. A new daily puzzle in every mode is free every day. An optional Pro subscription removes ads and unlocks unlimited replays.' },
  { q: 'How is it different from other word games?', a: 'Wordocious bundles nineteen ways to play — single-board Classic, multi-board QuadWord and OctoWord, the sequential Succession, prefilled Deliverance, longer Six and Seven, a five-stage Gauntlet, ten More Games dailies from sudoku and star logic to word searches, cryptograms, crosswords and famous names, and live VS matches with friends — all sharing one daily seed so everyone plays the same puzzles.' },
  { q: 'Do I need an account?', a: 'You can read about every mode here without signing in. To play, save your streaks, and climb the daily leaderboards, sign in with Google, Apple or email.' },
  { q: 'How do daily challenges work?', a: 'Each mode has one shared daily puzzle that resets at local midnight. Finish all eight word games for a Daily Sweep, or win them all for a Flawless Victory and bonus XP.' },
  { q: 'What is More Games?', a: 'The More Games tile on the home screen opens ten extra dailies — Sudocious, Starsweep, Letter Ladder, Spyglass, Hubbub, Codebreaker, Kindred, Crosswordocious, Muddle and ProperNoundle. Each earns XP, medals, achievements and its own leaderboard, but none of them counts toward the Daily Sweep, which stays the eight word games.' },
  { q: 'What are leaderboards and medals?', a: 'Every daily puzzle has a leaderboard ranked by a composite of guesses and solve time. Top finishers earn gold, silver, and bronze medals shown on their profile.' },
];

export function Landing() {
  const [showLogin, setShowLogin] = useState(false);
  const { enterGuest } = useAuth();
  if (showLogin) return <LoginScreen />;

  const wordmarkStyle = {
    backgroundImage: 'linear-gradient(135deg, #a78bfa, #ec4899)',
    WebkitBackgroundClip: 'text' as const,
    WebkitTextFillColor: 'transparent' as const,
  };

  return (
    <div className="min-h-screen overflow-y-auto" style={{ background: softBackground('#7c3aed', 0.06) }}>
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-4 max-w-3xl mx-auto">
        <span className="text-2xl font-black tracking-tight" style={wordmarkStyle}>WORDOCIOUS</span>
        <CastButton color="purple" size="sm" onClick={() => setShowLogin(true)}>
          Sign In
        </CastButton>
      </header>

      {/* Hero */}
      <section className="text-center px-6 pt-8 pb-10 max-w-2xl mx-auto">
        {/* The cast spelling WORDOCIOUS over the WELCOME! lettering (docs/ART_SPEC.md §8; FINISH_SPEC N1:
            one cast per screen, the title a small centered headline). */}
        <div className="flex justify-center mb-3" style={{ width: '90%', marginLeft: 'auto', marginRight: 'auto' }}>
          <CastRow size={34} gap={0} />
        </div>
        <ArtTitle
          name="art-titlecast-welcome"
          label="Welcome"
          as="div"
          widthPct={HEADLINE.widthPct}
          maxWidth={headlineMaxWidth(...ART_SIZE['art-titlecast-welcome'])}
          className="mb-3"
        />
        <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-3" style={wordmarkStyle}>WORDOCIOUS</h1>
        <p className="text-base font-bold mb-2" style={{ color: 'var(--color-text)' }}>
          Daily word games. Eight on the home screen, ten more behind one tile.
        </p>
        <p className="text-sm font-medium mb-6 leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
          A fresh set of puzzles every day — from the classic five-letter chase to eight-board
          marathons, a five-stage Gauntlet, and ten More Games dailies from sudoku to
          cryptograms, plus live VS matches with friends. Everyone plays the same daily puzzles, climbs the same
          leaderboards, and chases the same streaks.
        </p>
        <CastButton color="purple" size="lg" icon="play" onClick={() => setShowLogin(true)}>
          Sign in to play
        </CastButton>
        <div className="mt-3">
          <CastButton color="peach" size="md" onClick={enterGuest} style={{ textTransform: 'none' }}>
            Play without an account
          </CastButton>
          <p className="text-[11px] font-medium mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Play today&apos;s daily puzzles free. Sign in to save stats, streaks, and compete.
          </p>
        </div>
      </section>

      {/* Modes */}
      <section className="px-5 pb-10 max-w-3xl mx-auto">
        <h2 className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: 'var(--color-text-muted)' }}>
          The Daily Word Games
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {MODES.map((m) => <ModeCard key={m.title} m={m} />)}
        </div>

        <h2 className="text-xs font-black uppercase tracking-widest mt-8 mb-1" style={{ color: '#4f46e5' }}>
          More Games
        </h2>
        <p className="text-xs font-medium mb-3 leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
          Ten extra dailies behind one tile on the home screen. Each earns XP, medals and its own leaderboard;
          none of them counts toward the Daily Sweep, which stays the eight word games above.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {MORE_GAMES.map((m) => <ModeCard key={m.title} m={m} />)}
        </div>

        <h2 className="text-xs font-black uppercase tracking-widest mt-8 mb-3" style={{ color: 'var(--color-text-muted)' }}>
          Play with Friends
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ModeCard m={VS_MODE} />
        </div>
        <p className="text-xs font-medium mt-3" style={{ color: 'var(--color-text-secondary)' }}>
          Want the deep dives? The <Link href="/guides" style={{ color: '#7c3aed', fontWeight: 800 }}>mode guides</Link> cover
          exact scoring formulas, hint economics, and leaderboard strategy for every mode.
        </p>
      </section>

      {/* How to play */}
      <section className="px-5 pb-10 max-w-3xl mx-auto">
        <h2 className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: 'var(--color-text-muted)' }}>How to Play</h2>
        <div className="p-5 space-y-2" style={softRow('#7c3aed', { radius: 16 })}>
          <p className="text-sm font-medium leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
            Guess the hidden word. After each guess, every tile flips to show how close you were:
            <strong style={{ color: '#7c3aed' }}> purple</strong> means the right letter in the right spot,
            <strong style={{ color: '#f59e0b' }}> amber</strong> means the letter is in the word but elsewhere, and
            <strong style={{ color: '#6b7280' }}> gray</strong> means it isn&apos;t in the word at all. Use those clues to
            narrow it down before you run out of tries.
          </p>
          <p className="text-sm font-medium leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
            Multi-board modes apply each guess to every board at once, so you have to juggle several words in parallel.
            Finish faster and in fewer guesses to score higher on the daily leaderboard — and even a loss banks partial
            credit for how far you got, so getting close still counts.
          </p>
          <Link href="/how-to-play" className="inline-block text-sm font-extrabold pt-1" style={{ color: '#7c3aed' }}>
            Read the full guide →
          </Link>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-5 pb-10 max-w-3xl mx-auto">
        <h2 className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: 'var(--color-text-muted)' }}>Frequently Asked Questions</h2>
        <div className="space-y-3">
          {FAQ.map((item) => (
            <div key={item.q} className="p-4" style={softRow('#7c3aed', { radius: 14 })}>
              <h3 className="text-sm font-black mb-1" style={{ color: 'var(--color-text)' }}>{item.q}</h3>
              <p className="text-xs font-medium leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="px-5 py-8 text-center border-t" style={{ borderColor: 'var(--color-border)' }}>
        <CastButton color="purple" size="lg" icon="play" onClick={() => setShowLogin(true)} className="mb-2">
          Sign in to play
        </CastButton>
        <div className="mb-4">
          <CastButton color="peach" size="md" onClick={enterGuest} style={{ textTransform: 'none' }}>
            Play without an account
          </CastButton>
        </div>
        <div className="flex items-center justify-center gap-3 text-[11px] font-bold flex-wrap" style={{ color: 'var(--color-text-muted)' }}>
          <Link href="/how-to-play">How to Play</Link><span>·</span>
          <Link href="/guides">Mode Guides</Link><span>·</span>
          <Link href="/faq">FAQ</Link><span>·</span>
          <Link href="/about">About</Link><span>·</span>
          <Link href="/privacy">Privacy</Link><span>·</span>
          <Link href="/terms">Terms</Link><span>·</span>
          <Link href="/support">Support</Link>
        </div>
        <p className="text-[10px] font-bold mt-3" style={{ color: 'var(--color-text-muted)' }}>© Wordocious. A daily word game.</p>
      </footer>
    </div>
  );
}
