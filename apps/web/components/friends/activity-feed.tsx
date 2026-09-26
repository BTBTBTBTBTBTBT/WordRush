'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Activity, Crown, Medal, Star, Flame, Sparkles, Trophy, LayoutGrid } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { fetchFriendsFeed, type FeedEvent } from '@/lib/friends-service';
import { getTodayLocal } from '@/lib/daily-service';
import { recordValue, RECORD_LABELS } from '@/lib/records-ui';
import { WIN_FG } from '@/lib/tile-theme';
import { Avatar } from './friends-panel';

// ACTIVITY — the Friends tab's feed (Stats + Friends redesign D3, founder
// 2026-09-26): the last seven days of your circle's moments — Daily Sweeps,
// Flawless Victories, podium / perfect / streak medals, all-time records set,
// More Games Sweeps — newest first, each row a door to the profile. Read-only
// over existing tables (/api/friends/feed). iOS/Android twins to follow.

function dayLabel(day: string, today: string): string {
  if (day === today) return 'today';
  const d = new Date(`${day}T00:00:00`);
  const t = new Date(`${today}T00:00:00`);
  const diff = Math.round((t.getTime() - d.getTime()) / 86_400_000);
  if (diff === 1) return 'yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}

function describe(e: FeedEvent): { text: string; icon: React.ReactNode } {
  const who = e.me ? 'You' : e.username;
  switch (e.type) {
    case 'flawless': return { text: `${who} won every daily — Flawless Victory`, icon: <Trophy className="w-4 h-4" style={{ color: '#b45309' }} fill="currentColor" /> };
    case 'sweep': return { text: `${who} swept the dailies`, icon: <Sparkles className="w-4 h-4" style={{ color: '#7c3aed' }} /> };
    case 'more_flawless': return { text: `${who} — Flawless More Games, all ten won`, icon: <LayoutGrid className="w-4 h-4" style={{ color: '#b45309' }} /> };
    case 'more_sweep': return { text: `${who} — More Games Sweep, all ten played`, icon: <LayoutGrid className="w-4 h-4" style={{ color: '#4f46e5' }} /> };
    case 'record': {
      const label = e.kind ? RECORD_LABELS[e.kind]?.label ?? e.kind : 'record';
      const val = e.kind && e.value != null ? recordValue(e.kind, e.value, e.gameMode) : '';
      return { text: `${who} set the all-time ${e.gameTitle ? `${e.gameTitle} ` : ''}${label}${val ? ` · ${val}` : ''}`, icon: <Star className="w-4 h-4" style={{ color: '#d97706' }} fill="currentColor" /> };
    }
    case 'medal':
    default: {
      const k = e.kind ?? '';
      if (k === 'gold') return { text: `${who} took gold in ${e.gameTitle ?? e.gameMode}`, icon: <Crown className="w-4 h-4" style={{ color: '#d97706' }} /> };
      if (k === 'silver') return { text: `${who} took silver in ${e.gameTitle ?? e.gameMode}`, icon: <Medal className="w-4 h-4" style={{ color: '#9ca3af' }} /> };
      if (k === 'bronze') return { text: `${who} took bronze in ${e.gameTitle ?? e.gameMode}`, icon: <Medal className="w-4 h-4" style={{ color: '#b45309' }} /> };
      if (k === 'perfect') return { text: `${who} played a perfect ${e.gameTitle ?? e.gameMode}`, icon: <Star className="w-4 h-4" style={{ color: WIN_FG }} fill="currentColor" /> };
      if (k.startsWith('streak_')) return { text: `${who} hit a ${k.slice(7)}-day streak`, icon: <Flame className="w-4 h-4" style={{ color: '#f97316' }} fill="currentColor" /> };
      return { text: `${who} earned a medal in ${e.gameTitle ?? e.gameMode}`, icon: <Medal className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} /> };
    }
  }
}

export function ActivityFeed() {
  const { user } = useAuth();
  const [events, setEvents] = useState<FeedEvent[] | null>(null);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (!user) return;
    let active = true;
    fetchFriendsFeed().then((ev) => { if (active) setEvents(ev); });
    return () => { active = false; };
  }, [user]);
  if (!user) return null;
  const today = getTodayLocal();
  const shown = events ? (expanded ? events : events.slice(0, 8)) : [];

  return (
    <div className="p-5 space-y-3" style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '20px' }}>
      <div className="flex items-center gap-2">
        <Activity className="w-5 h-5" style={{ color: '#7c3aed' }} />
        <h3 className="text-base font-black tracking-tight text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, #7c3aed, #ec4899)' }}>
          ACTIVITY
        </h3>
        <span className="text-[10px] font-bold ml-auto" style={{ color: 'var(--color-text-muted)' }}>last 7 days</span>
      </div>
      {events === null ? (
        <div className="space-y-2 animate-pulse">
          {[0, 1, 2].map((i) => <div key={i} className="h-8 rounded-xl" style={{ background: 'var(--color-border)' }} />)}
        </div>
      ) : events.length === 0 ? (
        <p className="text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>
          Quiet week so far — a sweep, a medal or a record from anyone in your circle shows up here.
        </p>
      ) : (
        <div className="space-y-1.5">
          {shown.map((e) => {
            const { text, icon } = describe(e);
            return (
              <Link
                key={e.id}
                href={e.me ? '/stats' : `/profile/${e.userId}`}
                className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:opacity-80 transition-opacity"
                style={{ background: e.me ? '#7c3aed10' : 'var(--color-bg)' }}
              >
                <Avatar f={{ id: e.userId, username: e.username, avatar_url: e.avatar_url, avatar_emoji: e.avatar_emoji, level: 0 }} />
                <span className="shrink-0">{icon}</span>
                <span className="flex-1 min-w-0 text-[11px] font-extrabold leading-snug" style={{ color: 'var(--color-text)' }}>{text}</span>
                <span className="text-[9px] font-bold shrink-0" style={{ color: 'var(--color-text-muted)' }}>{dayLabel(e.day, today)}</span>
              </Link>
            );
          })}
          {events.length > 8 && (
            <button onClick={() => setExpanded((v) => !v)} className="w-full py-1 text-[11px] font-extrabold" style={{ color: '#7c3aed' }}>
              {expanded ? 'Show less' : `Show all ${events.length}`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
