'use client';

import { CalendarCheck, CalendarDays, SpellCheck, Library } from 'lucide-react';
import { PageHeader } from '../components/admin-ui';
import { AdminTabs, useTabParam, type AdminTabDef } from '../components/admin-tabs';
import TodayTab from './today-tab';
import WordTab from './word-tab';
import BanksTab from './banks-tab';

// admin > Games & Puzzles > Dailies: one day of dailies, the Word of the Day
// schedule and the bank runway. Old /admin/words and /admin/banks redirect here
// (next.config.js). Each tab fetches its own data when opened.
const TABS: ReadonlyArray<AdminTabDef<'today' | 'word' | 'banks'>> = [
  { id: 'today', label: 'Today', icon: CalendarDays },
  { id: 'word', label: 'Word of the Day', icon: SpellCheck },
  { id: 'banks', label: 'Content banks', icon: Library },
];

export default function AdminDailiesPage() {
  const [tab, setTab] = useTabParam(TABS.map((t) => t.id), 'today');
  return (
    <div className="space-y-6">
      <PageHeader title="Dailies" icon={CalendarCheck} subtitle="The daily content: what was played, the Word of the Day schedule, and how many days each puzzle bank can still serve." />
      <AdminTabs tabs={TABS} value={tab} onChange={setTab} label="Dailies sections" />
      {tab === 'today' && <TodayTab />}
      {tab === 'word' && <WordTab />}
      {tab === 'banks' && <BanksTab />}
    </div>
  );
}
