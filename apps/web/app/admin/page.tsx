'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Users, Gamepad2, Crown, Activity, ShieldBan, UserPlus, Trophy, Smile, HeartHandshake, Swords, SmilePlus, Gift, Radio,
  Sparkles, Puzzle, Ghost, LayoutDashboard,
} from 'lucide-react';
import { botOfTheDay } from '@wordle-duel/core';
import { useDrill, DrillCard } from './components/drill-panel';
import { BibleCard } from './components/bible-card';
import { ADMIN_NAV } from './components/admin-nav';
import { PageHeader, Section, LinkStat, fmt, useAdminData } from './components/admin-ui';
import { halloweenStatus } from '@/lib/admin/admin-aggregates';
import { modeLabel } from '@/lib/mode-labels';

interface DashboardStats {
  totalUsers: number;
  activeToday: number;
  proSubscribers: number;
  gamesToday: number;
  bannedUsers: number;
  recentSignups: Array<{
    id: string;
    username: string;
    avatar_url: string | null;
    created_at: string;
    is_pro: boolean;
    level: number;
  }>;
  modePopularity: Record<string, number>;
}

interface Overview {
  achievementsAll: number | null; achievements24h: number | null; mascots: number | null; friendships: number | null; friendRequests: number | null;
  pocketActive: number | null; pocket7: number | null; challenges7: number | null; reactions7: number | null; giftsRedeemed: number | null; onNow: number | null;
}
interface TodayHealth {
  day: string;
  players: number;
  word: { total: number; sweeps: number; flawless: number };
  puzzles: { total: number; sweeps: number; flawless: number };
}

const localDay = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Mode names come from the SHARED lib/mode-labels — this page carried its own
// pre-refactor copy that was missing DUEL_6/DUEL_7, so the popularity bars
// showed raw enum keys for Six and Seven (§199's drift lesson, again).

