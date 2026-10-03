'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MessageSquareText, Bell } from 'lucide-react';
import { PUSH_COPY, PUSH_TITLE, pushCopy, type PushKind } from '@wordle-duel/core';
import { PageHeader, Section, Callout } from '../components/admin-ui';

// admin > Content & Ops > Push Copy: every push / reminder message from the ONE
// shared bank (packages/core push-copy.ts, used by the web server pushes and
// the native local reminders), rendered with sample values. Read-only: the
// copy changes in code (pinned by push-copy-fixtures.json), never here.

const SENT_BY: Record<PushKind, string> = {
  friendBeat: 'Friends: a friend beat your time (friends/beat-check)',
  yourTurn: 'Pocket games: a friend moved (friends/games/move)',
  streakReminder: 'iOS + Android local streak reminder',
  shieldUsed: 'In the bank; no sender wired yet',
  challengeReceived: 'VS challenge or friends challenge sent to you',
  friendRequest: 'Friends: a new friend request',
  giftReceived: 'In the bank; no sender wired yet',
  dailyReady: 'Daily reminder cron (14:00 UTC)',
};

export default function AdminPushCopyPage() {
  const [name, setName] = useState('Jasson');
  const [game, setGame] = useState('Classic');
  const [days, setDays] = useState(12);
  const kinds = Object.keys(PUSH_COPY) as PushKind[];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Push Copy"
        icon={MessageSquareText}
        subtitle="Every push and reminder in the cast voice, from the one shared copy bank that web, iOS and Android all use. Change the sample values to preview."
      />

      <Section title="Sample values">
        <div className="flex flex-wrap gap-3">
          <label className="text-xs font-bold text-gray-500">Name
            <input value={name} onChange={(e) => setName(e.target.value)} className="block mt-1 text-sm font-semibold border border-gray-200 rounded-md px-2 py-1 w-40" />
          </label>
          <label className="text-xs font-bold text-gray-500">Game
            <input value={game} onChange={(e) => setGame(e.target.value)} className="block mt-1 text-sm font-semibold border border-gray-200 rounded-md px-2 py-1 w-40" />
          </label>
          <label className="text-xs font-bold text-gray-500">Streak days
            <input type="number" min={0} value={days} onChange={(e) => setDays(Number(e.target.value) || 0)} className="block mt-1 text-sm font-semibold border border-gray-200 rounded-md px-2 py-1 w-24" />
          </label>
        </div>
      </Section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {kinds.map((k) => (
          <div key={k} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded">{k}</span>
              <span className="text-[11px] font-semibold text-gray-400 text-right">{SENT_BY[k] ?? ''}</span>
            </div>
            {/* A lock-screen style preview */}
            <div className="rounded-2xl bg-gray-100 px-3 py-2.5 flex gap-2.5 items-start">
              <span className="w-8 h-8 rounded-lg bg-purple-600 text-white flex items-center justify-center shrink-0"><Bell className="w-4 h-4" /></span>
              <div className="min-w-0">
                <p className="text-[13px] font-black text-gray-900">{PUSH_TITLE}</p>
                <p className="text-[13px] font-medium text-gray-700">{pushCopy(k, { name, game, days })}</p>
              </div>
            </div>
            <p className="text-[11px] font-mono text-gray-400 mt-2 break-words">{PUSH_COPY[k]}</p>
          </div>
        ))}
      </div>

      <Callout>
        Some senders put the line in the title instead of the body (friend beat, your turn, VS challenge). Broadcast campaigns with custom text are on <Link href="/admin/marketing" className="font-bold text-purple-700">Marketing</Link>; a test push to your own devices is on <Link href="/admin/messaging" className="font-bold text-purple-700">Messaging</Link>.
      </Callout>
    </div>
  );
}
