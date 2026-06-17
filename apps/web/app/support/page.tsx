'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { SUPPORT_SECTIONS } from '@/lib/content/static-content';

const CARD = { background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '16px' } as const;

export default function SupportPage() {
  return (
    <div className="min-h-screen pb-12" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-bold mb-6" style={{ color: '#7c3aed' }}>
          <ArrowLeft className="w-4 h-4" />
          Back to Wordocious
        </Link>

        <h1 className="text-3xl font-black mb-1 text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, #a78bfa, #ec4899)' }}>Help &amp; Support</h1>
        <p className="text-xs font-bold mb-6" style={{ color: 'var(--color-text-muted)' }}>Got a question? We&apos;ve got answers.</p>

        <div className="space-y-4">
          {SUPPORT_SECTIONS.map((section) => (
            <div key={section.heading} style={CARD} className="p-5">
              <h2 className="text-sm font-black mb-2" style={{ color: 'var(--color-text)' }}>{section.heading}</h2>
              {section.paragraphs?.map((p, i) => (
                <p key={i} className="text-xs leading-relaxed mb-2 last:mb-0" style={{ color: 'var(--color-text-secondary)' }}>{p}</p>
              ))}
            </div>
          ))}

          {/* Legal (static chrome — links to legal pages) */}
          <div style={CARD} className="p-5">
            <h2 className="text-sm font-black mb-2" style={{ color: 'var(--color-text)' }}>Legal</h2>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
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
