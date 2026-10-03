'use client';

import Link from 'next/link';
import { HeartHandshake, Users, Radio, Gamepad2, SmilePlus, Flag, Shield, Trophy } from 'lucide-react';
import { DrillCard } from '../components/drill-panel';
import { PageHeader, ReloadButton, Section, BarList, Table, ErrorNote, LoadingGrid, fmt, ago, useAdminData } from '../components/admin-ui';

interface SocialData {
  friendships: {
    accepted: number | null; pending: number | null; accepted7: number | null;
    playersWithFriends: number; avgFriends: number;
    mostConnected: Array<{ userId: string; player: string | null; friends: number }>;
  };
  presence: { onNow: number | null; seen24h: number | null };
  pocket: {
    kinds: Array<{ kind: string; title: string; total: number; active: number; done: number; resigned: number; expired: number; last7: number; decided: number }>;
    recent: Array<{ id: string; game: string; players: string; status: string; winner: string | null; updated_at: string }>;
  };
  reactions: { all: number | null; last7: number | null; byEmoji: Array<{ key: string; count: number | null }>; reactors7: number };
  races: Array<{ week: string; players: number; circles: number; winners: Array<{ userId: string; player: string | null; points: number }> }>;
  extras: { taunts7: number | null; shieldGifts: number | null; shieldGifts7: number | null };
  milestones: Array<{ key: string; count: number | null }>;
}

const EMOJI: Record<string, string> = { clap: 'Clap', fire: 'Fire', wow: 'Wow', grr: 'Grr', rematch: 'Rematch' };
const MILESTONE_LABEL: Record<string, string> = {
  best_buds: 'Best Buds (first friend)',
  squad_goals: 'Squad Goals (10 friends)',
  race_day: "Race Day (won a friends race)",
  ride_or_die: 'Ride or Die (7-day friend streak)',
  cheerleader: 'Cheerleader (25 reactions)',
  pocket_pro: 'Pocket Pro (won every pocket game)',
};

export default function AdminSocialPage() {
  const { data, error, loading, reload } = useAdminData<SocialData>('/api/admin/social');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Friends & Pocket Games"
        icon={HeartHandshake}
        subtitle="Friendships and presence, the six pocket games, reactions, weekly races, taunts and gifted shields. Friend streaks are computed on the device, so the Ride or Die unlocks stand in for them here."
        actions={<ReloadButton onClick={reload} loading={loading} />}
      />
      {error && <ErrorNote>{error}</ErrorNote>}
      {!data && loading && <LoadingGrid />}

      {data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <DrillCard label="Friendships" value={fmt(data.friendships.accepted)} sub={`+${fmt(data.friendships.accepted7)} this week · ${fmt(data.friendships.pending)} pending`} icon={<Users className="w-3.5 h-3.5" />} />
            <DrillCard label="Players with friends" value={fmt(data.friendships.playersWithFriends)} sub={`${data.friendships.avgFriends} friends on average`} icon={<HeartHandshake className="w-3.5 h-3.5" />} />
            <DrillCard label="On now" value={fmt(data.presence.onNow)} sub={`${fmt(data.presence.seen24h)} seen in 24h`} icon={<Radio className="w-3.5 h-3.5" />} />
            <DrillCard label="Reactions · 7d" value={fmt(data.reactions.last7)} sub={`${fmt(data.reactions.reactors7)} reactors · ${fmt(data.reactions.all)} all time`} icon={<SmilePlus className="w-3.5 h-3.5" />} />
          </div>

          <Section title="Pocket games" icon={Gamepad2} note="friendly_games, all time. Decided = the game recorded a winner.">
            <Table
              rows={data.pocket.kinds}
              rowKey={(r) => r.kind}
              columns={[
                { key: 'title', label: 'Game' },
                { key: 'total', label: 'Started', align: 'right', render: (r) => fmt(r.total) },
                { key: 'last7', label: '7 days', align: 'right', render: (r) => fmt(r.last7) },
                { key: 'active', label: 'In progress', align: 'right', render: (r) => fmt(r.active) },
                { key: 'done', label: 'Finished', align: 'right', render: (r) => fmt(r.done) },
                { key: 'resigned', label: 'Resigned', align: 'right', render: (r) => fmt(r.resigned) },
                { key: 'expired', label: 'Expired', align: 'right', render: (r) => fmt(r.expired) },
                { key: 'decided', label: 'Decided', align: 'right', render: (r) => fmt(r.decided) },
              ]}
            />
          </Section>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Section title="Recent pocket games" icon={Gamepad2} className="lg:col-span-2">
              <Table
                rows={data.pocket.recent}
                rowKey={(r) => r.id}
                columns={[
                  { key: 'game', label: 'Game' },
                  { key: 'players', label: 'Players' },
                  { key: 'status', label: 'Status' },
                  { key: 'winner', label: 'Winner', render: (r) => r.winner ?? '—' },
                  { key: 'updated_at', label: 'Updated', align: 'right', render: (r) => ago(r.updated_at) },
                ]}
                empty="No pocket games yet."
              />
            </Section>
            <Section title="Reactions by type" icon={SmilePlus}>
              <BarList rows={data.reactions.byEmoji.map((e) => ({ label: EMOJI[e.key] ?? e.key, count: e.count }))} />
            </Section>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Section title="Weekly races" icon={Trophy} className="lg:col-span-2" note="weekly_race_results: one row per player per settled week (Monday, player-local). Circles = distinct winners that week.">
              <Table
                rows={data.races}
                rowKey={(r) => r.week}
                columns={[
                  { key: 'week', label: 'Week of' },
                  { key: 'players', label: 'Players', align: 'right' },
                  { key: 'circles', label: 'Circles', align: 'right' },
                  { key: 'winners', label: 'Top winners', render: (r) => r.winners.map((w) => `${w.player} (${w.points})`).join(', ') || '—' },
                ]}
                empty="No races settled yet."
              />
            </Section>
            <Section title="Friends milestones" icon={Trophy} note="Achievement unlocks; Ride or Die is the friend-streak signal.">
              <BarList rows={data.milestones.map((m) => ({ label: MILESTONE_LABEL[m.key] ?? m.key, count: m.count }))} />
            </Section>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Section title="Most connected" icon={Users} className="lg:col-span-2">
              <Table
                rows={data.friendships.mostConnected}
                rowKey={(r) => r.userId}
                columns={[
                  { key: 'player', label: 'Player', render: (r) => <Link href={`/admin/users/${r.userId}`} className="hover:text-purple-700">{r.player}</Link> },
                  { key: 'friends', label: 'Friends', align: 'right' },
                ]}
                empty="No friendships yet."
              />
            </Section>
            <Section title="Taunts & shields" icon={Shield}>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="font-semibold text-gray-500 flex items-center gap-1.5"><Flag className="w-3.5 h-3.5" /> Taunts · 7d</span><span className="font-black">{fmt(data.extras.taunts7)}</span></div>
                <div className="flex justify-between"><span className="font-semibold text-gray-500 flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" /> Shields gifted · 7d</span><span className="font-black">{fmt(data.extras.shieldGifts7)}</span></div>
                <div className="flex justify-between"><span className="font-semibold text-gray-500 flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" /> Shields gifted · all time</span><span className="font-black">{fmt(data.extras.shieldGifts)}</span></div>
              </div>
            </Section>
          </div>
        </>
      )}
    </div>
  );
}
