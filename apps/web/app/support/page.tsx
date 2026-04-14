'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function SupportPage() {
  return (
    <div className="min-h-screen pb-12" style={{ backgroundColor: '#f8f7ff' }}>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-bold mb-6" style={{ color: '#7c3aed' }}>
          <ArrowLeft className="w-4 h-4" />
          Back to SpellStrike
        </Link>

        <h1 className="text-3xl font-black mb-1" style={{ color: '#1a1a2e' }}>Help &amp; Support</h1>
        <p className="text-xs font-bold mb-6" style={{ color: '#9ca3af' }}>Got a question? We&apos;ve got answers.</p>

        <div className="space-y-4">
          <div style={{ background: '#ffffff', border: '1.5px solid #ede9f6', borderRadius: '16px' }} className="p-5">
            <h2 className="text-sm font-black mb-2" style={{ color: '#1a1a2e' }}>How do I play SpellStrike?</h2>
            <p className="text-xs leading-relaxed" style={{ color: '#6b7280' }}>
              SpellStrike is a word puzzle game with multiple modes. In each mode, you guess hidden words by typing guesses and using color-coded feedback to narrow things down. Green means the letter is correct and in the right spot. Yellow means the letter is in the word but in the wrong position. Gray means the letter isn&apos;t in the word at all. Each mode has its own twist &mdash; from single-word puzzles to multi-board challenges!
            </p>
          </div>

          <div style={{ background: '#ffffff', border: '1.5px solid #ede9f6', borderRadius: '16px' }} className="p-5">
            <h2 className="text-sm font-black mb-2" style={{ color: '#1a1a2e' }}>What are the different game modes?</h2>
            <p className="text-xs leading-relaxed" style={{ color: '#6b7280' }}>
              SpellStrike offers a variety of modes to keep things fresh. There are daily puzzles that everyone shares, multi-board modes like QuadWord and OctoWord where you solve multiple puzzles at once, timed challenges like Gauntlet, and more. Head to the home page to see all available modes and find your favorite.
            </p>
          </div>

          <div style={{ background: '#ffffff', border: '1.5px solid #ede9f6', borderRadius: '16px' }} className="p-5">
            <h2 className="text-sm font-black mb-2" style={{ color: '#1a1a2e' }}>How are daily scores calculated?</h2>
            <p className="text-xs leading-relaxed" style={{ color: '#6b7280' }}>
              Your daily score is a composite of three factors: a <span className="font-bold" style={{ color: '#1a1a2e' }}>base score</span> of 1,000 points for completing the puzzle, a <span className="font-bold" style={{ color: '#1a1a2e' }}>guess bonus</span> for using fewer guesses than the maximum allowed, and a <span className="font-bold" style={{ color: '#1a1a2e' }}>speed bonus</span> for finishing quickly. Multi-board modes also include a <span className="font-bold" style={{ color: '#1a1a2e' }}>completion bonus</span> based on how many boards you solved. For example, in Classic with 4 guesses and 13 seconds: 1,000 base + 200 guess bonus (2 unused guesses &times; 100) + 287 speed bonus (300s cap &minus; 13s) + 200 completion = 1,687 points. The fewer guesses and less time you take, the higher your score.
            </p>
          </div>

          <div style={{ background: '#ffffff', border: '1.5px solid #ede9f6', borderRadius: '16px' }} className="p-5">
            <h2 className="text-sm font-black mb-2" style={{ color: '#1a1a2e' }}>How do XP and levels work?</h2>
            <p className="text-xs leading-relaxed" style={{ color: '#6b7280' }}>
              You earn XP after every game. Winning awards 100 XP and losing awards 25 XP. You can earn bonus XP from win streaks (+50), completing daily challenges (+50), and earning medals (gold +100, silver +50, bronze +25). Your level is based on your total XP &mdash; every 1,000 XP advances you one level. Check your progress on your profile page.
            </p>
          </div>

          <div style={{ background: '#ffffff', border: '1.5px solid #ede9f6', borderRadius: '16px' }} className="p-5">
            <h2 className="text-sm font-black mb-2" style={{ color: '#1a1a2e' }}>How do streaks work?</h2>
            <p className="text-xs leading-relaxed" style={{ color: '#6b7280' }}>
              Your streak counts how many consecutive days you&apos;ve completed a daily puzzle. Play and solve at least one daily puzzle each day to keep your streak alive. If you miss a day, your current streak resets to zero &mdash; but your best streak is always saved. Streaks reset at midnight based on your local time.
            </p>
          </div>

          <div style={{ background: '#ffffff', border: '1.5px solid #ede9f6', borderRadius: '16px' }} className="p-5">
            <h2 className="text-sm font-black mb-2" style={{ color: '#1a1a2e' }}>What is SpellStrike Pro?</h2>
            <p className="text-xs leading-relaxed" style={{ color: '#6b7280' }}>
              Pro is an optional subscription that unlocks extra features and game modes. It&apos;s designed for players who want even more from SpellStrike. You can subscribe from your profile page, and you can cancel anytime &mdash; you&apos;ll keep Pro access through the end of your billing period. SpellStrike is completely playable for free, and Pro is just a bonus for those who want it.
            </p>
          </div>

          <div style={{ background: '#ffffff', border: '1.5px solid #ede9f6', borderRadius: '16px' }} className="p-5">
            <h2 className="text-sm font-black mb-2" style={{ color: '#1a1a2e' }}>How do I cancel my Pro subscription?</h2>
            <p className="text-xs leading-relaxed" style={{ color: '#6b7280' }}>
              You can cancel your Pro subscription at any time from your profile settings. Once cancelled, you&apos;ll continue to have Pro access until the end of your current billing cycle. No questions asked, no hidden fees.
            </p>
          </div>

          <div style={{ background: '#ffffff', border: '1.5px solid #ede9f6', borderRadius: '16px' }} className="p-5">
            <h2 className="text-sm font-black mb-2" style={{ color: '#1a1a2e' }}>My stats aren&apos;t showing up. What do I do?</h2>
            <p className="text-xs leading-relaxed" style={{ color: '#6b7280' }}>
              Make sure you&apos;re signed in to your account. Game stats are saved to your profile, so if you played while signed out, those results may not be linked to your account. Try refreshing the page or signing out and back in. If the issue persists, reach out to us and we&apos;ll help sort it out.
            </p>
          </div>

          <div style={{ background: '#ffffff', border: '1.5px solid #ede9f6', borderRadius: '16px' }} className="p-5">
            <h2 className="text-sm font-black mb-2" style={{ color: '#1a1a2e' }}>I found a bug or have a suggestion!</h2>
            <p className="text-xs leading-relaxed" style={{ color: '#6b7280' }}>
              We love hearing from players. Whether it&apos;s a bug report, a feature idea, or just a kind word, feel free to reach out. Your feedback helps make SpellStrike better for everyone.
            </p>
          </div>

          <div style={{ background: '#ffffff', border: '1.5px solid #ede9f6', borderRadius: '16px' }} className="p-5">
            <h2 className="text-sm font-black mb-2" style={{ color: '#1a1a2e' }}>Contact Support</h2>
            <p className="text-xs leading-relaxed" style={{ color: '#6b7280' }}>
              Can&apos;t find what you&apos;re looking for? Send us an email at{' '}
              <a href="mailto:support@spellstrike.com" className="font-bold" style={{ color: '#7c3aed' }}>support@spellstrike.com</a>{' '}
              and we&apos;ll get back to you as soon as we can.
            </p>
          </div>

          <div style={{ background: '#ffffff', border: '1.5px solid #ede9f6', borderRadius: '16px' }} className="p-5">
            <h2 className="text-sm font-black mb-2" style={{ color: '#1a1a2e' }}>Legal</h2>
            <p className="text-xs leading-relaxed" style={{ color: '#6b7280' }}>
              For more details on how we handle your data and the rules of the road, check out our{' '}
              <Link href="/privacy" className="font-bold" style={{ color: '#7c3aed' }}>Privacy Policy</Link>{' '}
              and{' '}
              <Link href="/terms" className="font-bold" style={{ color: '#7c3aed' }}>Terms of Service</Link>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
