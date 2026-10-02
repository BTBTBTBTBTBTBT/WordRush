'use client';

import Link from 'next/link';
import { InfoPageLayout, IntroCard, SectionCard, infoAccent } from '@/components/ui/info-page';
import { PAGE_HOSTS } from '@/lib/mascots';
import { SUPPORT_SECTIONS } from '@/lib/content/static-content';

export default function SupportPage() {
  return (
    // C6 layout; hosted by C (Help / Guides) beside the text title. Back keeps
    // its old target (home).
    <InfoPageLayout title="Help & Support" host={PAGE_HOSTS.guides} backHref="/">
      <IntroCard title={<>Got a question? We&apos;ve got answers.</>} />

      {SUPPORT_SECTIONS.map((section, si) => (
        <SectionCard key={section.heading} heading={section.heading} accent={infoAccent(si)}>
          {section.paragraphs?.map((p, i) => (
            <p key={i} className="text-xs leading-relaxed mb-2 last:mb-0" style={{ color: 'var(--color-text-secondary)' }}>{p}</p>
          ))}
        </SectionCard>
      ))}

      {/* Legal (static chrome — links to legal pages) */}
      <SectionCard heading="Legal" accent={infoAccent(SUPPORT_SECTIONS.length)}>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
          For more details on how we handle your data and the rules of the road, check out our{' '}
          <Link href="/privacy" className="font-bold" style={{ color: '#7c3aed' }}>Privacy Policy</Link>{' '}
          and{' '}
          <Link href="/terms" className="font-bold" style={{ color: '#7c3aed' }}>Terms of Service</Link>.
        </p>
      </SectionCard>
    </InfoPageLayout>
  );
}
