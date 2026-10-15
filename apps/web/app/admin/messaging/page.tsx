'use client';

import { BellRing, Megaphone, Send, Activity, MessageSquareText } from 'lucide-react';
import { PageHeader } from '../components/admin-ui';
import { AdminTabs, useTabParam, type AdminTabDef } from '../components/admin-tabs';
import AnnouncementsTab from './announcements-tab';
import CampaignsTab from './campaigns-tab';
import PushHealthTab from './push-health-tab';
import CopyTab from './copy-tab';

// admin > Growth > Messaging & Push: everything Wordocious says to players.
// Absorbs the old Push Copy page and the push campaign composer from Marketing
// (/admin/push-copy redirects to ?tab=copy).
const TABS: ReadonlyArray<AdminTabDef<'announcements' | 'campaigns' | 'health' | 'copy'>> = [
  { id: 'announcements', label: 'Announcements', icon: Megaphone },
  { id: 'campaigns', label: 'Campaigns', icon: Send },
  { id: 'health', label: 'Push health', icon: Activity },
  { id: 'copy', label: 'Copy', icon: MessageSquareText },
];

export default function AdminMessagingPage() {
  const [tab, setTab] = useTabParam(TABS.map((t) => t.id), 'announcements');
  return (
    <div className="space-y-6">
      <PageHeader title="Messaging & Push" icon={BellRing} subtitle="Everything Wordocious says to players: in-app announcements, push campaigns, push delivery health, and the push copy bank." />
      <AdminTabs tabs={TABS} value={tab} onChange={setTab} label="Messaging sections" />
      {tab === 'announcements' && <AnnouncementsTab />}
      {tab === 'campaigns' && <CampaignsTab />}
      {tab === 'health' && <PushHealthTab />}
      {tab === 'copy' && <CopyTab />}
    </div>
  );
}
