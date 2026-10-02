'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Crown, Medal, Star, Flame, Sparkles, Trophy, LayoutGrid, Shield, Plus } from 'lucide-react';
import type { FriendlyKind } from '@wordle-duel/core';
import { useAuth } from '@/lib/auth-context';
import { fetchFriendsFeed, reactToMoment, type FeedEvent, type FeedReactions } from '@/lib/friends-service';
import { getTodayLocal } from '@/lib/daily-service';
import { recordValue, RECORD_LABELS } from '@/lib/records-ui';
import { WIN_FG } from '@/lib/tile-theme';
import {
  FR, REACTIONS, REACTION_GLYPH, gameMomentText, kindForTitle, reactionChips, toggleReaction, type ReactionKey,
} from '@/lib/friends-play';
import { FriendAvatar, GameIconSquare, SectionLabel, cardStyle } from './friends-ui';

// ACTIVITY — the Friends tab's feed (Stats + Friends redesign D3, founder
// 2026-09-26): the last seven days of your circle's moments — Daily Sweeps,
// Flawless Victories, podium / perfect / streak medals, all-time records set,
// More Games Sweeps — newest first, each row a door to the profile. Read-only
// over existing tables (/api/friends/feed). Friends overhaul §6 (2026-10-01):
// renamed MOMENTS, finished pocket games join the feed, and every moment takes
// fixed-emoji reactions (👏 🔥 😱 😤, + Rematch on game moments).

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
    case 'game': {
      const kind = kindForTitle(e.gameTitle);
      return { text: gameMomentText(e), icon: kind ? <GameIconSquare kind={kind} size={20} /> : <Trophy className="w-4 h-4" style={{ color: FR.solid }} /> };
    }
    case 'gift': return { text: `${who} sent ${e.otherName ?? 'a friend'} a streak shield`, icon: <Shield className="w-4 h-4" style={{ color: '#0d9488' }} fill="currentColor" /> };
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

// Last feed per viewer for the session: the Friends tab remounts on every visit
// and this card used to drop to its skeleton each time, then pop the rows in
// (founder, 2026-09-29). The cached feed paints at once; the same read refreshes it.
const feedCache = new Map<string, { events: FeedEvent[]; reactions: FeedReactions }>();

interface Props {
  /** A Rematch reaction on a game moment opens the quick-play sheet with that game and friend. */
  onRematch: (kind: FriendlyKind, friendId: string) => void;
}

