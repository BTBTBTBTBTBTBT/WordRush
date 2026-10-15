'use client';

import { Users, Search, UserPlus, ShieldBan, History } from 'lucide-react';
import { PageHeader } from '../components/admin-ui';
import { AdminTabs, useTabParam, type AdminTabDef } from '../components/admin-tabs';
import SearchTab from './search-tab';
import NewTab from './new-tab';
import BannedTab from './banned-tab';
import AuditTab from './audit-tab';

// admin > Players > Users & Moderation: the player directory plus the
// moderation tools (the old Moderation page). /admin/moderation redirects to
// ?tab=new. A player's own page is /admin/users/[id].
const TABS: ReadonlyArray<AdminTabDef<'search' | 'new' | 'banned' | 'audit'>> = [
  { id: 'search', label: 'Search', icon: Search },
  { id: 'new', label: 'New', icon: UserPlus },
  { id: 'banned', label: 'Banned', icon: ShieldBan },
  { id: 'audit', label: 'Audit log', icon: History },
];

export default function AdminUsersPage() {
  const [tab, setTab] = useTabParam(TABS.map((t) => t.id), 'search');
  return (
    <div className="space-y-6">
      <PageHeader title="Users & Moderation" icon={Users} subtitle="Find players, review new accounts, ban and unban, and see what admins have done." />
      <AdminTabs tabs={TABS} value={tab} onChange={setTab} label="Users sections" />
      {tab === 'search' && <SearchTab />}
      {tab === 'new' && <NewTab />}
      {tab === 'banned' && <BannedTab />}
      {tab === 'audit' && <AuditTab />}
    </div>
  );
}
