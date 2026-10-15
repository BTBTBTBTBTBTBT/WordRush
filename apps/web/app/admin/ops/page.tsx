'use client';

import { Activity, ToggleLeft, HeartPulse } from 'lucide-react';
import { PageHeader } from '../components/admin-ui';
import { AdminTabs, useTabParam, type AdminTabDef } from '../components/admin-tabs';
import HealthTab from './health-tab';
import FlagsTab from './flags-tab';

// admin > System > Ops: health (cron heartbeats, anti-cheat) and the feature
// flags (remote kill switches; every write is confirmed and audit-logged).
// /admin/flags redirects to ?tab=flags. Seasons moved to Design.
const TABS: ReadonlyArray<AdminTabDef<'health' | 'flags'>> = [
  { id: 'health', label: 'Health', icon: HeartPulse },
  { id: 'flags', label: 'Flags', icon: ToggleLeft },
];

export default function AdminOpsPage() {
  const [tab, setTab] = useTabParam(TABS.map((t) => t.id), 'health');
  return (
    <div className="space-y-6">
      <PageHeader title="Ops" icon={Activity} subtitle="Is anything quietly broken, and the remote switches that turn features on and off." />
      <AdminTabs tabs={TABS} value={tab} onChange={setTab} label="Ops sections" />
      {tab === 'health' && <HealthTab />}
      {tab === 'flags' && <FlagsTab />}
    </div>
  );
}
