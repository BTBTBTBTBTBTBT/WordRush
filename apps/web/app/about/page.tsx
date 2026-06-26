import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import { ABOUT_SECTIONS } from '@/lib/content/static-content';

export const metadata: Metadata = {
  title: 'About Wordocious — Epic Word Battles',
  description:
    'Wordocious is a free online word puzzle game with 10 unique game modes including Classic, QuadWord, OctoWord, Succession, Deliverance, Six, Seven, Gauntlet, ProperNoundle, and real-time VS Battles. Play daily puzzles, climb leaderboards, and compete with friends.',
};

const CARD = { background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '16px' } as const;

export default function AboutPage() {
  return (
    <div className="min-h-screen pb-12" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-bold mb-6" style={{ color: '#7c3aed' }}>
          <ArrowLeft className="w-4 h-4" />
          Back to Wordocious
        </Link>

        <h1 className="text-3xl font-black uppercase mb-2 text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, #a78bfa, #ec4899)' }}>About Wordocious</h1>
        <p className="text-sm font-bold mb-6" style={{ color: 'var(--color-text-muted)' }}>Epic Word Battles &mdash; Daily Puzzles &amp; Multiplayer Showdowns</p>

        <div className="space-y-4">
          {ABOUT_SECTIONS.map((section) => (
            <div key={section.heading} style={CARD} className="p-5">
              <h2 className="text-sm font-black mb-2" style={{ color: 'var(--color-text)' }}>{section.heading}</h2>
              {section.paragraphs?.map((p, i) => (
                <p key={i} className="text-xs leading-relaxed mb-3 last:mb-0" style={{ color: 'var(--color-text-secondary)' }}>{p}</p>
              ))}
              {section.items && (
                <div className="space-y-3">
                  {section.items.map((item) => (
                    <div key={item.heading}>
                      <h3 className="text-xs font-black" style={{ color: item.accent ?? '#7c3aed' }}>{item.heading}</h3>
                      <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{item.body}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* More Information (static chrome — links to legal pages) */}
          <div style={CARD} className="p-5">
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
