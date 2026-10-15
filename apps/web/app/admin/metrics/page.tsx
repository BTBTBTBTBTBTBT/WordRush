'use client';

import { TrendingUp, Gauge, UserPlus } from 'lucide-react';
import { PageHeader } from '../components/admin-ui';
import { AdminTabs, useTabParam, type AdminTabDef } from '../components/admin-tabs';
import WeeklyTab from './weekly-tab';
import ActivationTab from './activation-tab';

// admin > Overview > Metrics: the Weekly Five plus new-player activation (the
// old Onboarding page). /admin/onboarding redirects to ?tab=activation.
const TABS: ReadonlyArray<AdminTabDef<'weekly' | 'activation'>> = [
  { id: 'weekly', label: 'Weekly Five', icon: Gauge },
  { id: 'activation', label: 'Activation', icon: UserPlus },
];

export default function AdminMetricsPage() {
  const [tab, setTab] = useTabParam(TABS.map((t) => t.id), 'weekly');
  return (
    <div className="space-y-6">
      <PageHeader title="Metrics" icon={TrendingUp} subtitle="Distribution memo §14: the Weekly Five, plus how new players activate." />
      <AdminTabs tabs={TABS} value={tab} onChange={setTab} label="Metrics sections" />
      {tab === 'weekly' && <WeeklyTab />}
      {tab === 'activation' && <ActivationTab />}
    </div>
  );
}
