'use client';

// THE FRIENDS TAB (Friends overhaul, founder-approved 2026-10-01; spec
// docs/FRIENDS_REDESIGN_SPEC.md §2; finishing build C4 + C4b, docs/FINISH_SPEC.md).
// Top to bottom (under the shared AppHeader): the FRIENDS headline (nothing
// beside it — the notification prefs moved into Settings), the Friends banner (ON NOW + TODAY'S RACE, the full race in a
// sheet), YOUR TURN, PLAY WITH
// FRIENDS, THIS WEEK'S RACE, YOUR FRIENDS (presence, friend streak, one action
// pill), INVITES, MOMENTS with reactions, and Add by username + share link. The
// page adds the InvitePanel under it. Earlier history: §207 (friends card),
// §212/§216/§225/§232/§238 (rows, weekly race), D3 (Today's Race, feed).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Users, X, ChevronDown, MoreHorizontal } from 'lucide-react';
import { PageHeadline } from '@/components/ui/page-headline';
import { CandyButton, CandyIcon, candyClass } from '@/components/ui/candy-button';
import { SoftNum } from '@/components/ui/soft-number';
import { CandyBadge } from '@/components/ui/candy-badge';
import { Icon3D } from '@/components/ui/icon3d';
import { UiIcon } from '@/components/ui/ui-icon';
import { FRIENDLY_KINDS, FRIENDLY_TITLES, type FriendlyKind } from '@wordle-duel/core';
import { FRIEND_TAUNTS } from '@/lib/friends-taunts';
import { useAuth } from '@/lib/auth-context';
import { shareWeeklyRaceCard } from '@/lib/leaderboard-share-flow';
import { SWEEP_MODES } from '@/lib/modes.generated';
import { ordinal as ordinalOf } from '@/lib/weekly-race';
import { vsHrefForMode } from '@/lib/invite-service';
import { supabase } from '@/lib/supabase-client';
import {
  loadFriends, friendsLoaded, getFriends, getIncoming, getOutgoing, acceptFriend, declineFriend, requestFriend,
  onFriendsChange, searchUsers, isFriend, hasRequested, getMeDigest, remindFriend, removeFriend, sendTaunt,
  getLastWeekResult, giftShield, challengeFriend, type FriendProfile,
} from '@/lib/friends-service';
import { getActiveGames, loadGames, onGamesChange, type GameView } from '@/lib/friendly-games-client';
import {
  FR, KIND_COLOR, KIND_SUB, bannerModel, bestFriendStreak, friendAction, friendLine, midnightClock, nobodyOnLine, onNow,
  raceChips, sortActiveGames,
} from '@/lib/friends-play';
import { TodaysRace } from './todays-race';
import { ActivityFeed } from './activity-feed';
import { FriendsBanner } from './friends-banner';
import { QuickPlaySheet } from './quick-play-sheet';
import { FlameCount, FrCard, FriendAvatar, GameIconSquare, Pill, PocketGameCard, SectionLabel, Sheet, cardStyle } from './friends-ui';
import { GREEN_CANDY, InviteSentCard, NewFriendsModal, PendingPill, ShieldNotice, type InvitePerson } from './invite-screens';
import { WATCHED_REQUESTS_KEY, giftShareText, inviteShareText, parseWatched, trackRequests } from '@/lib/invite-screens';
import { FR_LOOK, frBar, frSurface, podiumSlots, rowStripe } from '@/lib/friends-look';
import { ART_SIZE, artSrc, poseArt } from '@/lib/art';
import { softMix } from '@/lib/soft-surface';
import { LevelBadge } from '@/components/badges/badge-art';
import { FeedbackPill } from '@/components/game/feedback-toast';

/** The add-friend window's cast pose: I reaching out (not the Friends host, O1 — A7). */
const ADD_POSE = poseArt('i', 'reach');

/** A danger candy (Unfriend): the candy look recolored red. */
const DANGER = { ['--candy-1' as string]: '#fb7185', ['--candy-2' as string]: '#dc2626', ['--candy-lip' as string]: '#8f1919' } as React.CSSProperties;

/** Accepted within the last 24h — wears the NEW chip (Tier 2, Aug 11). */
function isNewFriend(f: FriendProfile): boolean {
  if (!f.since) return false;
  const t = Date.parse(f.since);
  return Number.isFinite(t) && Date.now() - t < 24 * 60 * 60 * 1000;
}

/** "2d" / "5h" / "now" — how long a sent invite has been waiting (§212). */
function agoShort(iso?: string): string {
  if (!iso) return '';
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms) || ms < 0) return '';
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return 'now';
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

const withinDay = (iso?: string | null): boolean =>
  !!iso && Date.now() - Date.parse(iso) < 24 * 60 * 60 * 1000;

/** Small avatar used by Today's Race and older callers. */
export function Avatar({ f }: { f: FriendProfile }) {
  return <FriendAvatar name={f.username} url={f.avatar_url} emoji={f.avatar_emoji} size={32} />;
}

type SheetState =
  | { type: 'play'; friend: FriendProfile | null; kind: FriendlyKind }
  | { type: 'race' }
  | null;

