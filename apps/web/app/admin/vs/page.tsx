'use client';

import Link from 'next/link';
import { Swords, Bot, Link2, Bell, Flag, CalendarDays, Trophy } from 'lucide-react';
import { BOT_CAST, botOfTheDay, botSolveLine, LADDER_CLEAR_RUN } from '@wordle-duel/core';
import { mascotSrc, type MascotId } from '@/lib/mascots';
import { DrillCard } from '../components/drill-panel';
import { PageHeader, ReloadButton, Section, BarList, Table, ErrorNote, LoadingGrid, Callout, fmt, ago, useAdminData } from '../components/admin-ui';

interface VsData {
  people: { matches7: number | null; matches1: number | null; forfeits7: number | null; pings7: number | null };
  challenges: {
    all: number | null; last7: number | null; open: number | null; entries7: number | null;
    byMode30: Array<{ key: string; count: number }>; links30: number; direct30: number;
    recent: Array<{ id: string; code: string; challengerId: string; challenger: string; mode: string; run: string; kind: string; entries: Array<{ player: string; outcome: string }>; created_at: string; open: boolean }>;
  };
  bots: {
    players: number;
    byMode: Array<{ mode: string; games: number; wins: number; losses: number; players: number }>;
    milestones: Array<{ key: string; count: number | null }>;
  };
}

const MILESTONE_LABEL: Record<string, string> = {
  wake_up_call: 'Beat Rip (rung 1)',
  halfway_hero: 'Cleared 5 rungs',
  boss_battle: 'Beat Webster (rung 10)',
  meet_the_cast: 'Beat all ten bots',
  daily_duelist: 'Beat the Bot of the Day 7×',
};

const dayPlus = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const weekday = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });

