'use client';

import { Gamepad2, Trophy, Puzzle, Swords } from 'lucide-react';
import { PageHeader } from '../components/admin-ui';
import { AdminTabs, useTabParam, type AdminTabDef } from '../components/admin-tabs';
import LeaderboardsTab from './leaderboards-tab';
import PuzzlesTab from './puzzles-tab';
import VsTab from './vs-tab';

// admin > Games & Puzzles > Games: Games & Leaderboards + Puzzle Analytics +
// VS & Bots (with the VS match health that used to sit on Ops). /admin/puzzles
// and /admin/vs redirect to the matching tab. Each tab fetches on open.
const TABS: ReadonlyArray<AdminTabDef<'leaderboards' | 'puzzles' | 'vs'>> = [
  { id: 'leaderboards', label: 'Leaderboards', icon: Trophy },
  { id: 'puzzles', label: 'Puzzles', icon: Puzzle },
  { id: 'vs', label: 'VS & Bots', icon: Swords },
];

export default function AdminGamesPage() {
  const [tab, setTab] = useTabParam(TABS.map((t) => t.id), 'leaderboards');
  return (
    <div className="space-y-6">
      <PageHeader title="Games" icon={Gamepad2} subtitle="How the games are doing: daily boards and seeds, puzzle difficulty and streaks, and VS matches, challenges and the bot cast." />
      <AdminTabs tabs={TABS} value={tab} onChange={setTab} label="Games sections" />
      {tab === 'leaderboards' && <LeaderboardsTab />}
      {tab === 'puzzles' && <PuzzlesTab />}
      {tab === 'vs' && <VsTab />}
    </div>
  );
}
