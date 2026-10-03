'use client';

import { useState } from 'react';
import { UserPlus, Filter, CalendarDays } from 'lucide-react';
import { PageHeader, ReloadButton, Section, BarList, ErrorNote, LoadingGrid, Callout, fmt, useAdminData } from '../components/admin-ui';

interface OnboardingData {
  days: number;
  mascotTracked: boolean;
  funnel: Array<{ label: string; count: number; pct: number }>;
  perDay: Array<{ key: string; count: number }>;
}

const WINDOWS = [7, 14, 30, 60];

export default function AdminOnboardingPage() {
  const [days, setDays] = useState(14);
  const { data, error, loading, reload } = useAdminData<OnboardingData>(`/api/admin/onboarding?days=${days}`);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Onboarding"
        icon={UserPlus}
        subtitle="How new players activate after the first-run welcome and guided profile setup, measured from data the app already stores."
        actions={
          <>
            <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="text-xs font-bold border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
              {WINDOWS.map((d) => <option key={d} value={d}>Signups, last {d} days</option>)}
            </select>
            <ReloadButton onClick={reload} loading={loading} />
          </>
        }
      />

      <Callout tone="purple">
        The tour itself (welcome, quick tour, username, mascot maker, all set) is remembered per device with the <span className="font-mono">onboarded-v2</span> flag and isn&apos;t sent to the server, so its individual steps can&apos;t be counted. This funnel uses saved mascots, daily results and friendships instead.
      </Callout>

      {error && <ErrorNote>{error}</ErrorNote>}
      {!data && loading && <LoadingGrid />}

      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Section
            title={`Activation · signups in the last ${data.days} days`}
            icon={Filter}
            note={data.mascotTracked ? 'Each step is a share of everyone who signed up in the window.' : 'avatar_config is not in the database yet, so "Saved a mascot" reads 0.'}
          >
            <div className="space-y-3">
              {data.funnel.map((s, i) => (
                <div key={s.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-semibold text-gray-700"><span className="text-gray-300 mr-1.5">{i + 1}</span>{s.label}</span>
                    <span className="font-bold text-gray-500 tabular-nums">{fmt(s.count)} · {s.pct}%</span>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500 rounded-full" style={{ width: `${s.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </Section>
          <Section title="Signups per day" icon={CalendarDays}>
            <BarList rows={[...data.perDay].reverse().map((d) => ({ label: d.key, count: d.count }))} empty="No signups in this window." />
          </Section>
        </div>
      )}
    </div>
  );
}
