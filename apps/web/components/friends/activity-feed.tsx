'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Medal, Star, Sparkles, LayoutGrid } from 'lucide-react';
import { Icon3D } from '@/components/ui/icon3d';
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
import { ArtScene } from '@/components/ui/art-scene';
import { PAGE_SCENES } from '@/lib/art';

// ACTIVITY — the Friends tab's feed (Stats + Friends redesign D3, founder
// 2026-09-26): the last seven days of your circle's moments — Daily Sweeps,
// Flawless Victories, podium / perfect / streak medals, all-time records set,
// More Games Sweeps — newest first, each row a door to the profile. Read-only
// over existing tables (/api/friends/feed). Friends overhaul §6 (2026-10-01):
// renamed MOMENTS, finished pocket games join the feed, and every moment takes
// fixed-emoji reactions (👏 🔥 😱 😤, + Rematch on game moments). Founder
// 2026-10-01: no "+" chip — double-tap (double-click) a moment toggles 👏,
// long-press (right-click) opens a floating reaction bar above it, and chips
// show inside the moment only once it has reactions.

const DOUBLE_TAP_MS = 300;
const LONG_PRESS_MS = 450;

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
    case 'flawless': return { text: `${who} won every daily — Flawless Victory`, icon: <Icon3D name="trophy" size={16} /> };
    case 'sweep': return { text: `${who} swept the dailies`, icon: <Sparkles className="w-4 h-4" style={{ color: '#7c3aed' }} /> };
    case 'more_flawless': return { text: `${who} — Flawless More Games, all ten won`, icon: <LayoutGrid className="w-4 h-4" style={{ color: '#b45309' }} /> };
    case 'more_sweep': return { text: `${who} — More Games Sweep, all ten played`, icon: <LayoutGrid className="w-4 h-4" style={{ color: '#4f46e5' }} /> };
    case 'game': {
      const kind = kindForTitle(e.gameTitle);
      return { text: gameMomentText(e), icon: kind ? <GameIconSquare kind={kind} size={20} /> : <Icon3D name="trophy" size={16} /> };
    }
    case 'gift': return { text: `${who} sent ${e.otherName ?? 'a friend'} a streak shield`, icon: <Icon3D name="shield" size={16} /> };
    case 'record': {
      const label = e.kind ? RECORD_LABELS[e.kind]?.label ?? e.kind : 'record';
      const val = e.kind && e.value != null ? recordValue(e.kind, e.value, e.gameMode) : '';
      return { text: `${who} set the all-time ${e.gameTitle ? `${e.gameTitle} ` : ''}${label}${val ? ` · ${val}` : ''}`, icon: <Star className="w-4 h-4" style={{ color: '#d97706' }} fill="currentColor" /> };
    }
    case 'medal':
    default: {
      const k = e.kind ?? '';
      if (k === 'gold') return { text: `${who} took gold in ${e.gameTitle ?? e.gameMode}`, icon: <Icon3D name="crown" size={16} /> };
      if (k === 'silver') return { text: `${who} took silver in ${e.gameTitle ?? e.gameMode}`, icon: <Medal className="w-4 h-4" style={{ color: '#9ca3af' }} /> };
      if (k === 'bronze') return { text: `${who} took bronze in ${e.gameTitle ?? e.gameMode}`, icon: <Medal className="w-4 h-4" style={{ color: '#b45309' }} /> };
      if (k === 'perfect') return { text: `${who} played a perfect ${e.gameTitle ?? e.gameMode}`, icon: <Star className="w-4 h-4" style={{ color: WIN_FG }} fill="currentColor" /> };
      if (k.startsWith('streak_')) return { text: `${who} hit a ${k.slice(7)}-day streak`, icon: <Icon3D name="flame" size={16} /> };
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
  const router = useRouter();
  const lastTap = useRef<{ id: string; t: number } | null>(null);
  const navTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClick = useRef(false);
  useEffect(() => () => {
    if (navTimer.current) clearTimeout(navTimer.current);
    if (pressTimer.current) clearTimeout(pressTimer.current);
  }, []);
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

  const href = (e: FeedEvent) => (e.me ? '/stats' : `/profile/${e.userId}`);

  // One tap opens the profile (after a beat, so a second tap can claim it);
  // a double tap toggles 👏 instead.
  const onRowClick = (e: FeedEvent) => {
    if (suppressClick.current) { suppressClick.current = false; return; }
    if (picker) { setPicker(null); return; }
    const now = Date.now();
    if (lastTap.current && lastTap.current.id === e.id && now - lastTap.current.t < DOUBLE_TAP_MS) {
      lastTap.current = null;
      if (navTimer.current) { clearTimeout(navTimer.current); navTimer.current = null; }
      const mine = (reactions[e.id]?.mine ?? []).includes('clap');
      void react(e, 'clap', !mine);
      return;
    }
    lastTap.current = { id: e.id, t: now };
    if (navTimer.current) clearTimeout(navTimer.current);
    navTimer.current = setTimeout(() => { navTimer.current = null; router.push(href(e)); }, DOUBLE_TAP_MS);
  };

  const openBar = (e: FeedEvent) => {
    if (navTimer.current) { clearTimeout(navTimer.current); navTimer.current = null; }
    lastTap.current = null;
    setPicker(e.id);
  };

  const pressStart = (e: FeedEvent, ev: React.PointerEvent) => {
    if (ev.pointerType === 'mouse') return; // right-click covers the mouse
    suppressClick.current = false; // a fresh press; only a long-press's own click is swallowed
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = setTimeout(() => { pressTimer.current = null; suppressClick.current = true; openBar(e); }, LONG_PRESS_MS);
  };
  const pressEnd = () => {
    if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; }
  };

  return (
    <div className="space-y-2">
      <SectionLabel right={<span className="text-[10px] font-black" style={{ color: FR.label, letterSpacing: 0.8 }}>LAST 7 DAYS · DOUBLE-TAP OR HOLD TO REACT</span>}>Moments</SectionLabel>
      <div className="p-3" style={cardStyle}>
        {events === null ? (
          <div className="space-y-2 animate-pulse">
            {[0, 1, 2].map((i) => <div key={i} className="h-8 rounded-xl" style={{ background: '#f1f5f9' }} />)}
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-1 text-center">
            {/* R, asleep: quiet in here (docs/ART_SPEC.md §7). */}
            <ArtScene scene={PAGE_SCENES.empty} />
            <p className="text-xs font-bold" style={{ color: FR.label }}>
              Quiet week so far. A sweep, a medal, a record or a game won by anyone in your circle shows up here.
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {shown.map((e, idx) => {
              const { text, icon } = describe(e);
              const chips = reactionChips(reactions[e.id]);
              const isGame = e.type === 'game';
              const open = picker === e.id;
              return (
                <div
                  key={e.id}
                  ref={open ? pickerRef : undefined}
                  role="link"
                  tabIndex={0}
                  aria-label={`${text}. Double-tap to clap, hold to react.`}
                  onClick={() => onRowClick(e)}
                  onKeyDown={(ev) => { if (ev.key === 'Enter') router.push(href(e)); }}
                  onContextMenu={(ev) => { ev.preventDefault(); pressEnd(); openBar(e); }}
                  onPointerDown={(ev) => pressStart(e, ev)}
                  onPointerUp={pressEnd}
                  onPointerLeave={pressEnd}
                  onPointerCancel={pressEnd}
                  className="relative px-1 py-1.5 cursor-pointer select-none"
                  style={{ borderTop: idx === 0 ? undefined : '1px solid #f1f5f9', touchAction: 'manipulation', WebkitTouchCallout: 'none' }}
                >
                  <div className="flex items-start gap-2.5">
                    <FriendAvatar name={e.username} url={e.avatar_url} emoji={e.avatar_emoji} size={32} />
                    <span className="shrink-0 pt-1.5">{icon}</span>
                    <div className="flex-1 min-w-0 pt-1">
                      <span className="block text-[11.5px] font-extrabold leading-snug" style={{ color: FR.text }}>{text}</span>
                      {chips.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 mt-1">
                          {chips.map((c) => (
                            <button
                              key={c.key}
                              type="button"
                              onClick={(ev) => { ev.stopPropagation(); if (c.key === 'rematch' && !c.mine) rematch(e); else void react(e, c.key, !c.mine); }}
                              aria-pressed={c.mine}
                              aria-label={`${c.key} ${c.count}`}
                              className="flex items-center gap-0.5 px-1.5 text-[11px] font-black rounded-full transition-transform active:scale-95"
                              style={{ height: 20, background: FR.soft, color: FR.mid, boxShadow: c.mine ? `0 0 0 1.5px ${FR.solid}` : undefined }}
                            >
                              <span>{REACTION_GLYPH[c.key]}</span>
                              <span>{c.count}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <span className="text-[9.5px] font-bold shrink-0 pt-1.5" style={{ color: FR.label }}>{dayLabel(e.day, today)}</span>
                  </div>
                  {open && (
                    <div
                      className="absolute z-30 flex items-center gap-1 p-1.5"
                      style={{ left: 42, bottom: 'calc(100% - 4px)', background: '#ffffff', borderRadius: 999, boxShadow: '0 8px 24px rgba(15,23,42,0.16)' }}
                      onClick={(ev) => ev.stopPropagation()}
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
                            style={{ width: 34, height: 34, background: mine ? FR.soft : 'transparent', boxShadow: mine ? `0 0 0 1.5px ${FR.solid}` : undefined }}
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