export function FriendsPanel() {
  const { user, profile, isProActive } = useAuth();
  const router = useRouter();
  const [ver, force] = useState(0);
  const [username, setUsername] = useState('');
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [inviteNote, setInviteNote] = useState<string | null>(null);
  const addRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (!inviteNote) return;
    const t = setTimeout(() => setInviteNote(null), 2500);
    return () => clearTimeout(t);
  }, [inviteNote]);
  const [suggestions, setSuggestions] = useState<FriendProfile[]>([]);
  const [tauntTarget, setTauntTarget] = useState<FriendProfile | null>(null);
  const [tauntStatus, setTauntStatus] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [unfriendTarget, setUnfriendTarget] = useState<FriendProfile | null>(null);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [challenging, setChallenging] = useState<string | null>(null);
  /** T1: the request just sent ("@name"), shown on the invite-sent card until Done. */
  const [sentTo, setSentTo] = useState<string | null>(null);
  /** T3: the friend just made (accepted here, a mutual request, or — the inviter's side — a watched request accepted). */
  const [newFriend, setNewFriend] = useState<(InvitePerson & { id: string }) | null>(null);
  /** T4: the gift-shield notice (shield-guard art). */
  const [shieldNote, setShieldNote] = useState<string | null>(null);
  useEffect(() => {
    if (!shieldNote) return;
    const t = setTimeout(() => setShieldNote(null), 3500);
    return () => clearTimeout(t);
  }, [shieldNote]);
  const [games, setGames] = useState<GameView[]>(() => getActiveGames());
  useEffect(() => {
    if (!menuFor) return;
    const close = () => setMenuFor(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [menuFor]);

  const [settled, setSettled] = useState(() => friendsLoaded());
  useEffect(() => {
    if (!user) return;
    loadFriends().then(() => { setSettled(true); force((v) => v + 1); });
    return onFriendsChange(() => force((v) => v + 1));
  }, [user]);

  // Live while the tab is open and visible: games every 15 s (your turn moves to
  // the top), the friends digest every 60 s (ON NOW follows the heartbeats).
  useEffect(() => {
    if (!user) return;
    const off = onGamesChange(() => setGames([...getActiveGames()]));
    void loadGames(true);
    const visible = () => document.visibilityState === 'visible';
    const g = setInterval(() => { if (visible()) void loadGames(true); }, 15_000);
    const f = setInterval(() => { if (visible()) void loadFriends(true); }, 60_000);
    return () => { off(); clearInterval(g); clearInterval(f); };
  }, [user]);

  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(null), 2500);
    return () => clearTimeout(t);
  }, [note]);

  // T3, the inviter's side: this browser watches the requests you sent (per
  // account, in localStorage); when one shows up in your friends list (the
  // digest refreshes every 60 s while the tab is open, and on every visit)
  // the NEW FRIENDS! window celebrates it once.
  useEffect(() => {
    if (!user || !friendsLoaded()) return;
    const key = `${WATCHED_REQUESTS_KEY}:${user.id}`;
    let watched: string[] = [];
    try { watched = parseWatched(window.localStorage.getItem(key)); } catch { /* storage blocked */ }
    const list = getFriends();
    const { accepted, watch } = trackRequests(watched, getOutgoing().map((r) => r.id), list.map((f) => f.id));
    try { window.localStorage.setItem(key, JSON.stringify(watch)); } catch { /* storage blocked */ }
    const f = accepted.length > 0 ? list.find((x) => x.id.toLowerCase() === accepted[0].toLowerCase()) : undefined;
    if (f) setNewFriend((cur) => cur ?? { id: f.id, name: f.username, url: f.avatar_url, emoji: f.avatar_emoji });
  }, [user, settled, ver]);

  useEffect(() => {
    const q = username.trim().replace(/^@/, '');
    if (q.length < 2) { setSuggestions([]); return; }
    let stale = false;
    const t = setTimeout(async () => {
      const users = await searchUsers(q);
      if (!stale) setSuggestions(users.filter((u) => !isFriend(u.id) && !hasRequested(u.id)));
    }, 250);
    return () => { stale = true; clearTimeout(t); };
  }, [username]);

  // One clock for the banner (to local midnight), the weekly race and presence.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const [sharingRace, setSharingRace] = useState(false);
  const [showPastWeeks, setShowPastWeeks] = useState(false);

  const friends = user ? getFriends() : [];
  const sortedGames = useMemo(() => sortActiveGames(games), [games]);

  const openPlay = useCallback((friend: FriendProfile | null, kind: FriendlyKind = 'rps') => {
    setSheet({ type: 'play', friend, kind });
  }, []);

  const jumpToAdd = useCallback(() => {
    addRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => addRef.current?.focus(), 350);
  }, []);

  if (!user) return null;

  const incoming = getIncoming();
  const outgoing = getOutgoing();
  const pending = !settled && !friendsLoaded();
  const meDigest = getMeDigest();
  const myId = profile?.id ?? user.id;
  const myName = profile?.username ?? 'You';

  // ── Banner ────────────────────────────────────────────────────────────────
  const online = onNow(friends, now);
  const { rows: todayRows, input: bannerInput } = bannerModel(
    friends,
    { id: myId, username: myName, todayPoints: meDigest?.todayPoints ?? 0, playedToday: meDigest?.playedToday ?? 0 },
    online.map((f) => f.username),
  );

  // ── Weekly race (§212/§216/§232/§238) ─────────────────────────────────────
  const standings = (() => {
    if (friends.length === 0) return [];
    const entries = friends.map((f) => ({
      id: f.id, username: f.username, avatar_url: f.avatar_url,
      avatar_emoji: f.avatar_emoji ?? null, level: f.level,
      pts: f.weekPoints ?? 0, me: false,
    }));
    if (profile) {
      entries.push({
        id: profile.id, username: 'You', avatar_url: profile.avatar_url ?? null,
        avatar_emoji: (profile as { avatar_emoji?: string | null }).avatar_emoji ?? null,
        level: profile.level ?? 0, pts: meDigest?.weekPoints ?? 0, me: true,
      });
    }
    entries.sort((a, b) => b.pts - a.pts);
    return entries;
  })();
  const podium = standings.slice(0, 3);
  const raceStarted = standings.some((e) => e.pts > 0);
  const crownId = raceStarted ? podium[0].id : null;

  const shareRace = async () => {
    if (sharingRace) return;
    setSharingRace(true);
    try {
      await shareWeeklyRaceCard({
        friends,
        me: profile
          ? { id: profile.id, username: profile.username, weekPoints: meDigest?.weekPoints ?? 0, todayPoints: meDigest?.todayPoints }
          : null,
      });
    } finally {
      setSharingRace(false);
    }
  };

  const lastWeek = (() => {
    const entries = friends.map((f) => ({ name: f.username, pts: f.lastWeekPoints ?? 0 }));
    if (profile) entries.push({ name: 'You', pts: meDigest?.lastWeekPoints ?? 0 });
    entries.sort((a, b) => b.pts - a.pts);
    return entries[0] && entries[0].pts > 0 ? entries[0] : null;
  })();

  const pastWeeks = (() => {
    const meArr = meDigest?.pastWeekPoints ?? [];
    const len = Math.max(0, meArr.length, ...friends.map((f) => f.pastWeekPoints?.length ?? 0));
    const out: Array<{ k: number; name: string; pts: number }> = [];
    for (let k = 0; k < len; k++) {
      const entries = friends.map((f) => ({ name: f.username, pts: f.pastWeekPoints?.[k] ?? 0 }));
      if (profile) entries.push({ name: 'You', pts: meArr[k] ?? 0 });
      entries.sort((a, b) => b.pts - a.pts);
      if (entries[0] && entries[0].pts > 0) out.push({ k, name: entries[0].name, pts: entries[0].pts });
    }
    return out;
  })();

  const pastWeekLabel = (k: number): string => {
    const mon = new Date();
    mon.setHours(0, 0, 0, 0);
    mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7) - 7 * (k + 1));
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    const f = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${f(mon)}–${f(sun)}`;
  };

  const ordinal = (n: number): string => {
    const v = n % 100;
    if (v >= 11 && v <= 13) return `${n}th`;
    return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
  };

  const weekEndsLabel = (() => {
    const cur = new Date(now);
    const end = new Date(cur);
    const dow = cur.getDay();
    end.setDate(cur.getDate() + (dow === 0 ? 1 : 8 - dow));
    end.setHours(0, 0, 0, 0);
    const secs = Math.max(0, Math.floor((end.getTime() - cur.getTime()) / 1000));
    const d = Math.floor(secs / 86400);
    const clock = [Math.floor((secs % 86400) / 3600), Math.floor((secs % 3600) / 60), secs % 60]
      .map((n) => String(n).padStart(2, '0')).join(':');
    return d >= 1 ? `ends Sunday · ${d}d ${clock}` : `ends tonight · ${clock}`;
  })();

  const friendversary = (f: FriendProfile): number | null => {
    if (!f.since) return null;
    const t = Date.parse(f.since);
    if (!Number.isFinite(t)) return null;
    const days = Math.floor((Date.now() - t) / 86_400_000);
    return [7, 30, 100, 365].includes(days) ? days : null;
  };

  // §216: one tap nudges every friend who hasn't played today.
  const slackers = friends.filter((f) => f.playedToday === 0 && !isNewFriend(f));
  const nudgeAll = async () => {
    let n = 0;
    for (const f of slackers) {
      const r = await sendTaunt(f.id, 'slowpoke');
      if (r.sent) n += 1;
    }
    setNote(n > 0 ? `Nudged ${n} friend${n === 1 ? '' : 's'}!` : 'Everyone already nudged today');
  };

  const fireTaunt = async (tauntId: string) => {
    if (!tauntTarget) return;
    const r = await sendTaunt(tauntTarget.id, tauntId);
    setTauntStatus(r.sent ? 'Sent!' : r.alreadySent ? 'Already taunted them today' : 'Could not send');
    setTimeout(() => { setTauntTarget(null); setTauntStatus(null); }, 1400);
  };

  const sayHi = async (f: FriendProfile) => {
    const r = await sendTaunt(f.id, 'hi');
    setNote(r.sent ? `Hi sent to ${f.username}!` : r.alreadySent ? 'Already said hi today' : 'Could not send');
  };

  const challenge = async (f: FriendProfile) => {
    if (challenging) return;
    setChallenging(f.id);
    try {
      const r = await challengeFriend(f.id, 'DUEL');
      if ('error' in r) { setNote(r.error); return; }
      setNote(`Challenge sent to ${f.username}!`);
      router.push(`${vsHrefForMode('DUEL')}?inviteCode=${r.code}`);
    } finally {
      setChallenging(null);
    }
  };

  const shareInvite = async () => {
    let text = `Add me on Wordocious! I'm ${profile?.username ?? ''}`.trim();
    let url = `https://wordocious.com/profile/${myId}`;
    // D3: a Pro player's open referral code is the better door.
    if (isProActive) {
      try {
        const { data } = await (supabase as any)
          .from('referrals')
          .select('code, expires_at')
          .eq('inviter_id', myId)
          .eq('status', 'pending')
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(1);
        const code = data?.[0]?.code as string | undefined;
        if (code) {
          url = `https://wordocious.com/join/${code}`;
          text = `${giftShareText(url)} Add me once you're in: ${profile?.username ?? ''}`.trim();
        }
      } catch {}
    }
    // FINISH_SPEC S4: the shared invite copy for the plain invite; the gift line stays for referrals. The link stays.
    if (!url.includes('/join/')) text = inviteShareText(url);
    if (typeof navigator.share === 'function') {
      try { await navigator.share({ text, url }); } catch { /* user closed the sheet */ }
      return;
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setNote('Link copied');
    } catch {
      setNote('Could not copy link');
    }
  };

  const handleAdd = async () => {
    const name = username.trim();
    if (!name || sending) return;
    setSending(true);
    try {
      const r = await requestFriend({ username: name });
      if ('error' in r) setNote(r.error);
      else {
        // T1 / T3: the invite-sent card, or NEW FRIENDS! on a mutual request.
        const clean = name.replace(/^@+/, '');
        if (r.status === 'accepted') setNewFriend({ id: r.friendId, name: clean });
        else setSentTo(`@${clean}`);
        setUsername('');
      }
    } finally {
      setSending(false);
    }
  };

  const myTurnCount = sortedGames.filter((g) => g.yourTurn).length;
  const menuItem = (label: React.ReactNode, onClick: () => void, color: string = FR_LOOK.ink) => (
    <button
      onClick={onClick}
      className="w-full text-left px-3 py-2 text-xs font-extrabold"
      style={{ color, borderTop: `1px solid ${softMix(FR_LOOK.lavender, 0.14)}` }}
    >
      {label}
    </button>
  );
  const [addW, addH] = ART_SIZE[ADD_POSE];

  return (
    // Desktop website (≥ 1024 px, lib/desktop-layout.ts; globals.css .fr-desk):
    // three columns under the headline — the banner (kept in view), then the
    // two AG columns.
    // BJ7: 12 between sections (was 14).
    <div className="fr-desk space-y-3">
      {/* 1. FRIENDS headline (FINISH_SPEC A6 + C4b): the whole-cast title art full
          width, edge to edge, right on the wallpaper — nothing beside it. The bell
          (notification prefs) moved into Settings → Notifications; "Add a friend" is
          the candy button in the YOUR FRIENDS header. */}
      <PageHeadline name="art-title-friends" label="Friends" />

      {/* 2. Friends banner (FINISH_SPEC AG: the 560 column on desktop web) */}
      <div className="page-col">
      {pending ? (
        <div className="animate-pulse" style={{ ...frSurface(FR_LOOK.pink), height: 196 }} aria-hidden />
      ) : (
        <FriendsBanner
          input={bannerInput}
          clock={midnightClock(new Date(now))}
          online={online}
          nobodyLine={nobodyOnLine(friends, now)}
          chips={raceChips(todayRows)}
          streak={bestFriendStreak(friends)}
          onFace={(f) => openPlay(f)}
          onRace={() => setSheet({ type: 'race' })}
          onAddFriend={jumpToAdd}
        />
      )}
      </div>

      {/* FINISH_SPEC AG (desktop web ≥ 900 px; nothing changes below): two
          columns — your turn, play with friends and the race on the left; your
          friends, invites, moments and add a friend on the right. */}
      <div className="page-grid-2 space-y-3">
      <div className="space-y-3">
      {/* 4. YOUR TURN (only with active games) */}
      {sortedGames.length > 0 && (
        <>
          <SectionLabel color={FR_LOOK.playLabel}>
            Your turn
            {/* M: the same candy badge as the Friends tab, so the waiting games are easy to find. */}
            <CandyBadge count={myTurnCount} size={16} label={`${myTurnCount} waiting`} />
          </SectionLabel>
          <div className="space-y-1.5">
            {sortedGames.map((g) => {
              const accent = KIND_COLOR[g.kind];
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => router.push(`/friends/games/${g.id}`)}
                  // BJ7: one top line — icon, title and the action top-aligned; detail 4 under.
                  className="relative overflow-hidden w-full flex items-start gap-2.5 text-left"
                  style={{ ...frSurface(accent, { radius: 16 }), padding: '13px 12px 10px' }}
                >
                  <span aria-hidden="true" className="absolute top-0 left-0 right-0" style={frBar(accent, 5)} />
                  <span className="relative shrink-0">
                    <GameIconSquare kind={g.kind} size={40} />
                    {g.yourTurn && <CandyBadge count={1} size={16} style={{ position: 'absolute', top: -6, right: -6 }} />}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px] font-black truncate" style={{ color: FR_LOOK.ink }}>{g.title} vs @{g.opponent.username}</span>
                    <span className="block text-[11.5px] font-extrabold truncate mt-1" style={{ color: FR_LOOK.bannerClock }}>{g.line}</span>
                  </span>
                  {g.yourTurn ? (
                    <span className={candyClass({ color: 'pink', size: 'sm', extra: 'shrink-0' })}>
                      <CandyIcon name="play" size={14} />
                      <span className="candy-label">Play</span>
                    </span>
                  ) : (
                    <span
                      className="shrink-0 px-3 flex items-center text-[11px] font-black rounded-full"
                      style={{ height: 28, background: softMix(FR_LOOK.lavender, 0.18), color: '#5b3c96' }}
                    >
                      WAITING
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* 5. PLAY WITH FRIENDS — six small tinted cards, each with its own top bar (C4). */}
      <SectionLabel
        color={FR_LOOK.playLabel}
        right={<span className="text-[10px] font-black" style={{ color: FR_LOOK.playLabel, letterSpacing: 0.8 }}>TAP A GAME, PICK A FRIEND</span>}
      >
        Play with friends
      </SectionLabel>
      <div className="grid grid-cols-3 gap-2">
        {FRIENDLY_KINDS.map((k) => (
          <PocketGameCard
            key={k}
            kind={k}
            title={FRIENDLY_TITLES[k]}
            sub={KIND_SUB[k]}
            onClick={() => {
              if (friends.length === 0) { setNote('Add a friend first, then pick a game'); jumpToAdd(); return; }
              openPlay(friends.length === 1 ? friends[0] : null, k);
            }}
          />
        ))}
      </div>

      {/* 6. THIS WEEK'S RACE (§212) — the podium on a warm gold card (C4). */}
      {podium.length > 0 && (
        <FrCard accent={FR_LOOK.gold} bar={FR_LOOK.goldBar}>
          <div className="flex flex-col gap-1.5" style={{ padding: '10px 12px' }}>
            <div className="flex items-center justify-between gap-2">
              <h2 className="m-0 text-[11px] font-black uppercase" style={{ letterSpacing: 1.3, color: FR_LOOK.goldInk }}>This week&apos;s race</h2>
              <span className="flex items-center gap-1 text-[10px] font-black uppercase" style={{ color: FR_LOOK.goldInk, letterSpacing: 0.6 }}>
                <span>{weekEndsLabel}</span>
                {raceStarted && (
                  <button
                    onClick={shareRace}
                    disabled={sharingRace}
                    aria-label="Share weekly race"
                    className="hdr-glyph flex items-center justify-center -my-2"
                    style={{ minWidth: 34, minHeight: 34, opacity: sharingRace ? 0.4 : 1 }}
                  >
                    <Icon3D name="share" size={20} />
                  </button>
                )}
              </span>
            </div>
            {(() => {
              const r = getLastWeekResult();
              if (!r) return null;
              const win = r.rank === 1;
              const tone = win ? FR_LOOK.gold : FR_LOOK.lavender;
              return (
                <div
                  className="flex items-center gap-2 px-3 py-2"
                  style={{ background: softMix(tone, win ? 0.24 : 0.1), border: `1.5px solid ${softMix(tone, 0.34)}`, borderRadius: 12 }}
                >
                  {win ? <Icon3D name="crown" size={20} /> : <UiIcon name={r.rank === 2 ? 'medal-silver' : r.rank === 3 ? 'medal-bronze' : 'medal'} size={20} />}
                  <span className="text-[11px] font-extrabold flex-1 min-w-0" style={{ color: win ? '#92400e' : FR_LOOK.ink }}>
                    Last week you finished <b>{ordinalOf(r.rank)} of {r.circleSize}</b> · {r.points.toLocaleString()} pts
                    {!win && r.winnerName ? <span style={{ color: FR_LOOK.sub }}> · <Icon3D name="crown" size={13} inline /> {r.winnerName} {r.winnerPoints.toLocaleString()}</span> : null}
                  </span>
                </div>
              );
            })()}
            {lastWeek && (
              <button
                type="button"
                onClick={() => pastWeeks.length > 1 && setShowPastWeeks((v) => !v)}
                aria-expanded={pastWeeks.length > 1 ? showPastWeeks : undefined}
                className="flex items-center gap-1 text-[10.5px] font-extrabold text-left"
                style={{ color: FR_LOOK.goldInk, cursor: pastWeeks.length > 1 ? 'pointer' : 'default' }}
              >
                <span>Last week: <Icon3D name="crown" size={13} inline /> {lastWeek.name} · {lastWeek.pts.toLocaleString()} pts</span>
                {pastWeeks.length > 1 && (
                  <ChevronDown className="w-3 h-3 transition-transform" style={{ transform: showPastWeeks ? 'rotate(180deg)' : 'none' }} />
                )}
              </button>
            )}
            {showPastWeeks && pastWeeks.filter((w) => w.k > 0).map((w) => (
              <div key={w.k} className="text-[10px] font-bold pl-1" style={{ color: FR_LOOK.goldInk }}>
                {pastWeekLabel(w.k)}: <Icon3D name="crown" size={13} inline /> {w.name} · {w.pts.toLocaleString()} pts
              </div>
            ))}
            {/* The podium (the Leaderboard's): gold / silver / bronze steps, letter-tile
                avatars, the crown on first place once the race has points. */}
            <div className="grid grid-cols-3 items-end gap-2" style={{ padding: '8px 8px 0' }}>
              {podiumSlots(podium.length).map((slot) => {
                const e = podium[slot.index];
                return (
                  <Link
                    key={e.id}
                    href={e.me ? '/profile' : `/profile/${e.id}`}
                    className="grid justify-items-center min-w-0"
                    style={{ gridColumn: slot.column, gridRow: 1, gap: 3 }}
                  >
                    {slot.place === 1 && raceStarted && (
                      <Icon3D name="crown" size={24} className="relative" style={{ marginBottom: -6, zIndex: 2 }} label="Leads the week" />
                    )}
                    <FriendAvatar
                      // Your own entry is labeled "You" but its tile shows your real initials + accent (§20).
                      name={e.me && profile ? profile.username : e.username}
                      url={e.avatar_url}
                      emoji={e.avatar_emoji}
                      accent={e.me ? (profile as { accent_color?: string | null } | null)?.accent_color ?? null : null}
                      size={slot.avatar}
                    />
                    <span className="text-[12px] font-black truncate max-w-full" style={{ color: FR_LOOK.ink }}>{e.username}</span>
                    <SoftNum size={12}>{e.pts.toLocaleString()}</SoftNum>
                    <span
                      className="w-full flex items-center justify-center font-black text-white"
                      style={{
                        height: slot.step, borderRadius: '12px 12px 0 0', fontSize: 20,
                        background: `linear-gradient(${slot.from}, ${slot.to})`,
                        textShadow: '0 1px 2px rgba(59,26,120,0.35)',
                      }}
                      aria-label={`${ordinal(slot.place)} place`}
                    >
                      {slot.place}
                    </span>
                  </Link>
                );
              })}
            </div>
            {standings.length > 3 && (
              <div className="overflow-hidden" style={{ borderRadius: 12, border: `1.5px solid ${softMix(FR_LOOK.gold, 0.3)}` }}>
                {standings.slice(3).map((e, i) => (
                  <Link
                    key={e.id}
                    href={e.me ? '/profile' : `/profile/${e.id}`}
                    className="flex items-center gap-2 px-3 py-1.5"
                    style={{ background: rowStripe(i + 1), borderTop: i === 0 ? undefined : `1px solid ${softMix(FR_LOOK.gold, 0.2)}` }}
                  >
                    <SoftNum size={12} className="w-8 shrink-0 text-right">{ordinal(i + 4)}</SoftNum>
                    <span className="text-[11.5px] font-extrabold truncate flex-1 min-w-0" style={{ color: e.me ? FR.ink : FR_LOOK.ink }}>{e.username}</span>
                    <SoftNum size={12} className="shrink-0">{e.pts.toLocaleString()}</SoftNum>
                  </Link>
                ))}
              </div>
            )}
            {!raceStarted && (
              <p className="text-center text-[10.5px] font-bold" style={{ color: FR_LOOK.goldInk }}>Race resets Mondays — first daily takes the lead.</p>
            )}
          </div>
        </FrCard>
      )}
      </div>

      <div className="space-y-3">
      {/* 7. YOUR FRIENDS — a lavender card with soft striped rows and chunky candy
          Play / Challenge / Nudge buttons (C4); "Add a friend" lives in its header (C4b). */}
      <FrCard accent={FR_LOOK.lavender} bar={FR_LOOK.lavenderBar}>
        <div className="flex items-center justify-between gap-2" style={{ padding: '8px 10px 6px 12px' }}>
          <h2 className="m-0 min-w-0 text-[11px] font-black uppercase truncate" style={{ letterSpacing: 1.3, color: '#5b3c96' }}>
            Your friends{friends.length > 0 ? ` · ${friends.length}` : ''}
          </h2>
          <CandyButton size="sm" color="pink" icon="plus" onClick={jumpToAdd} className="shrink-0">Add a friend</CandyButton>
        </div>
        {pending ? (
          <div className="animate-pulse" aria-hidden>
            {[0, 1, 2].map((i) => (
              <div key={i} className="px-3 py-2.5" style={{ background: rowStripe(i), borderTop: `1px solid ${softMix(FR_LOOK.lavender, 0.1)}` }}>
                <div className="h-8 rounded-xl" style={{ background: softMix(FR_LOOK.lavender, 0.16) }} />
              </div>
            ))}
          </div>
        ) : friends.length > 0 ? (
          <div>
            {friends.map((f, i) => {
              const line = friendLine(f, now, SWEEP_MODES.length);
              const action = friendAction(f, now);
              return (
                <div
                  key={f.id}
                  // BJ7: one top line — avatar, name + chips and the streak / actions
                  // top-aligned; the presence line 4 under the name.
                  className="relative flex items-start gap-2.5 px-3 py-[7px] cursor-pointer"
                  style={{ background: rowStripe(i + 1), borderTop: `1px solid ${softMix(FR_LOOK.lavender, 0.1)}` }}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('a,button')) return;
                    router.push(`/profile/${f.id}`);
                  }}
                >
                  <Link href={`/profile/${f.id}`} className="flex items-start gap-2.5 flex-1 min-w-0">
                    <FriendAvatar name={f.username} url={f.avatar_url} emoji={f.avatar_emoji} size={36} online={line.online} />
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-1 text-[14px] font-black truncate" style={{ color: FR_LOOK.ink }}>
                        <span className="truncate">@{f.username}</span>
                        {f.level ? <LevelBadge level={f.level} size={16} numberSize={11} numberClassName="" /> : null}
                        {f.id === crownId && <Icon3D name="crown" size={14} label="Leads the week" className="shrink-0" />}
                        {isNewFriend(f) && (
                          <span className="text-[8.5px] font-black px-1 py-0.5 rounded shrink-0" style={{ background: FR.soft, color: FR.solid }}>NEW</span>
                        )}
                        {friendversary(f) !== null && (
                          <span className="text-[8.5px] font-black px-1 py-0.5 rounded shrink-0" style={{ background: FR.soft, color: FR.solid }}>{friendversary(f)} DAYS</span>
                        )}
                      </span>
                      <span className="block text-[11px] font-bold truncate mt-1" style={{ color: line.online ? '#047857' : FR_LOOK.rowSub }}>{line.text}</span>
                    </span>
                  </Link>
                  <FlameCount days={f.friendStreak ?? 0} />
                  {action === 'play' && <Pill color="purple" icon="play" onClick={() => openPlay(f)} label={`Play with ${f.username}`}>Play</Pill>}
                  {action === 'challenge' && (
                    <Pill color="pink" onClick={() => challenge(f)} disabled={challenging !== null} label={`Challenge ${f.username} to a VS Battle`}>
                      {challenging === f.id ? 'Sending…' : 'Challenge'}
                    </Pill>
                  )}
                  {action === 'nudge' && <Pill color="amber" onClick={() => setTauntTarget(f)} label={`Nudge ${f.username}`}>Nudge</Pill>}
                  <span className="relative shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); setMenuFor((m) => (m === f.id ? null : f.id)); }}
                      aria-label={`More options for ${f.username}`}
                      aria-expanded={menuFor === f.id}
                      className={candyClass({ color: 'peach', size: 'sm' })}
                      style={{ width: 32, padding: 0 }}
                    >
                      <MoreHorizontal className="w-4 h-4" aria-hidden="true" />
                    </button>
                    {menuFor === f.id && (
                      <div
                        className="absolute right-0 top-10 z-40 w-44 overflow-hidden"
                        style={{ ...frSurface(FR_LOOK.lavender, { share: 0.08, radius: 14 }), boxShadow: '0 10px 26px rgba(60,30,110,0.2)' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => { setMenuFor(null); router.push(`/profile/${f.id}`); }}
                          className="w-full text-left px-3 py-2 text-xs font-extrabold"
                          style={{ color: FR_LOOK.ink }}
                        >
                          View profile
                        </button>
                        {menuItem('Play a quick game', () => { setMenuFor(null); openPlay(f); }, FR.solid)}
                        {menuItem(<span className="inline-flex items-center gap-1"><UiIcon name="swords" size={14} /> Challenge</span>, () => { setMenuFor(null); void challenge(f); }, FR.solid)}
                        {menuItem('Taunt', () => { setMenuFor(null); setTauntTarget(f); })}
                        {isNewFriend(f) && menuItem('Say hi', () => { setMenuFor(null); void sayHi(f); })}
                        {((profile as { streak_shields?: number } | null)?.streak_shields ?? 0) > 0 && menuItem(<span className="inline-flex items-center gap-1"><Icon3D name="shield" size={14} /> Gift a shield</span>, async () => {
                          setMenuFor(null);
                          const r = await giftShield(f.id);
                          if ('error' in r) setNote(r.error);
                          else setShieldNote(`Shield sent to ${f.username} · ${r.shieldsLeft} left`);
                        }, '#0d9488')}
                        {menuItem('Unfriend', () => { setMenuFor(null); setUnfriendTarget(f); }, '#dc2626')}
                      </div>
                    )}
                  </span>
                </div>
              );
            })}
            {/* §216: one tap nudges every friend who hasn't played today. */}
            {slackers.length > 0 && (
              <div className="flex items-center justify-between gap-2 px-3 pt-2.5 pb-2" style={{ borderTop: `1px solid ${softMix(FR_LOOK.lavender, 0.1)}` }}>
                <span className="text-[11px] font-extrabold" style={{ color: FR_LOOK.rowSub }}>
                  <SoftNum size={12}>{slackers.length}</SoftNum> {slackers.length === 1 ? 'friend hasn’t' : 'friends haven’t'} played today
                </span>
                <CandyButton
                  size="sm"
                  color="amber"
                  icon={<Icon3D name="bell" size={16} />}
                  onClick={nudgeAll}
                  aria-label="Nudge all friends who haven't played today"
                  className="shrink-0"
                >
                  Nudge all
                </CandyButton>
              </div>
            )}
          </div>
        ) : (
          <div className="px-4 pb-4 pt-1 space-y-1.5 text-xs font-bold" style={{ color: FR_LOOK.rowSub }}>
            <p>1. Add friends by username with <span style={{ color: FR.solid }}>Add a friend</span>, or from the <span style={{ color: FR.solid }}>Add Friend</span> button on any player&apos;s profile.</p>
            <p>2. Requests you send and receive land right here.</p>
            <p>3. Once a friend accepts, race them every day and play quick games together.</p>
          </div>
        )}
      </FrCard>
      {note && <div className="flex justify-center px-1" role="status" aria-live="polite"><FeedbackPill key={note} message={note} /></div>}
      {shieldNote && <ShieldNotice onDismiss={() => setShieldNote(null)}>{shieldNote}</ShieldNotice>}

      {/* 7b. INVITES (only with requests in flight; founder 2026-10-01: under YOUR FRIENDS) */}
      {(incoming.length > 0 || outgoing.length > 0) && (
        <FrCard accent={FR_LOOK.pink} bar={FR_LOOK.pink}>
          <div className="flex items-center gap-1.5" style={{ padding: '10px 14px 8px' }}>
            <h2 className="m-0 text-[11px] font-black uppercase" style={{ letterSpacing: 1.3, color: FR_LOOK.bannerClock }}>Invites</h2>
            {/* M: requests waiting on you wear the Friends tab's candy badge. */}
            <CandyBadge count={incoming.length} size={16} label={`${incoming.length} waiting`} />
          </div>
          {incoming.map((r, i) => (
            <div key={r.id} className="flex items-center gap-2.5 px-3 py-2.5" style={{ background: rowStripe(i + 1), borderTop: `1px solid ${softMix(FR_LOOK.pink, 0.12)}` }}>
              <span className="relative shrink-0 inline-flex">
                <FriendAvatar name={r.username} url={r.avatar_url} emoji={r.avatar_emoji} size={34} />
                <CandyBadge count={1} size={14} style={{ position: 'absolute', top: -5, right: -5 }} />
              </span>
              <Link href={`/profile/${r.id}`} className="flex-1 min-w-0">
                <span className="block text-[13px] font-black truncate" style={{ color: FR_LOOK.ink }}>@{r.username}</span>
                <span className="block text-[11px] font-bold" style={{ color: FR_LOOK.rowSub }}>Wants to be friends</span>
              </Link>
              {/* T2: Accept = green candy; T3: NEW FRIENDS! once accepted. */}
              <CandyButton
                size="sm"
                icon="check"
                onClick={() => { void acceptFriend(r.id); setNewFriend({ id: r.id, name: r.username, url: r.avatar_url, emoji: r.avatar_emoji }); }}
                aria-label={`Accept ${r.username}`}
                style={{ width: 32, padding: 0, ...GREEN_CANDY }}
              />
              <CandyButton size="sm" color="peach" icon={<X className="w-4 h-4" aria-hidden="true" />} onClick={() => declineFriend(r.id)} aria-label={`Decline ${r.username}`} style={{ width: 32, padding: 0 }} />
            </div>
          ))}
          {outgoing.map((r, i) => (
            <div key={r.id} className="flex items-center gap-2.5 px-3 py-2.5" style={{ background: rowStripe(incoming.length + i + 1), borderTop: `1px solid ${softMix(FR_LOOK.pink, 0.12)}` }}>
              <FriendAvatar name={r.username} url={r.avatar_url} emoji={r.avatar_emoji} size={34} />
              <Link href={`/profile/${r.id}`} className="flex-1 min-w-0">
                <span className="block text-[13px] font-black truncate" style={{ color: FR_LOOK.ink }}>@{r.username}</span>
                <span className="flex items-center gap-1.5 text-[11px] font-bold" style={{ color: FR_LOOK.rowSub }}>
                  {/* T1: request-pending rows wear the small glossy Pending pill. */}
                  <PendingPill />
                  {agoShort(r.requestedAt) && <span>waiting {agoShort(r.requestedAt)}</span>}
                </span>
              </Link>
              <Pill
                color="amber"
                disabled={withinDay(r.remindedAt)}
                label={`Remind ${r.username}`}
                onClick={async () => {
                  const res = await remindFriend(r.id);
                  setInviteNote('error' in res && res.error ? res.error : `Reminder sent to ${r.username}!`);
                }}
              >
                {withinDay(r.remindedAt) ? 'Reminded' : 'Remind'}
              </Pill>
              <CandyButton size="sm" color="peach" icon={<X className="w-4 h-4" aria-hidden="true" />} onClick={() => declineFriend(r.id)} aria-label={`Cancel request to ${r.username}`} style={{ width: 32, padding: 0 }} />
            </div>
          ))}
          {inviteNote && (
            <div className="flex justify-center cursor-pointer px-3 pb-2.5" onClick={() => setInviteNote(null)} role="status" aria-live="polite"><FeedbackPill key={inviteNote} message={inviteNote} /></div>
          )}
        </FrCard>
      )}

      {/* 8. MOMENTS */}
      <ActivityFeed
        onRematch={(kind, friendId) => {
          const f = friends.find((x) => x.id === friendId) ?? null;
          if (f) openPlay(f, kind);
        }}
      />

      {/* T1: a request just sent — the invite-sent card (Send another / Done). */}
      {sentTo && (
        <InviteSentCard
          name={sentTo}
          note="They'll see your request in their Friends tab."
          onSendAnother={() => { setSentTo(null); jumpToAdd(); }}
          onDone={() => setSentTo(null)}
        />
      )}

      {/* 9. ADD A FRIEND (the add-friend window, G5): by username + the share link,
          with I reaching out (a pose, not the Friends host — A7). */}
      <FrCard accent={FR_LOOK.pink} bar={FR_LOOK.bannerBar}>
        <div className="flex flex-col gap-2.5" style={{ padding: '10px 14px 12px' }}>
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <h2 className="m-0 flex items-center gap-1.5 text-[11px] font-black uppercase" style={{ letterSpacing: 1.3, color: FR_LOOK.bannerClock }}>
                <Users className="w-3.5 h-3.5" aria-hidden="true" /> Add a friend
              </h2>
              <p className="m-0 mt-1 text-[12px] font-bold" style={{ color: FR_LOOK.bannerSub }}>
                Find them by username, or send your link.
              </p>
            </div>
            <Image
              src={artSrc(ADD_POSE)}
              alt=""
              aria-hidden
              width={addW}
              height={addH}
              loading="lazy"
              draggable={false}
              className="shrink-0 pointer-events-none select-none"
              style={{ width: 64, height: 64, objectFit: 'contain', marginTop: -6, marginBottom: -8 }}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={addRef}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="Add by username"
              aria-label="Add by username"
              className="flex-1 min-w-0 px-3 text-[13px] font-bold outline-none"
              style={{ height: 36, background: softMix(FR_LOOK.pink, 0.05), border: `1.5px solid ${softMix(FR_LOOK.pink, 0.32)}`, borderRadius: 12, color: FR_LOOK.ink }}
            />
            <CandyButton
              size="sm"
              color="pink"
              icon={<Icon3D name="add-friend" size={16} />}
              onClick={handleAdd}
              disabled={sending || !username.trim()}
              aria-label="Send friend request"
              className="shrink-0"
            >
              Add
            </CandyButton>
          </div>
          {suggestions.length > 0 && (
            <div className="space-y-1">
              {suggestions.map((u) => (
                <button
                  key={u.id}
                  onClick={async () => {
                    if (sending) return;
                    setSending(true);
                    setSuggestions([]);
                    try {
                      const r = await requestFriend({ addresseeId: u.id });
                      if ('error' in r) setNote(r.error);
                      else {
                        if (r.status === 'accepted') setNewFriend({ id: u.id, name: u.username, url: u.avatar_url, emoji: u.avatar_emoji });
                        else setSentTo(`@${u.username}`);
                        setUsername('');
                      }
                    } finally {
                      setSending(false);
                    }
                  }}
                  className="w-full flex items-center gap-2.5 px-2 py-1.5 text-left"
                  style={{ background: softMix(FR_LOOK.lavender, 0.1), border: `1.5px solid ${softMix(FR_LOOK.lavender, 0.26)}`, borderRadius: 12 }}
                >
                  <FriendAvatar name={u.username} url={u.avatar_url} emoji={u.avatar_emoji} size={30} />
                  <span className="flex-1 min-w-0 text-xs font-extrabold truncate" style={{ color: FR_LOOK.ink }}>{u.username}</span>
                  <LevelBadge level={u.level} size={18} numberSize={11} numberClassName="" />
                  <Icon3D name="add-friend" size={17} />
                </button>
              ))}
            </div>
          )}
          <div>
            <CandyButton size="sm" color="purple" icon="share" onClick={shareInvite}>Share invite link</CandyButton>
          </div>
        </div>
      </FrCard>
      </div>
      </div>

      {/* Sheets + modals */}
      {sheet?.type === 'play' && (
        <QuickPlaySheet
          friends={friends}
          friend={sheet.friend}
          kind={sheet.kind}
          onClose={() => setSheet(null)}
          onNote={setNote}
        />
      )}
      {sheet?.type === 'race' && (
        <Sheet onClose={() => setSheet(null)} label="Today's race">
          <TodaysRace
            friends={friends}
            me={profile ? {
              id: profile.id, username: profile.username, avatar_url: profile.avatar_url ?? null,
              avatar_emoji: (profile as { avatar_emoji?: string | null }).avatar_emoji ?? null,
              level: profile.level ?? 0, todayPoints: meDigest?.todayPoints ?? 0, playedToday: meDigest?.playedToday ?? 0,
            } : null}
            onTaunt={(f) => setTauntTarget(f)}
            onNote={setNote}
          />
        </Sheet>
      )}

      {tauntTarget && (
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4"
          style={{ background: 'rgba(42,22,80,0.45)' }}
          onClick={() => { setTauntTarget(null); setTauntStatus(null); }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Nudge ${tauntTarget.username}`}
            className="w-full max-w-sm overflow-hidden"
            style={frSurface(FR_LOOK.pink, { share: 0.08 })}
            onClick={(e) => e.stopPropagation()}
          >
            <div aria-hidden="true" style={frBar(FR_LOOK.bannerBar)} />
            <div className="px-4 py-3">
              <p className="text-[11px] font-black uppercase" style={{ color: FR_LOOK.bannerClock, letterSpacing: 1.2 }}>Nudge {tauntTarget.username}</p>
            </div>
            {tauntStatus ? (
              <div className="p-6 text-center text-sm font-extrabold" style={{ color: FR_LOOK.ink }} role="status">{tauntStatus}</div>
            ) : (
              <div>
                {FRIEND_TAUNTS.map((t, i) => (
                  <button
                    key={t.id}
                    onClick={() => fireTaunt(t.id)}
                    className="w-full text-left px-4 py-3 text-xs font-extrabold"
                    style={{ color: FR_LOOK.ink, background: rowStripe(i + 1), borderTop: `1px solid ${softMix(FR_LOOK.pink, 0.14)}` }}
                  >
                    {t.text}
                  </button>
                ))}
                <div className="px-4 pt-3 pb-4" style={{ borderTop: `1px solid ${softMix(FR_LOOK.pink, 0.14)}` }}>
                  <CandyButton size="md" color="peach" block onClick={() => setTauntTarget(null)}>Cancel</CandyButton>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {newFriend && (
        <NewFriendsModal
          me={{
            name: profile?.username ?? 'You',
            url: profile?.avatar_url ?? null,
            emoji: (profile as { avatar_emoji?: string | null } | null)?.avatar_emoji ?? null,
            accent: (profile as { accent_color?: string | null } | null)?.accent_color ?? null,
          }}
          friend={newFriend}
          onChallenge={() => { const id = newFriend.id; setNewFriend(null); router.push(isProActive ? `/vs/friend?friend=${id}` : '/pro'); }}
          onSeeFriends={() => setNewFriend(null)}
          onClose={() => setNewFriend(null)}
        />
      )}

      {unfriendTarget && (
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4"
          style={{ background: 'rgba(42,22,80,0.45)' }}
          onClick={() => setUnfriendTarget(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Unfriend ${unfriendTarget.username}`}
            className="w-full max-w-sm overflow-hidden"
            style={frSurface(FR_LOOK.lavender, { share: 0.08 })}
            onClick={(e) => e.stopPropagation()}
          >
            <div aria-hidden="true" style={frBar(FR_LOOK.lavenderBar)} />
            <p className="px-4 pt-4 pb-3 text-sm font-extrabold" style={{ color: FR_LOOK.ink }}>
              Unfriend {unfriendTarget.username}? You can re-add them anytime.
            </p>
            <div className="flex gap-2.5 px-4 pb-4">
              <CandyButton size="md" color="peach" block onClick={() => setUnfriendTarget(null)}>Cancel</CandyButton>
              <CandyButton
                size="md"
                block
                style={DANGER}
                onClick={async () => {
                  const f = unfriendTarget;
                  setUnfriendTarget(null);
                  await removeFriend(f.id);
                }}
              >
                Unfriend
              </CandyButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Compact "Friends (N) →" row for the profile page (Tier 3, Aug 11) — the
 * full tab lives at /friends; this is the door, with the request badge.
 */
export function FriendsRowLink() {
  const { user } = useAuth();
  const [, force] = useState(0);
  useEffect(() => {
    if (!user) return;
    loadFriends().then(() => force((v) => v + 1));
    return onFriendsChange(() => force((v) => v + 1));
  }, [user]);
  if (!user) return null;
  const count = getFriends().length;
  const pendingCount = getIncoming().length;
  return (
    <Link href="/friends" className="flex items-center gap-2.5 p-4 hover:opacity-90 transition-opacity" style={cardStyle}>
      <Users className="w-5 h-5" style={{ color: FR.solid }} />
      <span className="text-base font-black tracking-tight text-transparent bg-clip-text" style={{ backgroundImage: FR.title }}>FRIENDS</span>
      {count > 0 && <span className="text-xs font-black" style={{ color: FR.label }}>{count}</span>}
      {pendingCount > 0 && (
        <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full" style={{ background: FR.solid, color: '#fff' }} aria-label={`${pendingCount} pending friend requests`}>
          {pendingCount}
        </span>
      )}
    </Link>
  );
}