export default function AdminVsPage() {
  const { data, error, loading, reload } = useAdminData<VsData>('/api/admin/vs');
  const today = dayPlus(0);
  const botToday = botOfTheDay(today);

  return (
    <div className="space-y-6">
      <PageHeader
        title="VS & Bots"
        icon={Swords}
        subtitle="People VS matches, race-my-run challenges, and the ten-character bot cast. Ladder progress lives on each device, so the bot achievements are the server-side signal for it."
        actions={<ReloadButton onClick={reload} loading={loading} />}
      />
      {error && <ErrorNote>{error}</ErrorNote>}
      {!data && loading && <LoadingGrid />}

      {data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <DrillCard label="VS matches · 7d" value={fmt(data.people.matches7)} sub={`${fmt(data.people.matches1)} in the last 24h`} icon={<Swords className="w-3.5 h-3.5" />} drill={{ metric: 'matches' }} />
          <DrillCard label="Forfeits · 7d" value={fmt(data.people.forfeits7)} sub="quit = forfeit" icon={<Flag className="w-3.5 h-3.5" />} />
          <DrillCard label="Challenges · 7d" value={fmt(data.challenges.last7)} sub={`${fmt(data.challenges.open)} still open · ${fmt(data.challenges.all)} all time`} icon={<Link2 className="w-3.5 h-3.5" />} />
          <DrillCard label="'Ping me' senders · 7d" value={fmt(data.people.pings7)} sub={`${fmt(data.challenges.entries7)} challenge entries · 7d`} icon={<Bell className="w-3.5 h-3.5" />} />
        </div>
      )}

      <Section
        title="The bot cast"
        icon={Bot}
        note={`The ladder runs Rip → Webster; ${LADDER_CLEAR_RUN} wins in a row against the next bot clear its rung. Bot of the Day rotates by UTC weekday. Old ids map to the cast (rook → Ivy, lexi → Opal, nova → Dewey, adapt → Umi).`}
      >
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {BOT_CAST.map((b) => (
            <div key={b.id} className={`rounded-xl border p-3 text-center ${b.id === botToday.id ? 'border-purple-400 bg-purple-50' : 'border-gray-200'}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mascotSrc(b.castId as MascotId)} alt="" className="w-12 h-12 mx-auto object-contain" />
              <p className="text-sm font-black text-gray-900 mt-1">
                <span className="text-gray-400 font-bold mr-1">{b.rung}.</span>{b.name}
              </p>
              <p className="text-[11px] font-semibold text-gray-500">{b.trait}</p>
              <p className="text-[11px] font-bold mt-1" style={{ color: b.color }}>{botSolveLine(b)} · {b.tier}</p>
              {b.id === botToday.id && <p className="text-[10px] font-black text-purple-700 mt-1">BOT OF THE DAY</p>}
            </div>
          ))}
        </div>
      </Section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section title="Bot of the Day, next 7 days" icon={CalendarDays}>
          <div className="space-y-1.5">
            {Array.from({ length: 7 }).map((_, i) => {
              const d = dayPlus(i);
              const b = botOfTheDay(d);
              return (
                <div key={d} className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-gray-500 w-28">{i === 0 ? 'Today' : weekday(d)} <span className="text-gray-300">{d.slice(5)}</span></span>
                  <span className="font-black text-gray-900 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: b.color }} />
                    {b.name}
                  </span>
                </div>
              );
            })}
          </div>
        </Section>

        <Section title="Ladder milestones" icon={Trophy} note="Players who earned each bot achievement (server-side proxy for ladder progress).">
          {data ? (
            <BarList rows={data.bots.milestones.map((m) => ({ label: MILESTONE_LABEL[m.key] ?? m.key, count: m.count }))} />
          ) : <div className="h-28 bg-gray-100 rounded-lg animate-pulse" />}
        </Section>
      </div>

      {data && (
        <>
          <Section title="Bot games by mode (lifetime)" icon={Bot} note={`${fmt(data.bots.players)} players have played a bot. From user_stats (play_type vs_cpu); bot games never write match rows.`}>
            <Table
              rows={data.bots.byMode}
              rowKey={(r) => r.mode}
              columns={[
                { key: 'mode', label: 'Mode' },
                { key: 'games', label: 'Games', align: 'right', render: (r) => fmt(r.games) },
                { key: 'wins', label: 'Player wins', align: 'right', render: (r) => `${fmt(r.wins)} (${r.games ? Math.round((100 * r.wins) / r.games) : 0}%)` },
                { key: 'players', label: 'Players', align: 'right', render: (r) => fmt(r.players) },
              ]}
              empty="No bot games recorded."
            />
          </Section>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Section title="Challenges by mode · 30d" icon={Link2} note={`${data.challenges.links30} by link · ${data.challenges.direct30} sent to friends`}>
              <BarList rows={data.challenges.byMode30.map((t) => ({ label: t.key, count: t.count }))} empty="No challenges in 30 days." />
            </Section>
            <Section title="Recent challenges" icon={Swords} className="lg:col-span-2" note="Entry outcomes are from the entrant's side: a win means they beat the challenger's run.">
              <Table
                rows={data.challenges.recent}
                rowKey={(r) => r.id}
                columns={[
                  { key: 'challenger', label: 'Challenger', render: (r) => <Link href={`/admin/users/${r.challengerId}`} className="hover:text-purple-700">{r.challenger}</Link> },
                  { key: 'mode', label: 'Game' },
                  { key: 'run', label: 'Their run' },
                  { key: 'kind', label: 'Sent' },
                  { key: 'entries', label: 'Takers', render: (r) => r.entries.length ? r.entries.map((e) => `${e.player} (${e.outcome})`).join(', ') : (r.open ? 'open' : 'none') },
                  { key: 'created_at', label: 'When', align: 'right', render: (r) => ago(r.created_at) },
                ]}
                empty="No challenges yet."
              />
            </Section>
          </div>

          <Callout>
            People VS leaderboards and recent matches live on <Link href="/admin/games" className="font-bold text-purple-700">Games & Leaderboards</Link>; VS match health (stuck or abandoned matches) is on <Link href="/admin/ops" className="font-bold text-purple-700">Ops Health</Link>.
          </Callout>
        </>
      )}
    </div>
  );
}
