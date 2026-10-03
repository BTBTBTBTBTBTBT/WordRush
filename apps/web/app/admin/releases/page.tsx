'use client';

import { Rocket, ExternalLink, Smartphone, Globe } from 'lucide-react';
import { BibleCard } from '../components/bible-card';
import { PageHeader, Section, Callout } from '../components/admin-ui';

// admin > System > Releases: a static card of store links and the release
// flow. No secrets, no store API calls. Current build numbers are recorded
// in the engineering bible's latest entry (shown below), which every release
// commit updates.

const LINKS: Array<{ group: string; icon: typeof Smartphone; items: Array<{ label: string; href: string; note: string }> }> = [
  {
    group: 'iOS',
    icon: Smartphone,
    items: [
      { label: 'App Store listing', href: 'https://apps.apple.com/app/id6775966055', note: 'What players see' },
      { label: 'App Store Connect', href: 'https://appstoreconnect.apple.com/apps/6775966055', note: 'Builds, review, TestFlight' },
    ],
  },
  {
    group: 'Android',
    icon: Smartphone,
    items: [
      { label: 'Google Play listing', href: 'https://play.google.com/store/apps/details?id=com.wordocious.app', note: 'com.wordocious.app' },
      { label: 'Play Console', href: 'https://play.google.com/console', note: 'Tracks, review, managed publishing' },
    ],
  },
  {
    group: 'Web',
    icon: Globe,
    items: [
      { label: 'wordocious.com', href: 'https://wordocious.com', note: 'Deploys on every push to main' },
    ],
  },
];

const FLOW = [
  'Web: merge to main; the deploy is live in a few minutes.',
  'Android: every ship cuts an internal-track build; production promotion is a founder click in Play Console.',
  'iOS: archive, export and upload a build only when asked; TestFlight first, App Store on request.',
  'Every App Store submission is paired with a Play production submission of the same version (managed publishing, publish after approval).',
];

export default function AdminReleasesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Releases"
        icon={Rocket}
        subtitle="Where each platform ships from, and the release order. Version and build numbers live in the bible's latest entry below."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {LINKS.map(({ group, icon: Icon, items }) => (
          <Section key={group} title={group} icon={Icon}>
            <div className="space-y-2">
              {items.map((l) => (
                <a key={l.href} href={l.href} target="_blank" rel="noreferrer" className="block rounded-lg border border-gray-100 px-3 py-2 hover:border-purple-300 hover:bg-purple-50/40">
                  <span className="text-sm font-black text-gray-900 inline-flex items-center gap-1.5">{l.label} <ExternalLink className="w-3.5 h-3.5 text-gray-400" /></span>
                  <span className="block text-xs font-semibold text-gray-500">{l.note}</span>
                </a>
              ))}
            </div>
          </Section>
        ))}
      </div>

      <Section title="Release flow" icon={Rocket}>
        <ol className="list-decimal pl-5 space-y-1.5 text-sm text-gray-700 font-medium">
          {FLOW.map((f) => <li key={f}>{f}</li>)}
        </ol>
      </Section>

      <BibleCard />

      <Callout>
        Store credentials, signing keys and API keys never appear in the admin portal. Revenue reported by the stores is on Revenue.
      </Callout>
    </div>
  );
}
