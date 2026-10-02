'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
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
  FR, KIND_COLOR, REACTIONS, REACTION_LABEL, gameMomentText, kindForTitle, reactionChips, toggleReaction, type ReactionKey,
} from '@/lib/friends-play';
import { FrCard, FriendAvatar, GameIconSquare, SectionLabel } from './friends-ui';
import { SceneArt } from './invite-screens';
import { ArtScene } from '@/components/ui/art-scene';
import { CandyButton } from '@/components/ui/candy-button';
import { SoftNum } from '@/components/ui/soft-number';
import { ART_SIZE, PAGE_SCENES, artSrc, poseArt, type PoseArtName } from '@/lib/art';
import { FR_LOOK, frBar, frSurface, momentAccent, momentKey, momentPoses, numberRuns } from '@/lib/friends-look';
import { softMix } from '@/lib/soft-surface';
import { haptic } from '@/lib/haptics';
import { ReactionIcon, REACTION_TINT } from './reaction-icon';

// ACTIVITY — the Friends tab's feed (Stats + Friends redesign D3, founder
// 2026-09-26): the last seven days of your circle's moments — Daily Sweeps,
// Flawless Victories, podium / perfect / streak medals, all-time records set,
// More Games Sweeps — newest first, each row a door to the profile. Read-only
// over existing tables (/api/friends/feed). Friends overhaul §6 (2026-10-01):
// renamed MOMENTS, finished pocket games join the feed, and every moment takes
// fixed reactions (clap, fire, wow, grr, + Rematch on game moments). Founder
// 2026-10-01: no "+" chip — double-tap (double-click) a moment toggles clap,
// long-press (right-click) opens a floating reaction bar above it, and chips
// show inside the moment only once it has reactions. Finishing build K1
// (2026-10-02): every moment is an in-app notice — a tinted card in the
// event's color with its top bar, the sender's letter tile, a small cast pose
// that fits the event, the headline in Nunito Black with soft numbers and a
// candy action (Rematch / View); it slides in with a spring (off with Reduce
// Motion) and squishes on tap. AM1 (10-02): no phone emoji — reactions are our
// 3D art / word pills (./reaction-icon) in a candy tray; reacting pops + bursts.

const DOUBLE_TAP_MS = 300;

/** Art already on the Friends screen (the banner's O1 cheer, the add-friend card's I) — never repeated in a moment (A7). */
const SCREEN_POSES: PoseArtName[] = [poseArt('o1', 'cheer'), poseArt('i', 'reach')];
const LONG_PRESS_MS = 450;
const BURST_MS = 650;

