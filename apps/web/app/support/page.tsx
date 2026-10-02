'use client';

import Link from 'next/link';
import { PageHeader } from '@/components/ui/page-header';
import { PAGE_HOSTS } from '@/lib/mascots';
import { SUPPORT_SECTIONS } from '@/lib/content/static-content';

const CARD = { background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '16px' } as const;

export default function SupportPage() {
  return (
    <div className="min-h-screen pb-12" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* HEADER_SPEC §4: the shared page header, hosted by C (Help / Guides). */}
        <PageHeader
          className="mb-6"
          title="Help & Support"
          titleSize={26}
          host={PAGE_HOSTS.guides}
          hostSize={44}
          back={{ href: '/', label: 'Back to Wordocious' }}
          sub={<p className="text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>Got a question? We&apos;ve got answers.</p>}
        />

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
