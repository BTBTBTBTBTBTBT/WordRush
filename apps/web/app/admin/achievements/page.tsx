'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Trophy, EyeOff, Clock, Medal, Layers } from 'lucide-react';
import { useDrill, DrillCard } from '../components/drill-panel';
import { PageHeader, ReloadButton, Section, Table, BarList, ErrorNote, LoadingGrid, Callout, fmt, ago, useAdminData } from '../components/admin-ui';

interface AchievementRow {
  key: string; name: string; description: string; category: string; icon: string; xp: number | null; hidden: boolean;
  unlocks: number | null; unlocks7d: number | null;
}
interface AchievementsData {
  totals: { allTime: number | null; last24h: number | null; last7: number | null; players: number | null; catalog: number; hidden: number };
  levels: { maxLevel: number; tiers: Array<{ tier: string; count: number }> };
  achievements: AchievementRow[];
  recent: Array<{ userId: string; player: string; key: string; name: string; unknown: boolean; unlocked_at: string }>;
}

const CATEGORY_LABEL: Record<string, string> = {
  beginner: 'Beginner', consistency: 'Consistency', skill: 'Skill', social: 'Social', collection: 'Collection',
  puzzles: 'Puzzles', vs: 'VS', bots: 'Bots', friends: 'Friends', pocket: 'Pocket games', mascot: 'Mascot maker', seasonal: 'Seasonal', streaks: 'Time of day',
};

type Sort = 'catalog' | 'most' | 'least' | 'week';