/** AM1: the little spark burst when you react (globals.css .react-burst; off with Reduce Motion). */
function ReactBurst({ tint }: { tint: string }) {
  return (
    <span className="react-burst" aria-hidden="true" style={{ ['--burst' as string]: tint } as React.CSSProperties}>
      {[0, 1, 2, 3, 4, 5].map((i) => <i key={i} />)}
    </span>
  );
}

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
  // AM1: the reaction you just added pops + bursts (n restarts the animation on a repeat tap).
  const [burst, setBurst] = useState<{ id: string; key: ReactionKey; n: number } | null>(null);
  const burstTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (burstTimer.current) clearTimeout(burstTimer.current); }, []);
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
    if (on) {
      haptic('light'); // the press sound already plays via SquishHost
      setBurst({ id: e.id, key, n: Date.now() });
      if (burstTimer.current) clearTimeout(burstTimer.current);
      burstTimer.current = setTimeout(() => setBurst(null), BURST_MS);
    }
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
  // a double tap toggles clap instead.
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

  // K1: each moment is a notice card in its event's color, with a fitting cast
  // pose (never one already on the Friends screen, never twice — A7).
  const keys = shown.map((e) => momentKey(e, user.id));
  const poses = momentPoses(keys, SCREEN_POSES);

  return (
    <div className="space-y-2">
      <SectionLabel
        color={FR_LOOK.playLabel}
        right={<span className="text-[10px] font-black text-right" style={{ color: FR_LOOK.playLabel, letterSpacing: 0.8 }}>LAST 7 DAYS · DOUBLE-TAP OR HOLD TO REACT</span>}
      >
        Moments
      </SectionLabel>
      {events === null ? (
        <FrCard accent={FR_LOOK.pink}>
          <div className="p-3 space-y-2 animate-pulse" aria-hidden>
            {[0, 1, 2].map((i) => <div key={i} className="h-8 rounded-xl" style={{ background: softMix(FR_LOOK.pink, 0.16) }} />)}
          </div>
        </FrCard>
      ) : events.length === 0 ? (
        <FrCard accent={FR_LOOK.pink} bar={FR_LOOK.bannerBar}>
          <div className="flex flex-col items-center gap-2 p-4 text-center">
            {/* R, asleep: quiet in here (docs/ART_SPEC.md §7). */}
            <ArtScene scene={PAGE_SCENES.empty} />
            <p className="text-xs font-bold" style={{ color: FR_LOOK.rowSub }}>
              Quiet week so far. A sweep, a medal, a record or a game won by anyone in your circle shows up here.
            </p>
          </div>
        </FrCard>
      ) : (
        <div className="space-y-2">
          {shown.map((e, idx) => {
            const { text, icon } = describe(e);
            const chips = reactionChips(reactions[e.id]);
            const isGame = e.type === 'game';
            const open = picker === e.id;
            const pocket = isGame ? kindForTitle(e.gameTitle) : null;
            const accent = momentAccent(keys[idx], pocket ? KIND_COLOR[pocket] : null);
            const pose = poses[idx];
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
                className="notice-in relative cursor-pointer select-none"
                style={{
                  ...frSurface(accent, { radius: 16 }),
                  boxShadow: `0 6px 14px ${softMix(accent, 0.3)}55`,
                  touchAction: 'manipulation',
                  WebkitTouchCallout: 'none',
                  animationDelay: `${Math.min(idx, 8) * 45}ms`,
                }}
              >
                <div aria-hidden="true" style={{ ...frBar(accent, 5), borderRadius: '16px 16px 0 0' }} />
                <div className="flex items-start gap-2.5" style={{ padding: '8px 10px 9px' }}>
                  <FriendAvatar name={e.username} url={e.avatar_url} emoji={e.avatar_emoji} size={34} />
                  <div className="flex-1 min-w-0">
                    <span className="flex items-start gap-1.5">
                      <span className="shrink-0 pt-px">{icon}</span>
                      <span className="block text-[12.5px] font-black leading-snug" style={{ color: FR_LOOK.ink }}>
                        {numberRuns(text).map((r, i) => (r.num ? <SoftNum key={i} size={13}>{r.text}</SoftNum> : <span key={i}>{r.text}</span>))}
                      </span>
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      {chips.map((c) => {
                        const popped = burst?.id === e.id && burst.key === c.key;
                        return (
                          <button
                            key={c.key}
                            type="button"
                            onClick={(ev) => { ev.stopPropagation(); if (c.key === 'rematch' && !c.mine) rematch(e); else void react(e, c.key, !c.mine); }}
                            aria-pressed={c.mine}
                            aria-label={`${REACTION_LABEL[c.key]} ${c.count}`}
                            className="relative flex items-center gap-1 pl-1 pr-2 text-[11px] font-black rounded-full"
                            style={{
                              height: 26,
                              background: `linear-gradient(180deg, ${softMix(accent, c.mine ? 0.2 : 0.08)}, ${softMix(accent, c.mine ? 0.32 : 0.16)})`,
                              border: c.mine ? `1.5px solid ${accent}` : `1.5px solid ${softMix(accent, 0.3)}`,
                              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7)',
                              color: FR_LOOK.ink,
                            }}
                          >
                            <span key={popped ? burst!.n : 'still'} className={popped ? 'candy-badge-pop inline-flex' : 'inline-flex'}>
                              <ReactionIcon reaction={c.key} size={18} />
                            </span>
                            <SoftNum size={12}>{c.count}</SoftNum>
                            {popped && <ReactBurst key={burst!.n} tint={REACTION_TINT[c.key]} />}
                          </button>
                        );
                      })}
                      <span className="flex-1" />
                      <span className="text-[10px] font-extrabold" style={{ color: FR_LOOK.rowSub }}>{dayLabel(e.day, today)}</span>
                      {isGame && pocket ? (
                        <CandyButton size="sm" color="pink" icon="replay" onClick={(ev) => { ev.stopPropagation(); rematch(e); }}>Rematch</CandyButton>
                      ) : (
                        <CandyButton size="sm" color="purple" icon="eye" onClick={(ev) => { ev.stopPropagation(); router.push(href(e)); }} aria-label={`View ${e.me ? 'your stats' : `${e.username}'s profile`}`}>View</CandyButton>
                      )}
                    </div>
                  </div>
                  {e.type === 'gift' ? (
                    // T4: gift-shield moments wear the shield-guard art, small.
                    <SceneArt name="art-scene-shield-guard" height={40} className="shrink-0" style={{ marginTop: -2 }} />
                  ) : pose && (
                    <Image
                      src={artSrc(pose)}
                      alt=""
                      aria-hidden
                      width={ART_SIZE[pose][0]}
                      height={ART_SIZE[pose][1]}
                      loading="lazy"
                      draggable={false}
                      className="shrink-0 pointer-events-none select-none"
                      style={{ width: 40, height: 40, objectFit: 'contain', marginTop: -2 }}
                    />
                  )}
                </div>
                {open && (
                  <div
                    role="group"
                    aria-label="React"
                    className="gt-pop absolute z-30 flex items-center gap-1 p-1.5"
                    style={{
                      left: 42,
                      bottom: 'calc(100% - 4px)',
                      // AM1: a tinted candy tray (glossy pink wash, white top light, soft drop).
                      ...frSurface(FR_LOOK.pink, { share: 0.1, radius: 999 }),
                      background: `linear-gradient(180deg, ${softMix(FR_LOOK.pink, 0.14)}, ${softMix(FR_LOOK.pink, 0.26)})`,
                      boxShadow: `inset 0 2px 0 rgba(255,255,255,0.75), inset 0 -3px 0 ${softMix(FR_LOOK.pink, 0.36)}, 0 10px 26px rgba(60,30,110,0.2)`,
                    }}
                    onClick={(ev) => ev.stopPropagation()}
                  >
                    {REACTIONS.map((r) => {
                      const mine = (reactions[e.id]?.mine ?? []).includes(r.key);
                      return (
                        <button
                          key={r.key}
                          type="button"
                          onClick={() => { setPicker(null); void react(e, r.key, !mine); }}
                          aria-label={r.label}
                          aria-pressed={mine}
                          className={`flex items-center justify-center rounded-full ${mine ? 'candy-badge-pop' : ''}`}
                          style={{
                            minWidth: 38,
                            height: 38,
                            padding: '0 3px',
                            background: mine
                              ? `linear-gradient(180deg, #ffffff, ${softMix(REACTION_TINT[r.key], 0.3)})`
                              : `linear-gradient(180deg, rgba(255,255,255,0.85), ${softMix(FR_LOOK.pink, 0.12)})`,
                            boxShadow: mine
                              ? `0 0 0 2px ${FR.solid}, inset 0 1px 0 #fff, 0 3px 6px ${softMix(FR_LOOK.pink, 0.45)}`
                              : `inset 0 1px 0 #fff, 0 2px 4px ${softMix(FR_LOOK.pink, 0.4)}`,
                          }}
                        >
                          <ReactionIcon reaction={r.key} size={26} />
                        </button>
                      );
                    })}
                    {isGame && (
                      <CandyButton size="sm" color="pink" onClick={() => rematch(e)}>Rematch</CandyButton>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {events.length > 8 && (
            <div className="flex justify-center pt-1">
              <CandyButton size="sm" color="peach" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
                {expanded ? 'Show less' : `Show all ${events.length}`}
              </CandyButton>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
