import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import { FAQ_SECTIONS as SECTIONS } from '@/lib/content/static-content';

export const metadata: Metadata = {
  title: 'Wordocious FAQ & Strategy — Tips for Every Word Game Mode',
  description:
    'Answers to common Wordocious questions plus word-game strategy: best starting words, how to read purple/amber/gray tiles, juggling multi-board modes like QuadWord and OctoWord, beating the Gauntlet, and scoring higher on daily leaderboards.',
};

export default function FaqPage() {
  return (
    <div className="min-h-screen pb-12" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-bold mb-6" style={{ color: '#7c3aed' }}>
          <ArrowLeft className="w-4 h-4" />
          Back to Wordocious
        </Link>

        <h1 className="text-3xl font-black uppercase mb-2 text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, #a78bfa, #ec4899)' }}>FAQ &amp; Strategy</h1>
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