export default function AdminAchievementsPage() {
  const drill = useDrill();
  const { data, error, loading, reload } = useAdminData<AchievementsData>('/api/admin/achievements');
  const [category, setCategory] = useState<string>('all');
  const [sort, setSort] = useState<Sort>('catalog');
  const [q, setQ] = useState('');

  const categories = useMemo(() => {
    const seen = new Map<string, number>();
    for (const a of data?.achievements ?? []) seen.set(a.category, (seen.get(a.category) ?? 0) + 1);
    return [...seen.entries()];
  }, [data]);

  const rows = useMemo(() => {
    let list = (data?.achievements ?? []).filter((a) => category === 'all' || (category === 'hidden' ? a.hidden : a.category === category));
    const needle = q.trim().toLowerCase();
    if (needle) list = list.filter((a) => `${a.name} ${a.key} ${a.description}`.toLowerCase().includes(needle));
    const n = (x: number | null) => x ?? -1;
    if (sort === 'most') list = [...list].sort((a, b) => n(b.unlocks) - n(a.unlocks));
    if (sort === 'least') list = [...list].sort((a, b) => n(a.unlocks) - n(b.unlocks));
    if (sort === 'week') list = [...list].sort((a, b) => n(b.unlocks7d) - n(a.unlocks7d));
    return list;
  }, [data, category, sort, q]);

  const players = data?.totals.players ?? 0;
  const never = (data?.achievements ?? []).filter((a) => !a.hidden && a.unlocks === 0).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Achievements & Levels"
        icon={Trophy}
        subtitle="The full catalog (the original set plus the 37 new-game achievements from packages/core), how many players unlocked each, and the level tiers. Click a row to see who unlocked it. Grant one from a player's page."
        actions={<ReloadButton onClick={reload} loading={loading} />}
      />

      {error && <ErrorNote>{error}</ErrorNote>}
      {!data && loading && <LoadingGrid />}

      {data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <DrillCard label="In catalog" value={data.totals.catalog} sub={`${data.totals.hidden} hidden`} icon={<Layers className="w-3.5 h-3.5" />} />
            <DrillCard label="Unlocks, all time" value={fmt(data.totals.allTime)} icon={<Medal className="w-3.5 h-3.5" />} />
            <DrillCard label="Last 24 hours" value={fmt(data.totals.last24h)} icon={<Clock className="w-3.5 h-3.5" />} />
            <DrillCard label="Last 7 days" value={fmt(data.totals.last7)} icon={<Clock className="w-3.5 h-3.5" />} />
            <DrillCard label="Never unlocked" value={never} sub="visible ones only" icon={<EyeOff className="w-3.5 h-3.5" />} />
          </div>

          <Section
            title="Catalog"
            icon={Trophy}
            right={
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search"
                  className="text-xs font-semibold border border-gray-200 rounded-md px-2 py-1 w-32"
                />
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="text-xs font-bold border border-gray-200 rounded-md px-2 py-1 bg-white">
                  <option value="all">All categories</option>
                  {categories.map(([c, n]) => <option key={c} value={c}>{CATEGORY_LABEL[c] ?? c} ({n})</option>)}
                  <option value="hidden">Hidden only</option>
                </select>
                <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="text-xs font-bold border border-gray-200 rounded-md px-2 py-1 bg-white">
                  <option value="catalog">Catalog order</option>
                  <option value="most">Most unlocked</option>
                  <option value="least">Least unlocked</option>
                  <option value="week">Most this week</option>
                </select>
              </div>
            }
            note="Hidden achievements are defined but never shown or awarded until their tracking ships (core HIDDEN_ACHIEVEMENT_KEYS). Share = unlocks ÷ all accounts."
          >
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] font-black text-gray-400 uppercase tracking-wide border-b border-gray-100">
                    <th className="px-2 py-2">Achievement</th>
                    <th className="px-2 py-2">Category</th>
                    <th className="px-2 py-2 text-right">Unlocks</th>
                    <th className="px-2 py-2 text-right">7 days</th>
                    <th className="px-2 py-2 text-right">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((a) => (
                    <tr
                      key={a.key}
                      onClick={() => drill({ metric: 'achievement', key: a.key })}
                      className="border-b border-gray-50 last:border-0 hover:bg-purple-50/40 cursor-pointer"
                      title="Click for the players who unlocked it"
                    >
                      <td className="px-2 py-2">
                        <div className="font-bold text-gray-900 flex items-center gap-1.5">
                          {a.name}
                          {a.hidden && <span className="text-[10px] font-black text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">HIDDEN</span>}
                          {a.xp ? <span className="text-[10px] font-black text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded">+{a.xp} XP</span> : null}
                        </div>
                        <div className="text-xs text-gray-400 font-medium">{a.description} · <span className="font-mono">{a.key}</span></div>
                      </td>
                      <td className="px-2 py-2 text-xs font-bold text-gray-500 whitespace-nowrap">{CATEGORY_LABEL[a.category] ?? a.category}</td>
                      <td className="px-2 py-2 text-right font-black text-gray-900 tabular-nums">{fmt(a.unlocks)}</td>
                      <td className="px-2 py-2 text-right font-semibold text-gray-600 tabular-nums">{fmt(a.unlocks7d)}</td>
                      <td className="px-2 py-2 text-right font-semibold text-gray-500 tabular-nums">
                        {players && a.unlocks != null ? `${((100 * a.unlocks) / players).toFixed(1)}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length === 0 && <p className="text-sm font-semibold text-gray-400 px-2 py-3">No achievements match.</p>}
            </div>
          </Section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Section title="Recent unlocks" icon={Clock}>
              <Table
                rows={data.recent}
                rowKey={(r, i) => `${r.userId}-${r.key}-${i}`}
                columns={[
                  { key: 'player', label: 'Player', render: (r) => <Link href={`/admin/users/${r.userId}`} className="hover:text-purple-700">{r.player}</Link> },
                  { key: 'name', label: 'Achievement', render: (r) => (
                    <span>{r.name}{r.unknown && <span className="ml-1.5 text-[10px] font-black text-red-600 bg-red-50 px-1.5 py-0.5 rounded">NOT IN CATALOG</span>}</span>
                  ) },
                  { key: 'unlocked_at', label: 'When', align: 'right', render: (r) => ago(r.unlocked_at) },
                ]}
                empty="No unlocks yet."
              />
            </Section>

            <Section title="Level tiers" icon={Layers} note={`Highest level reached: ${data.levels.maxLevel}. Tiers follow core levelTier (Bronze 1–10, Silver 11–25, Gold 26–50, Platinum 51–99, Diamond 100+).`}>
              <BarList rows={data.levels.tiers.map((t) => ({ label: t.tier, count: t.count }))} />
              <div className="mt-4">
                <Callout>
                  Granting: open a player from <Link href="/admin/users" className="font-bold text-purple-700">Users</Link> and use the Achievements card. Grants go through the same server path the games use (hidden keys refused) and are written to the audit log. There is no revoke.
                </Callout>
              </div>
            </Section>
          </div>
        </>
      )}
    </div>
  );
}
