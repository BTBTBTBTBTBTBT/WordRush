'use client';

import { Trophy, Layers, Smile } from 'lucide-react';
import { PageHeader } from '../components/admin-ui';
import { AdminTabs, useTabParam, type AdminTabDef } from '../components/admin-tabs';
import AchievementsTab from './achievements-tab';
import LevelsTab from './levels-tab';
import AvatarsTab from './avatars-tab';

// admin > Games & Puzzles > Progression: achievements, level tiers and the
// mascot maker. Old /admin/achievements and /admin/avatars redirect here.
const TABS: ReadonlyArray<AdminTabDef<'achievements' | 'levels' | 'avatars'>> = [
  { id: 'achievements', label: 'Achievements', icon: Trophy },
  { id: 'levels', label: 'Levels', icon: Layers },
  { id: 'avatars', label: 'Avatars', icon: Smile },
];

export default function AdminProgressionPage() {
  const [tab, setTab] = useTabParam(TABS.map((t) => t.id), 'achievements');
  return (
    <div className="space-y-6">
      <PageHeader title="Progression" icon={Trophy} subtitle="What players earn and how they express it: the achievement catalog, level tiers, and the mascot maker." />
      <AdminTabs tabs={TABS} value={tab} onChange={setTab} label="Progression sections" />
      {tab === 'achievements' && <AchievementsTab />}
      {tab === 'levels' && <LevelsTab />}
      {tab === 'avatars' && <AvatarsTab />}
    </div>
  );
}