export default function AdminDashboard() {
  const drill = useDrill();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const overview = useAdminData<Overview>('/api/admin/overview');
  const today = useAdminData<TodayHealth>('/api/admin/daily-health');
  const day = useMemo(localDay, []);
  const season = useMemo(() => halloweenStatus(day), [day]);
  const bot = useMemo(() => botOfTheDay(new Date().toISOString().slice(0, 10)), []);

  useEffect(() => {
    fetch('/api/admin/stats')
      .then(res => res.json())
      .then(data => { setStats(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const statCards = stats ? [
    { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'text-blue-600 bg-blue-50', drill: { metric: 'users' } },
    { label: 'Active Today', value: stats.activeToday, icon: Activity, color: 'text-green-600 bg-green-50', drill: { metric: 'dau' } },
    { label: 'Pro Subscribers', value: stats.proSubscribers, icon: Crown, color: 'text-purple-600 bg-purple-50', drill: { metric: 'pro' } },
    { label: 'Games Today', value: stats.gamesToday, icon: Gamepad2, color: 'text-orange-600 bg-orange-50', drill: { metric: 'plays', day: new Date().toISOString().slice(0, 10) } },
    { label: 'Banned Users', value: stats.bannedUsers, icon: ShieldBan, color: 'text-red-600 bg-red-50', drill: { metric: 'banned' } },
  ] : [];

  const o = overview.data;
  const featureCards: Array<{ label: string; value: string; sub: string; icon: React.ReactNode; href: string }> = [
    { label: 'Achievements', value: fmt(o?.achievementsAll), sub: `+${fmt(o?.achievements24h)} in 24h`, icon: <Trophy className="w-3.5 h-3.5" />, href: '/admin/achievements' },
    { label: 'Mascots saved', value: fmt(o?.mascots), sub: 'avatar maker', icon: <Smile className="w-3.5 h-3.5" />, href: '/admin/avatars' },
    { label: 'Friendships', value: fmt(o?.friendships), sub: `${fmt(o?.friendRequests)} pending`, icon: <HeartHandshake className="w-3.5 h-3.5" />, href: '/admin/social' },
    { label: 'On now', value: fmt(o?.onNow), sub: 'seen in the last 2 min', icon: <Radio className="w-3.5 h-3.5" />, href: '/admin/social' },
    { label: 'Pocket games', value: fmt(o?.pocketActive), sub: `in progress · ${fmt(o?.pocket7)} new this week`, icon: <Gamepad2 className="w-3.5 h-3.5" />, href: '/admin/social' },
    { label: 'VS challenges · 7d', value: fmt(o?.challenges7), sub: `Bot of the Day: ${bot.name}`, icon: <Swords className="w-3.5 h-3.5" />, href: '/admin/vs' },
    { label: 'Reactions · 7d', value: fmt(o?.reactions7), sub: 'clap, fire, wow, grr, rematch', icon: <SmilePlus className="w-3.5 h-3.5" />, href: '/admin/social' },
    { label: 'Gifts redeemed', value: fmt(o?.giftsRedeemed), sub: 'a week of Pro, all time', icon: <Gift className="w-3.5 h-3.5" />, href: '/admin/referrals' },
  ];

  const sortedModes = stats ? Object.entries(stats.modePopularity).sort((a, b) => b[1] - a[1]) : [];
  const maxModeGames = sortedModes.length > 0 ? sortedModes[0][1] : 1;
  const t = today.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        icon={LayoutDashboard}
        subtitle={new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        actions={
          <Link
            href="/admin/seasons"
            className={`inline-flex items-center gap-1.5 text-xs font-extrabold px-3 py-1.5 rounded-lg border ${season.active ? 'border-orange-200 bg-orange-50 text-orange-700' : 'border-gray-200 bg-white text-gray-500'}`}
          >
            <Ghost className="w-3.5 h-3.5" />
            {season.active ? `Halloween on · ${season.daysLeft}d left` : `Halloween in ${season.daysUntilStart}d`}
          </Link>
        }
      />

      {/* Core numbers */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
              <div className="h-4 bg-gray-100 rounded w-20 mb-2" />
              <div className="h-8 bg-gray-100 rounded w-16" />
            </div>
          ))}
        </div>
      ) : !stats ? (
        <div className="text-gray-500">Failed to load stats.</div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {statCards.map(({ label, value, icon: Icon, color, drill: dp }) => (
            <button
              type="button" key={label} onClick={() => drill(dp)}
              className="text-left bg-white rounded-xl border border-gray-200 p-4 transition hover:border-purple-300 hover:shadow-sm"
              title="Click for the rows behind this number"
            >
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">{label}</span>
              </div>
              <p className="text-2xl font-black text-gray-900">{value.toLocaleString()}</p>
            </button>
          ))}
        </div>
      )}

      {/* Today's dailies */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <DrillCard label="Played a daily today" value={fmt(t?.players)} sub={t ? `UTC ${t.day}` : 'loading'} icon={<Users className="w-3.5 h-3.5" />} drill={t ? { metric: 'plays', day: t.day } : undefined} />
        <LinkStat href="/admin/daily" label="Wordocious sweeps" value={fmt(t?.word.sweeps)} sub={t ? `${t.word.flawless} flawless · ${t.word.total} games` : ''} icon={<Sparkles className="w-3.5 h-3.5" />} />
        <LinkStat href="/admin/daily" label="Puzzle sweeps" value={fmt(t?.puzzles.sweeps)} sub={t ? `${t.puzzles.flawless} flawless · ${t.puzzles.total} Puzzles` : ''} icon={<Puzzle className="w-3.5 h-3.5" />} />
      </div>

      {/* The newer features at a glance */}
      <Section title="Features at a glance" icon={Sparkles} note={overview.error ? `Could not load: ${overview.error}` : '"—" means the table or column is not in the database yet.'}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {featureCards.map((c) => (
            <Link key={c.label} href={c.href} className="rounded-xl border border-gray-100 p-3 hover:border-purple-300 hover:bg-purple-50/30 transition">
              <div className="flex items-center gap-1.5 text-[11px] font-black text-gray-400 uppercase tracking-wide">{c.icon}{c.label}</div>
              <p className="text-xl font-black text-gray-900 mt-0.5">{overview.loading && !o ? '…' : c.value}</p>
              <p className="text-[11px] font-semibold text-gray-400 truncate">{c.sub}</p>
            </Link>
          ))}
        </div>
      </Section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Mode Popularity */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-4">Game Mode Popularity</h2>
          {sortedModes.length === 0 ? (
            <p className="text-sm text-gray-400">No game data yet.</p>
          ) : (
            <div className="space-y-3">
              {sortedModes.map(([mode, count]) => (
                <div key={mode}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-semibold text-gray-700">{modeLabel(mode)}</span>
                    <span className="font-bold text-gray-500">{count.toLocaleString()}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-500 rounded-full transition-all"
                      style={{ width: `${(count / maxModeGames) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-6">
          {/* Engineering Bible — latest entry, copyable */}
          <BibleCard />

          {/* Recent Signups */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-4">Recent Signups</h2>
            {!stats || stats.recentSignups.length === 0 ? (
              <p className="text-sm text-gray-400">No signups yet.</p>
            ) : (
              <div className="space-y-1">
                {stats.recentSignups.map(user => (
                  <Link
                    key={user.id}
                    href={`/admin/users/${user.id}`}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-sm font-black text-purple-600">
                      {user.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">
                        {user.username}
                        {user.is_pro && <span className="ml-1.5 text-[10px] font-extrabold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">PRO</span>}
                      </p>
                      <p className="text-xs text-gray-400">
                        Lvl {user.level} · {new Date(user.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <UserPlus className="w-4 h-4 text-gray-300" />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Directory */}
      <Section title="Jump to" icon={LayoutDashboard}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
          {ADMIN_NAV.filter((g) => g.title !== 'Overview').map((g) => (
            <div key={g.title}>
              <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1">{g.title}</p>
              <div className="space-y-0.5">
                {g.items.map(({ href, label, icon: Icon, blurb }) => (
                  <Link key={href} href={href} className="flex items-start gap-2 rounded-lg px-2 py-1.5 -mx-2 hover:bg-gray-50">
                    <Icon className="w-4 h-4 text-purple-500 mt-0.5 shrink-0" />
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-gray-900">{label}</span>
                      <span className="block text-xs font-medium text-gray-500">{blurb}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
