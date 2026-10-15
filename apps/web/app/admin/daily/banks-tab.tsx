'use client';

import { RunwayCard } from '../components/runway-card';
import { TabIntro } from '../components/admin-ui';

// admin > Content & Ops > Content Banks: days of unplayed dailies left in every
// bundled puzzle bank (lib/bank-runway via /api/admin/content-runway).
export default function BanksTab() {
  return (
    <div className="space-y-6">
      <TabIntro>
        Every bundled daily bank: how many dailies shipped, how many days are left before it starts replaying, and when. Amber under 90 days, red under 60.
      </TabIntro>
      <RunwayCard />
    </div>
  );
}
