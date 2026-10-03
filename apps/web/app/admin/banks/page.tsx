'use client';

import Link from 'next/link';
import { Library } from 'lucide-react';
import { RunwayCard } from '../components/runway-card';
import { PageHeader, Callout } from '../components/admin-ui';

// admin > Content & Ops > Content Banks: days of unplayed dailies left in every
// bundled puzzle bank (lib/bank-runway via /api/admin/content-runway).
export default function AdminBanksPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Content Banks"
        icon={Library}
        subtitle="Every bundled daily bank: how many dailies shipped, how many days are left before it starts replaying, and when. Amber under 90 days, red under 60."
      />
      <RunwayCard />
      <Callout>
        Today&apos;s plays per game are on <Link href="/admin/daily" className="font-bold text-purple-700">Today&apos;s Dailies</Link>; the Word of the Day schedule is on <Link href="/admin/words" className="font-bold text-purple-700">Word of the Day</Link>.
      </Callout>
    </div>
  );
}