export function ActivityFeed({ onRematch }: Props) {
  const { user } = useAuth();
  const [fetched, setFetched] = useState<{ userId: string; events: FeedEvent[]; reactions: FeedReactions } | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [picker, setPicker] = useState<string | null>(null);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!user) return;
    let active = true;
    const userId = user.id;
    fetchFriendsFeed().then((r) => {
      const next = r ?? feedCache.get(userId) ?? { events: [], reactions: {} };
      feedCache.set(userId, next);
      if (active) setFetched({ userId, ...next });
    });
    return () => { active = false; };
  }, [user]);
  useEffect(() => {
    if (!picker) return;
    const close = (ev: MouseEvent) => { if (pickerRef.current && !pickerRef.current.contains(ev.target as Node)) setPicker(null); };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [picker]);
  if (!user) return null;
  const data = fetched?.userId === user.id ? fetched : (feedCache.get(user.id) ? { userId: user.id, ...feedCache.get(user.id)! } : null);
  const events = data?.events ?? null;
  const reactions = data?.reactions ?? {};
  const today = getTodayLocal();
  const shown = events ? (expanded ? events : events.slice(0, 8)) : [];

  const react = async (e: FeedEvent, key: ReactionKey, on: boolean) => {
    const before = reactions[e.id];
    const apply = (slot: typeof before) => {
      const nextReactions = { ...reactions, [e.id]: slot as FeedReactions[string] };
      const next = { userId: user.id, events: events ?? [], reactions: nextReactions };
      feedCache.set(user.id, { events: next.events, reactions: nextReactions });
      setFetched(next);
    };
    apply(toggleReaction(before, key, on) as FeedReactions[string]);
    const ok = await reactToMoment(e.id, e.userId, key, on);
    if (!ok) apply(before ?? { counts: {}, mine: [] });
  };

  const rematch = (e: FeedEvent) => {
    const kind = kindForTitle(e.gameTitle);
    const friendId = e.me ? e.otherId : e.userId;
    setPicker(null);
    if (!(reactions[e.id]?.mine ?? []).includes('rematch')) void react(e, 'rematch', true);
    if (kind && friendId) onRematch(kind, friendId);
  };

  return (
    <div className="space-y-2">
      <SectionLabel right={<span className="text-[10px] font-bold" style={{ color: FR.label }}>last 7 days</span>}>Moments</SectionLabel>
      <div className="p-3" style={cardStyle}>
        {events === null ? (
          <div className="space-y-2 animate-pulse">
            {[0, 1, 2].map((i) => <div key={i} className="h-8 rounded-xl" style={{ background: '#f1f5f9' }} />)}
          </div>
        ) : events.length === 0 ? (
          <p className="text-xs font-bold p-1" style={{ color: FR.label }}>
            Quiet week so far. A sweep, a medal, a record or a game won by anyone in your circle shows up here.
          </p>
        ) : (
          <div className="space-y-1">
            {shown.map((e, idx) => {
              const { text, icon } = describe(e);
              const chips = reactionChips(reactions[e.id]);
              const isGame = e.type === 'game';
              return (
                <div key={e.id} className="px-1 py-1.5" style={{ borderTop: idx === 0 ? undefined : '1px solid #f1f5f9' }}>
                  <Link
                    href={e.me ? '/stats' : `/profile/${e.userId}`}
                    className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
                  >
                    <FriendAvatar name={e.username} url={e.avatar_url} emoji={e.avatar_emoji} size={32} />
                    <span className="shrink-0">{icon}</span>
                    <span className="flex-1 min-w-0 text-[11.5px] font-extrabold leading-snug" style={{ color: FR.text }}>{text}</span>
                    <span className="text-[9.5px] font-bold shrink-0" style={{ color: FR.label }}>{dayLabel(e.day, today)}</span>
                  </Link>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5" style={{ paddingLeft: 42 }}>
                    {chips.map((c) => (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => (c.key === 'rematch' && !c.mine ? rematch(e) : react(e, c.key, !c.mine))}
                        aria-pressed={c.mine}
                        aria-label={`${c.key} ${c.count}`}
                        className="flex items-center gap-1 px-2 text-[11px] font-black rounded-full transition-transform active:scale-95"
                        style={{ height: 24, background: FR.soft, color: FR.mid, boxShadow: c.mine ? `0 0 0 1.5px ${FR.solid}` : undefined }}
                      >
                        <span>{REACTION_GLYPH[c.key]}</span>
                        <span>{c.count}</span>
                      </button>
                    ))}
                    <div className="relative" ref={picker === e.id ? pickerRef : undefined}>
                      <button
                        type="button"
                        onClick={(ev) => { ev.stopPropagation(); setPicker((p) => (p === e.id ? null : e.id)); }}
                        aria-label="React"
                        aria-expanded={picker === e.id}
                        className="flex items-center justify-center rounded-full transition-transform active:scale-95"
                        style={{ width: 24, height: 24, background: FR.soft, color: FR.mid }}
                      >
                        <Plus className="w-3.5 h-3.5" strokeWidth={2.8} />
                      </button>
                      {picker === e.id && (
                        <div
                          className="absolute left-0 bottom-8 z-30 flex items-center gap-1 p-1.5"
                          style={{ background: '#ffffff', borderRadius: 999, boxShadow: '0 8px 24px rgba(15,23,42,0.16)' }}
                        >
                          {REACTIONS.map((r) => {
                            const mine = (reactions[e.id]?.mine ?? []).includes(r.key);
                            return (
                              <button
                                key={r.key}
                                type="button"
                                onClick={() => { setPicker(null); void react(e, r.key, !mine); }}
                                aria-label={r.key}
                                aria-pressed={mine}
                                className="flex items-center justify-center rounded-full text-[17px] transition-transform active:scale-90"
                                style={{ width: 34, height: 34, background: mine ? FR.soft : 'transparent' }}
                              >
                                {r.glyph}
                              </button>
                            );
                          })}
                          {isGame && (
                            <button
                              type="button"
                              onClick={() => rematch(e)}
                              className="px-3 text-[11px] font-black text-white rounded-full whitespace-nowrap"
                              style={{ height: 30, background: FR.solid }}
                            >
                              Rematch
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {events.length > 8 && (
              <button onClick={() => setExpanded((v) => !v)} className="w-full py-1 text-[11px] font-extrabold" style={{ color: FR.solid }}>
                {expanded ? 'Show less' : `Show all ${events.length}`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
