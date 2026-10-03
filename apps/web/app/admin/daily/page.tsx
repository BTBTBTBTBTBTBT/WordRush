'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CalendarCheck, Users, Sparkles, Puzzle, Swords, BookOpen, ChevronLeft, ChevronRight } from 'lucide-react';
import { DrillCard } from '../components/drill-panel';
import { PageHeader, ReloadButton, Section, Table, ErrorNote, LoadingGrid, Callout, fmt, useAdminData } from '../components/admin-ui';

interface Group {
  total: number;
  players: number;
  sweeps: number;
  flawless: number;
  perMode: Array<{ mode: string; label: string; plays: number; wins: number }>;
}
interface DailyHealth {
  day: string;
  players: number;
  word: Group;
  puzzles: Group;
  vsPlays: number | null;
  quiz: { answered: number | null; correct: number | null };
  seeds: string[] | null;
}

const shift = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const todayUtc = () => new Date().toISOString().slice(0, 10);

function GroupTable({ g }: { g: Group }) {
  return (
    <Table
      rows={g.perMode}
      rowKey={(r) => r.mode}
      columns={[
        { key: 'label', label: 'Game' },
        { key: 'plays', label: 'Plays', align: 'right', render: (r) => fmt(r.plays) },
        { key: 'wins', label: 'Won', align: 'right', render: (r) => `${fmt(r.wins)}${r.plays ? ` (${Math.round((100 * r.wins) / r.plays)}%)` : ''}` },
      ]}
    />
  );
}

export default function AdminDailyPage() {
  const [day, setDay] = useState(todayUtc());
  const { data, error, loading, reload } = useAdminData<DailyHealth>(`/api/admin/daily-health?day=${day}`);
  const zeroPlays = (g?: Group) => (g ? g.perMode.filter((m) => m.plays === 0).map((m) => m.label) : []);
  const silent = [...zeroPlays(data?.word), ...zeroPlays(data?.puzzles)];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Today's Dailies"
        icon={CalendarCheck}
        subtitle="One day of daily content, split like the Home banner: the Wordocious row (the sweep dailies) and the ten Puzzles. A daily with zero plays late in the day is the first sign a game is broken."
        actions={
          <>
            <button onClick={() => setDay(shift(day, -1))} className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50" aria-label="Previous day"><ChevronLeft className="w-4 h-4" /></button>
            <input type="date" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} className="text-xs font-bold border border-gray-200 rounded-lg px-2 py-1.5 bg-white" />
            <button onClick={() => setDay(shift(day, 1))} disabled={day >= todayUtc()} className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40" aria-label="Next day"><ChevronRight className="w-4 h-4" /></button>
            <ReloadButton onClick={reload} loading={loading} />
          </>
        }
      />
      {error && <ErrorNote>{error}</ErrorNote>}
      {!data && loading && <LoadingGrid />}

      {data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <DrillCard label="Players" value={fmt(data.players)} sub="solo dailies this day" icon={<Users className="w-3.5 h-3.5" />} drill={{ metric: 'plays', day: data.day }} />
            <DrillCard label="Wordocious sweeps" value={fmt(data.word.sweeps)} sub={`${fmt(data.word.flawless)} flawless · ${data.word.total} games`} icon={<Sparkles className="w-3.5 h-3.5" />} />
            <DrillCard label="Puzzle sweeps" value={fmt(data.puzzles.sweeps)} sub={`${fmt(data.puzzles.flawless)} flawless · ${data.puzzles.total} Puzzles`} icon={<Puzzle className="w-3.5 h-3.5" />} />
            <DrillCard label="VS dailies" value={fmt(data.vsPlays)} sub={`WOTD quiz: ${fmt(data.quiz.answered)} answered, ${fmt(data.quiz.correct)} right`} icon={<Swords className="w-3.5 h-3.5" />} />
          </div>

          {silent.length > 0 && data.players > 20 && (
            <Callout tone="amber">No plays yet for: <span className="font-bold">{silent.join(', ')}</span>. Check the game loads on each platform.</Callout>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Section title={`Wordocious · ${data.word.players} players`} icon={Sparkles}>
              <GroupTable g={data.word} />
            </Section>
            <Section title={`Puzzles · ${data.puzzles.players} players`} icon={Puzzle}>
              <GroupTable g={data.puzzles} />
            </Section>
          </div>

          <Section title="Seeds and banks" icon={BookOpen}>
            <p className="text-sm text-gray-600 font-medium">
              {data.seeds === null
                ? 'daily_seeds could not be read.'
                : data.seeds.length
                  ? `daily_seeds rows for ${data.day}: ${data.seeds.join(', ')}.`
                  : `No daily_seeds rows for ${data.day} (expected: every platform derives the dailies from the date hash and the bundled banks).`}
            </p>
            <p className="text-sm text-gray-600 font-medium mt-2">
              Bank runway per game is on <Link href="/admin/banks" className="font-bold text-purple-700">Content Banks</Link>; trends and difficulty over time are on <Link href="/admin/puzzles" className="font-bold text-purple-700">Puzzle Analytics</Link>.
            </p>
          </Section>
          <p className="text-[11px] font-semibold text-gray-400">
            daily_results.day is the player&apos;s local date, so &quot;today&quot; fills in across time zones. Sweeps here are counted from rows (trend-level); the sweep leaderboard uses its own RPCs.
          </p>
        </>
      )}
    </div>
  );
}
