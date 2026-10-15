'use client';

import { Rocket, BookOpen, Wrench } from 'lucide-react';
import { PageHeader } from '../components/admin-ui';
import { AdminTabs, useTabParam, type AdminTabDef } from '../components/admin-tabs';
import ReleasesTab from './releases-tab';
import PortalTab from './portal-tab';

// admin > System > Engineering: release flow + the engineering portal doc. Old
// /admin/releases, /admin/portal and /portal redirect here (next.config.js).
const TABS: ReadonlyArray<AdminTabDef<'releases' | 'portal'>> = [
  { id: 'releases', label: 'Releases', icon: Rocket },
  { id: 'portal', label: 'Portal', icon: BookOpen },
];

export default function AdminEngineeringPage() {
  const [tab, setTab] = useTabParam(TABS.map((t) => t.id), 'releases');
  return (
    <div className="space-y-6">
      <PageHeader title="Engineering" icon={Wrench} subtitle="How Wordocious ships and how it is built: store links, the release order, and the engineering portal." />
      <AdminTabs tabs={TABS} value={tab} onChange={setTab} label="Engineering sections" />
      {tab === 'releases' && <ReleasesTab />}
      {tab === 'portal' && <PortalTab />}
    </div>
  );
}
