'use client';

import { Layers } from 'lucide-react';
import { DrillCard } from '../components/drill-panel';
import { TabIntro, ReloadButton, Section, BarList, ErrorNote, LoadingGrid, fmt, useAdminData } from '../components/admin-ui';

// Level tiers, from the same /api/admin/achievements payload the catalog uses
// (the levels block). Fetched only when this tab opens.
interface LevelsData {
  totals: { players: number | null };
  levels: { maxLevel: number; tiers: Array<{ tier: string; count: number }> };
}

export default function LevelsTab() {
  const { data, error, loading, reload } = useAdminData<LevelsData>('/api/admin/achievements');
  const counted = data ? data.levels.tiers.reduce((a, t) => a + t.count, 0) : 0;
  return (
    <div className="space-y-6">
      <TabIntro actions={<ReloadButton onClick={reload} loading={loading} />}>
        How far players have climbed: how many sit in each level tier.
      </TabIntro>
      {error && <ErrorNote>{error}</ErrorNote>}
      {!data && loading && <LoadingGrid tiles={2} />}
      {data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <DrillCard label="Highest level" value={fmt(data.levels.maxLevel)} icon={<Layers className="w-3.5 h-3.5" />} />
            <DrillCard label="Players in tiers" value={fmt(counted)} sub={`of ${fmt(data.totals.players)} accounts`} icon={<Layers className="w-3.5 h-3.5" />} />
          </div>
          <Section
            title="Level tiers"
            icon={Layers}
            note="Tiers follow core levelTier: Bronze 1–10, Silver 11–25, Gold 26–50, Platinum 51–99, Diamond 100+."
          >
            <BarList rows={data.levels.tiers.map((t) => ({ label: t.tier, count: t.count }))} />
          </Section>
        </>
      )}
    </div>
  );
}
