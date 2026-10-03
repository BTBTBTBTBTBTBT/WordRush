'use client';

import { InfoPageLayout, IntroCard, SectionCard } from '@/components/ui/info-page';

export default function TermsPage() {
  return (
    <InfoPageLayout title="Terms of Service" art="art-titlecast-terms">
      <IntroCard titleAs="h2" title="Agreement to Terms">
        <p className="m-0 text-[13px] font-semibold leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
          By accessing or using Wordocious (&quot;the Service&quot;), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service. We reserve the right to update these terms at any time, and continued use of Wordocious constitutes acceptance of any changes.
        </p>
        <p className="m-0 text-[11px] font-black uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Effective September 24, 2026</p>
      </IntroCard>
      <SectionCard heading="Eligibility">
        <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
          You must be at least <strong>13 years of age</strong> to create an account and use Wordocious. By using the Service, you represent and warrant that you meet this age requirement. If you are under 18, you confirm that you have the consent of a parent or legal guardian.
        </p>
      </SectionCard>
      <SectionCard heading="Your Account">
        <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
          You are responsible for maintaining the security of your account and all activity that occurs under it. You agree to choose an appropriate username and not impersonate others. We reserve the right to suspend or terminate accounts that violate these terms.
        </p>
      </SectionCard>
      <SectionCard heading="Acceptable Use">
        <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--color-text-secondary)' }}>
          When using Wordocious, you agree <strong>not</strong> to:
        </p>
        <ul className="text-xs leading-relaxed space-y-1.5" style={{ color: 'var(--color-text-secondary)' }}>
          <li className="flex gap-2"><span aria-hidden="true" style={{ color: '#8b5cf6' }}>&#8226;</span> <span>Use automated tools, bots, scripts, or any form of cheating to gain an unfair advantage</span></li>
          <li className="flex gap-2"><span aria-hidden="true" style={{ color: '#8b5cf6' }}>&#8226;</span> <span>Exploit bugs or vulnerabilities instead of reporting them</span></li>
          <li className="flex gap-2"><span aria-hidden="true" style={{ color: '#8b5cf6' }}>&#8226;</span> <span>Harass, threaten, or abuse other players</span></li>
          <li className="flex gap-2"><span aria-hidden="true" style={{ color: '#8b5cf6' }}>&#8226;</span> <span>Use offensive, hateful, or inappropriate usernames</span></li>
          <li className="flex gap-2"><span aria-hidden="true" style={{ color: '#8b5cf6' }}>&#8226;</span> <span>Attempt to access other users&apos; accounts or private data</span></li>
          <li className="flex gap-2"><span aria-hidden="true" style={{ color: '#8b5cf6' }}>&#8226;</span> <span>Interfere with or disrupt the Service or its infrastructure</span></li>
        </ul>
        <p className="text-xs leading-relaxed mt-3" style={{ color: 'var(--color-text-secondary)' }}>
          Violation of these rules may result in temporary or permanent suspension of your account.
        </p>
      </SectionCard>
      <SectionCard heading={<>Free Tier &amp; Pro Subscription</>}>
        <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--color-text-secondary)' }}>
          Wordocious is free to play. We also offer an optional <strong>Pro subscription</strong> that removes any advertising and unlocks unlimited replays and other extras. Every game mode and daily puzzle remains free.
        </p>
        <ul className="text-xs leading-relaxed space-y-1.5" style={{ color: 'var(--color-text-secondary)' }}>
          <li className="flex gap-2"><span aria-hidden="true" style={{ color: '#8b5cf6' }}>&#8226;</span> <span>In the mobile apps, Pro is purchased and billed through the <strong>Apple App Store</strong> or <strong>Google Play</strong> via their in-app purchase systems, subject to that store&apos;s terms. On the website, Pro is billed by <strong>Stripe</strong>, our payment processor.</span></li>
          <li className="flex gap-2"><span aria-hidden="true" style={{ color: '#8b5cf6' }}>&#8226;</span> <span>You may <strong>cancel at any time</strong> &mdash; in your Apple App Store or Google Play account settings for store purchases, or via <strong>Manage Subscription</strong> in Settings for purchases made on the website. You retain Pro access through the end of your current billing period.</span></li>
          <li className="flex gap-2"><span aria-hidden="true" style={{ color: '#8b5cf6' }}>&#8226;</span> <span>Subscription prices may change with advance notice. Existing subscribers will be notified before any price change takes effect.</span></li>
          <li className="flex gap-2"><span aria-hidden="true" style={{ color: '#8b5cf6' }}>&#8226;</span> <span>Refunds for store purchases are handled by <strong>Apple</strong> or <strong>Google</strong> under their respective policies &mdash; contact the relevant store. For purchases made on the website, contact <strong>support@wordocious.com</strong>.</span></li>
        </ul>
      </SectionCard>
      <SectionCard heading="Intellectual Property">
        <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
          All content, design, graphics, puzzles, artwork, and code that make up Wordocious are owned by us or licensed to us and protected by applicable intellectual property laws. You may not copy, modify, distribute, or reverse-engineer any part of the Service without our written permission.
        </p>
      </SectionCard>
      <SectionCard heading="Disclaimer of Warranties">
        <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
          Wordocious is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind, whether express or implied. We do not guarantee that the Service will be uninterrupted, error-free, or free of harmful components.
        </p>
      </SectionCard>
      <SectionCard heading="Limitation of Liability">
        <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
          To the fullest extent permitted by law, Wordocious and its operators shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of or inability to use the Service, including loss of data or game progress.
        </p>
      </SectionCard>
      <SectionCard heading="Termination">
        <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
          We reserve the right to suspend or terminate your account at any time for violations of these terms or for any other reason at our discretion. You may also delete your account at any time through your profile settings.
        </p>
      </SectionCard>
      <SectionCard heading="Contact Us">
        <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
          If you have any questions about these Terms of Service, please contact us at{' '}
          <a href="mailto:legal@wordocious.com" className="font-bold" style={{ color: '#7c3aed' }}>legal@wordocious.com</a>.
        </p>
      </SectionCard>
    </InfoPageLayout>
  );
}
