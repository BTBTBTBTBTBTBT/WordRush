'use client';

import { FlagsCard } from '../components/flags-card';
import { TabIntro, Callout } from '../components/admin-ui';

// Ops > Flags: the app_flags remote config (the More
// Games kill switch + tester gate). Writes go through POST /api/admin/flags,
// which is verifyAdmin-gated and audit-logged.
export default function FlagsTab() {
  return (
    <div className="space-y-6">
      <TabIntro>
        Remote switches every client reads within a minute. Off hides a game for everyone; testers limits it to admin and tester accounts; all is the public launch, no rebuild.
      </TabIntro>
      <FlagsCard />
      <Callout>
        Every change is written to the admin audit log (Users & Moderation, Audit log tab). The season skins are not a flag: they follow the calendar (see Seasons).
      </Callout>
    </div>
  );
}
