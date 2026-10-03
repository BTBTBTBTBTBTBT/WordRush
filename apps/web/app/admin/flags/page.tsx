'use client';

import { ToggleLeft } from 'lucide-react';
import { FlagsCard } from '../components/flags-card';
import { PageHeader, Callout } from '../components/admin-ui';

// admin > Content & Ops > Feature Flags: the app_flags remote config (the More
// Games kill switch + tester gate). Writes go through POST /api/admin/flags,
// which is verifyAdmin-gated and audit-logged.
export default function AdminFlagsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Feature Flags"
        icon={ToggleLeft}
        subtitle="Remote switches every client reads within a minute. Off hides a game for everyone; testers limits it to admin and tester accounts; all is the public launch, no rebuild."
      />
      <FlagsCard />
      <Callout>
        Every change is written to the admin audit log (Moderation). The season skins are not a flag: they follow the calendar (see Seasons).
      </Callout>
    </div>
  );
}
