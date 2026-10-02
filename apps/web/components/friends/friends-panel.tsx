'use client';

// THE FRIENDS TAB (Friends overhaul, founder-approved 2026-10-01; spec
// docs/FRIENDS_REDESIGN_SPEC.md §2). Top to bottom (under the shared AppHeader):
// the controls row (bell = notification prefs, add-friend jumps to Add by
// username), the Friends banner (ON NOW + TODAY'S RACE, the full race in a
// sheet), YOUR TURN, PLAY WITH
// FRIENDS, THIS WEEK'S RACE, YOUR FRIENDS (presence, friend streak, one action
// pill), INVITES, MOMENTS with reactions, and Add by username + share link. The
// page adds the InvitePanel under it. Earlier history: §207 (friends card),
// §212/§216/§225/§232/§238 (rows, weekly race), D3 (Today's Race, feed).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Users, Check, X, Send, ChevronDown, MoreHorizontal } from 'lucide-react';
import { HeaderCircle } from '@/components/ui/page-header';
import { ArtTitle } from '@/components/ui/art-title';
import { Icon3D } from '@/components/ui/icon3d';
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
import { NotificationPrefs } from './notification-prefs';
import { ActivityFeed } from './activity-feed';
import { FriendsBanner } from './friends-banner';
import { QuickPlaySheet } from './quick-play-sheet';
import { FlameCount, FriendAvatar, GameGlyph, GameIconSquare, Pill, SectionLabel, Sheet, cardStyle } from './friends-ui';
import { GameTile } from '@/components/ui/game-tile';

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
  const [, force] = useState(0);
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
    setNote(n > 0 ? `Nudged ${n} friend${n === 1 ? '' : 's'} 🔔` : 'Everyone already nudged today');
  };

  const fireTaunt = async (tauntId: string) => {
    if (!tauntTarget) return;
    const r = await sendTaunt(tauntTarget.id, tauntId);
    setTauntStatus(r.sent ? 'Sent 😈' : r.alreadySent ? 'Already taunted them today' : 'Could not send');
    setTimeout(() => { setTauntTarget(null); setTauntStatus(null); }, 1400);
  };

  const sayHi = async (f: FriendProfile) => {
    const r = await sendTaunt(f.id, 'hi');
    setNote(r.sent ? `👋 sent to ${f.username}!` : r.alreadySent ? 'Already said hi today' : 'Could not send');
  };

  const challenge = async (f: FriendProfile) => {
    if (challenging) return;
    setChallenging(f.id);
    try {
      const r = await challengeFriend(f.id, 'DUEL');
      if ('error' in r) { setNote(r.error); return; }
      setNote(`Challenge sent to ${f.username} ⚔️`);
      router.push(`${vsHrefForMode('DUEL')}?inviteCode=${r.code}`);
    } finally {
      setChallenging(null);
    }
  };

  const shareInvite = async () => {
    let text = `Add me on Wordocious — I'm ${profile?.username ?? ''}`.trim();
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
          text = `I'm gifting you 7 days of Wordocious Pro — add me once you're in: ${profile?.username ?? ''}`.trim();
        }
      } catch {}
    }
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
        setNote(r.status === 'accepted' ? 'You’re now friends! 🎉' : 'Request sent 🤝');
        setUsername('');
      }
    } finally {
      setSending(false);
    }
  };

  const myTurnCount = sortedGames.filter((g) => g.yourTurn).length;
  const menuItem = (label: React.ReactNode, onClick: () => void, color: string = FR.text) => (
    <button
      onClick={onClick}
      className="w-full text-left px-3 py-2 text-xs font-extrabold hover:opacity-80"
      style={{ color, borderTop: '1px solid #f1f5f9' }}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-3.5">
      {/* 1. Title + controls row (founder, 2026-10-02): the shared AppHeader above the
          page is the Friends header. The whole-cast FRIENDS title art (docs/ART_SPEC.md
          §2) fills the leading space; the bell and add-friend circles sit beside it. */}
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <ArtTitle name="art-title-friends" label="Friends" align="left" maxWidth={300} />
        </div>
        <NotificationPrefs />
        <HeaderCircle label="Add a friend" onClick={jumpToAdd}>
          <Icon3D name="add-friend" size={22} />
        </HeaderCircle>
      </div>

      {/* 2. Friends banner */}
      {pending ? (
        <div className="animate-pulse" style={{ height: 196, marginTop: 16, borderRadius: 16, background: 'linear-gradient(180deg, #fce7f3, #ede9fe)' }} aria-hidden />
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

      {/* 4. YOUR TURN (only with active games) */}
      {sortedGames.length > 0 && (
        <>
          <SectionLabel>
            Your turn
            {myTurnCount > 0 && (
              <span className="px-1.5 rounded-full text-[10px] font-black text-white" style={{ background: FR.solid, letterSpacing: 0 }}>{myTurnCount}</span>
            )}
          </SectionLabel>
          <div className="space-y-2">
            {sortedGames.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => router.push(`/friends/games/${g.id}`)}
                className="w-full flex items-center gap-3 p-3 text-left transition-transform active:scale-[0.99]"
                style={cardStyle}
              >
                <GameIconSquare kind={g.kind} size={36} />
                <span className="flex-1 min-w-0">
                  <span className="block text-[13px] font-black truncate" style={{ color: FR.text }}>{g.title} vs @{g.opponent.username}</span>
                  <span className="block text-[11.5px] font-extrabold truncate" style={{ color: FR.solid }}>{g.line}</span>
                </span>
                <span
                  className="shrink-0 px-3 flex items-center text-[11px] font-black rounded-full"
                  style={{ height: 28, background: g.yourTurn ? FR.solid : FR.soft, color: g.yourTurn ? '#ffffff' : FR.mid }}
                >
                  {g.yourTurn ? 'PLAY' : 'WAITING'}
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* 5. PLAY WITH FRIENDS */}
      <SectionLabel right={<span className="text-[10px] font-black" style={{ color: FR.label, letterSpacing: 0.8 }}>TAP A GAME, PICK A FRIEND</span>}>
        Play with friends
      </SectionLabel>
      <div className="grid grid-cols-3 gap-2">
        {FRIENDLY_KINDS.map((k) => (
          // One game-tile style (docs/GAME_TILE_STYLE.md): the home card's tint, border and top bar.
          <GameTile
            key={k}
            accent={KIND_COLOR[k]}
            tone="light"
            glyph={<GameGlyph kind={k} size={16} color={KIND_COLOR[k]} stroke={2.2} />}
            title={FRIENDLY_TITLES[k]}
            sub={KIND_SUB[k]}
            onClick={() => {
              if (friends.length === 0) { setNote('Add a friend first, then pick a game'); jumpToAdd(); return; }
              openPlay(friends.length === 1 ? friends[0] : null, k);
            }}
          />
        ))}
      </div>

      {/* 6. THIS WEEK'S RACE (§212) */}
      {podium.length > 0 && (
        <>
          <SectionLabel right={
            <span className="flex items-center gap-1.5 text-[10px] font-bold" style={{ color: FR.label }}>
              <span>{weekEndsLabel}</span>
              {raceStarted && (
                <button
                  onClick={shareRace}
                  disabled={sharingRace}
                  aria-label="Share weekly race"
                  className="p-1 -my-1 active:scale-95 transition-transform"
                  style={{ color: FR.label, opacity: sharingRace ? 0.4 : 1 }}
                >
                  <Icon3D name="share" size={17} />
                </button>
              )}
            </span>
          }>This week&apos;s race</SectionLabel>
          <div className="p-3" style={cardStyle}>
            {(() => {
              const r = getLastWeekResult();
              if (!r) return null;
              const win = r.rank === 1;
              return (
                <div
                  className="flex items-center gap-2 px-3 py-2 mb-1"
                  style={{ background: win ? 'linear-gradient(135deg, #fef3c7, #fde68a)' : '#f8f7ff', borderRadius: 12 }}
                >
                  {win ? <Icon3D name="crown" size={20} /> : <span className="text-base">🏁</span>}
                  <span className="text-[11px] font-extrabold flex-1 min-w-0" style={{ color: win ? '#92400e' : FR.text }}>
                    Last week you finished <b>{ordinalOf(r.rank)} of {r.circleSize}</b> · {r.points.toLocaleString()} pts
                    {!win && r.winnerName ? <span style={{ color: FR.label }}> · <Icon3D name="crown" size={13} inline /> {r.winnerName} {r.winnerPoints.toLocaleString()}</span> : null}
                  </span>
                </div>
              );
            })()}
            {lastWeek && (
              <button
                type="button"
                onClick={() => pastWeeks.length > 1 && setShowPastWeeks((v) => !v)}
                className="flex items-center gap-1 text-[10px] font-bold mt-0.5"
                style={{ color: FR.label, cursor: pastWeeks.length > 1 ? 'pointer' : 'default' }}
              >
                <span>Last week: <Icon3D name="crown" size={13} inline /> {lastWeek.name} · {lastWeek.pts.toLocaleString()} pts</span>
                {pastWeeks.length > 1 && (
                  <ChevronDown className="w-3 h-3 transition-transform" style={{ transform: showPastWeeks ? 'rotate(180deg)' : 'none' }} />
                )}
              </button>
            )}
            {showPastWeeks && pastWeeks.filter((w) => w.k > 0).map((w) => (
              <div key={w.k} className="text-[10px] font-bold mt-0.5 pl-1" style={{ color: FR.label }}>
                {pastWeekLabel(w.k)}: <Icon3D name="crown" size={13} inline /> {w.name} · {w.pts.toLocaleString()} pts
              </div>
            ))}
            <div className="flex items-end justify-center gap-5 py-2">
              {[1, 0, 2].filter((i) => i < podium.length).map((i) => {
                const e = podium[i];
                const medal = ['🥇', '🥈', '🥉'][i];
                return (
                  <Link
                    key={e.id}
                    href={e.me ? '/profile' : `/profile/${e.id}`}
                    className={`flex flex-col items-center gap-0.5 hover:opacity-80 transition-opacity ${i === 0 ? '-mt-2' : ''}`}
                  >
                    <span className={i === 0 ? 'text-lg' : 'text-sm'}>{raceStarted ? medal : '🏁'}</span>
                    <FriendAvatar
                      // Your own entry is labeled "You" but its tile shows your real initials + accent (§20).
                      name={e.me && profile ? profile.username : e.username}
                      url={e.avatar_url}
                      emoji={e.avatar_emoji}
                      accent={e.me ? (profile as { accent_color?: string | null } | null)?.accent_color ?? null : null}
                      size={i === 0 ? 40 : 34}
                    />
                    <span className="text-[9.5px] font-black truncate max-w-[80px]" style={{ color: e.me ? FR.ink : FR.text }}>{e.username}</span>
                    <span className="text-[9.5px] font-bold" style={{ color: FR.label }}>{e.pts.toLocaleString()} pts</span>
                  </Link>
                );
              })}
            </div>
            {standings.length > 3 && (
              <div className="space-y-1 mt-1">
                {standings.slice(3).map((e, i) => (
                  <Link key={e.id} href={e.me ? '/profile' : `/profile/${e.id}`} className="flex items-center gap-2 px-2 hover:opacity-80 transition-opacity">
                    <span className="text-[10px] font-black w-7 shrink-0 text-right" style={{ color: FR.label }}>{ordinal(i + 4)}</span>
                    <span className="text-[10px] font-extrabold truncate flex-1 min-w-0" style={{ color: e.me ? FR.ink : FR.text }}>{e.username}</span>
                    <span className="text-[10px] font-bold shrink-0" style={{ color: FR.label }}>{e.pts.toLocaleString()} pts</span>
                  </Link>
                ))}
              </div>
            )}
            {!raceStarted && (
              <p className="text-center text-[10px] font-bold" style={{ color: FR.label }}>Race resets Mondays — first daily takes the lead.</p>
            )}
          </div>
        </>
      )}

      {/* 7. YOUR FRIENDS */}
      <SectionLabel right={slackers.length > 0 ? (
        <button
          type="button"
          onClick={nudgeAll}
          aria-label="Nudge all friends who haven't played today"
          className="text-[11px] font-black"
          style={{ color: FR.solid }}
        >
          Nudge all who haven&apos;t played
        </button>
      ) : undefined}>
        Your friends{friends.length > 0 ? ` · ${friends.length}` : ''}
      </SectionLabel>
      {pending ? (
        <div className="space-y-2 animate-pulse" aria-hidden>
          {[0, 1, 2].map((i) => <div key={i} className="h-12 rounded-xl" style={{ background: '#ffffff' }} />)}
        </div>
      ) : friends.length > 0 ? (
        <div style={cardStyle}>
          {friends.map((f, i) => {
            const line = friendLine(f, now, SWEEP_MODES.length);
            const action = friendAction(f, now);
            return (
              <div
                key={f.id}
                className="relative flex items-center gap-2.5 px-3 py-2.5 cursor-pointer"
                style={{ borderTop: i === 0 ? undefined : '1px solid #f1f5f9' }}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest('a,button')) return;
                  router.push(`/profile/${f.id}`);
                }}
              >
                <Link href={`/profile/${f.id}`} className="flex items-center gap-2.5 flex-1 min-w-0 hover:opacity-80 transition-opacity">
                  <FriendAvatar name={f.username} url={f.avatar_url} emoji={f.avatar_emoji} size={36} online={line.online} />
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-1 text-[13px] font-black truncate" style={{ color: FR.text }}>
                      <span className="truncate">@{f.username}</span>
                      {f.id === crownId && <Icon3D name="crown" size={14} label="Leads the week" className="shrink-0" />}
                      {isNewFriend(f) && (
                        <span className="text-[8.5px] font-black px-1 py-0.5 rounded shrink-0" style={{ background: FR.soft, color: FR.solid }}>NEW</span>
                      )}
                      {friendversary(f) !== null && (
                        <span className="text-[8.5px] font-black px-1 py-0.5 rounded shrink-0" style={{ background: FR.soft, color: FR.solid }}>🎉 {friendversary(f)} DAYS</span>
                      )}
                    </span>
                    <span className="block text-[11px] font-bold truncate" style={{ color: line.online ? FR.online : FR.label }}>{line.text}</span>
                  </span>
                </Link>
                <FlameCount days={f.friendStreak ?? 0} />
                {action === 'play' && <Pill solid onClick={() => openPlay(f)} label={`Play with ${f.username}`}>Play</Pill>}
                {action === 'challenge' && (
                  <Pill onClick={() => challenge(f)} disabled={challenging !== null} label={`Challenge ${f.username} to a VS Battle`}>
                    {challenging === f.id ? 'Sending…' : 'Challenge'}
                  </Pill>
                )}
                {action === 'nudge' && <Pill onClick={() => setTauntTarget(f)} label={`Nudge ${f.username}`}>Nudge</Pill>}
                <span className="relative shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); setMenuFor((m) => (m === f.id ? null : f.id)); }}
                    aria-label={`More options for ${f.username}`}
                    className="w-6 h-7 flex items-center justify-center rounded-lg hover:opacity-80 transition-opacity"
                  >
                    <MoreHorizontal className="w-4 h-4" style={{ color: FR.label }} />
                  </button>
                  {menuFor === f.id && (
                    <div
                      className="absolute right-0 top-8 z-40 w-40 overflow-hidden"
                      style={{ background: '#ffffff', borderRadius: 12, boxShadow: '0 8px 24px rgba(15,23,42,0.16)' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => { setMenuFor(null); router.push(`/profile/${f.id}`); }}
                        className="w-full text-left px-3 py-2 text-xs font-extrabold hover:opacity-80"
                        style={{ color: FR.text }}
                      >
                        View profile
                      </button>
                      {menuItem('Play a quick game', () => { setMenuFor(null); openPlay(f); }, FR.solid)}
                      {menuItem('Challenge ⚔️', () => { setMenuFor(null); void challenge(f); }, FR.solid)}
                      {menuItem('Taunt', () => { setMenuFor(null); setTauntTarget(f); })}
                      {isNewFriend(f) && menuItem('👋 Say hi', () => { setMenuFor(null); void sayHi(f); })}
                      {((profile as { streak_shields?: number } | null)?.streak_shields ?? 0) > 0 && menuItem(<span className="inline-flex items-center gap-1"><Icon3D name="shield" size={14} /> Gift a shield</span>, async () => {
                        setMenuFor(null);
                        const r = await giftShield(f.id);
                        setNote('error' in r ? r.error : `🛡️ Shield sent to ${f.username} · ${r.shieldsLeft} left`);
                      }, '#0d9488')}
                      {menuItem('Unfriend', () => { setMenuFor(null); setUnfriendTarget(f); }, '#dc2626')}
                    </div>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        !pending && (
          <div className="p-4 space-y-1.5 text-xs font-bold" style={{ ...cardStyle, color: FR.label }}>
            <p>1. Add friends below by username, or from the <span style={{ color: FR.solid }}>Add Friend</span> button on any player&apos;s profile.</p>
            <p>2. Requests you send and receive land right here.</p>
            <p>3. Once a friend accepts, race them every day and play quick games together.</p>
          </div>
        )
      )}
      {note && <p className="text-xs font-extrabold px-1" style={{ color: FR.mid }}>{note}</p>}

      {/* 7b. INVITES (only with requests in flight; founder 2026-10-01: under YOUR FRIENDS) */}
      {(incoming.length > 0 || outgoing.length > 0) && (
        <>
          <SectionLabel>
            Invites
            <span className="px-1.5 rounded-full text-[10px] font-black text-white" style={{ background: FR.solid, letterSpacing: 0 }}>{incoming.length + outgoing.length}</span>
          </SectionLabel>
          <div style={cardStyle}>
            {incoming.map((r, i) => (
              <div key={r.id} className="flex items-center gap-2.5 px-3 py-2.5" style={{ borderTop: i === 0 ? undefined : '1px solid #f1f5f9' }}>
                <FriendAvatar name={r.username} url={r.avatar_url} emoji={r.avatar_emoji} size={34} />
                <Link href={`/profile/${r.id}`} className="flex-1 min-w-0 hover:opacity-80 transition-opacity">
                  <span className="block text-[13px] font-black truncate" style={{ color: FR.text }}>@{r.username}</span>
                  <span className="block text-[11px] font-bold" style={{ color: FR.label }}>Wants to be friends</span>
                </Link>
                <button
                  onClick={() => acceptFriend(r.id)}
                  aria-label={`Accept ${r.username}`}
                  className="w-8 h-8 rounded-full flex items-center justify-center active:scale-95 transition-transform"
                  style={{ background: FR.solid, color: '#ffffff' }}
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={() => declineFriend(r.id)}
                  aria-label={`Decline ${r.username}`}
                  className="w-8 h-8 rounded-full flex items-center justify-center active:scale-95 transition-transform"
                  style={{ background: FR.soft, color: FR.mid }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            {outgoing.map((r, i) => (
              <div key={r.id} className="flex items-center gap-2.5 px-3 py-2.5" style={{ borderTop: i === 0 && incoming.length === 0 ? undefined : '1px solid #f1f5f9' }}>
                <FriendAvatar name={r.username} url={r.avatar_url} emoji={r.avatar_emoji} size={34} />
                <Link href={`/profile/${r.id}`} className="flex-1 min-w-0 hover:opacity-80 transition-opacity">
                  <span className="block text-[13px] font-black truncate" style={{ color: FR.text }}>@{r.username}</span>
                  <span className="block text-[11px] font-bold" style={{ color: FR.label }}>Sent · waiting {agoShort(r.requestedAt)}</span>
                </Link>
                <Pill
                  disabled={withinDay(r.remindedAt)}
                  label={`Remind ${r.username}`}
                  onClick={async () => {
                    const res = await remindFriend(r.id);
                    setInviteNote('error' in res && res.error ? res.error : `Reminder sent to ${r.username} 🔔`);
                  }}
                >
                  {withinDay(r.remindedAt) ? 'Reminded' : 'Remind'}
                </Pill>
                <button
                  onClick={() => declineFriend(r.id)}
                  aria-label={`Cancel request to ${r.username}`}
                  className="w-8 h-8 rounded-full flex items-center justify-center active:scale-95 transition-transform"
                  style={{ background: '#f1f5f9', color: FR.label }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          {inviteNote && (
            <p className="text-xs font-extrabold cursor-pointer px-1" style={{ color: FR.label }} onClick={() => setInviteNote(null)}>{inviteNote}</p>
          )}
        </>
      )}

      {/* 8. MOMENTS */}
      <ActivityFeed
        onRematch={(kind, friendId) => {
          const f = friends.find((x) => x.id === friendId) ?? null;
          if (f) openPlay(f, kind);
        }}
      />

      {/* 9. Add by username + share invite link */}
      <SectionLabel><Users className="w-3.5 h-3.5" /> Add a friend</SectionLabel>
      <div className="p-3 space-y-2.5" style={cardStyle}>
        <div className="flex items-center gap-2">
          <input
            ref={addRef}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="Add by username"
            aria-label="Add by username"
            className="flex-1 min-w-0 px-3 py-2 text-[13px] font-bold outline-none"
            style={{ background: '#f8fafc', borderRadius: 10, color: FR.text }}
          />
          <button
            onClick={handleAdd}
            disabled={sending || !username.trim()}
            aria-label="Send friend request"
            className="px-4 py-2 rounded-full text-[12px] font-black text-white disabled:opacity-50 flex items-center gap-1.5"
            style={{ background: FR.solid }}
          >
            <Icon3D name="add-friend" size={17} /> ADD
          </button>
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
                      setNote(r.status === 'accepted' ? 'You’re now friends! 🎉' : `Request sent to ${u.username} 🤝`);
                      setUsername('');
                    }
                  } finally {
                    setSending(false);
                  }
                }}
                className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-xl text-left hover:opacity-80 transition-opacity"
                style={{ background: '#f8f7ff' }}
              >
                <FriendAvatar name={u.username} url={u.avatar_url} emoji={u.avatar_emoji} size={30} />
                <span className="flex-1 min-w-0 text-xs font-extrabold truncate" style={{ color: FR.text }}>{u.username}</span>
                <span className="text-[10px] font-bold" style={{ color: FR.label }}>Lvl {u.level}</span>
                <Icon3D name="add-friend" size={17} />
              </button>
            ))}
          </div>
        )}
        <button
          onClick={shareInvite}
          className="flex items-center gap-1.5 text-[11px] font-black hover:opacity-80 transition-opacity"
          style={{ color: FR.mid }}
        >
          <Send className="w-3.5 h-3.5" /> Share invite link
        </button>
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
          style={{ background: 'rgba(15,23,42,0.45)' }}
          onClick={() => { setTauntTarget(null); setTauntStatus(null); }}
        >
          <div className="w-full max-w-sm overflow-hidden" style={{ background: '#ffffff', borderRadius: 16 }} onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3">
              <p className="text-[11px] font-black uppercase" style={{ color: FR.label, letterSpacing: 1.2 }}>Nudge {tauntTarget.username}</p>
            </div>
            {tauntStatus ? (
              <div className="p-6 text-center text-sm font-extrabold" style={{ color: FR.text }}>{tauntStatus}</div>
            ) : (
              <div>
                {FRIEND_TAUNTS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => fireTaunt(t.id)}
                    className="w-full text-left px-4 py-3 text-xs font-extrabold transition-colors hover:opacity-80"
                    style={{ color: FR.text, borderTop: '1px solid #f1f5f9' }}
                  >
                    {t.text}
                  </button>
                ))}
                <button onClick={() => setTauntTarget(null)} className="w-full px-4 py-3 text-xs font-extrabold" style={{ color: FR.label, borderTop: '1px solid #f1f5f9' }}>
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {unfriendTarget && (
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4"
          style={{ background: 'rgba(15,23,42,0.45)' }}
          onClick={() => setUnfriendTarget(null)}
        >
          <div className="w-full max-w-sm overflow-hidden" style={{ background: '#ffffff', borderRadius: 16 }} onClick={(e) => e.stopPropagation()}>
            <p className="px-4 pt-4 pb-3 text-sm font-extrabold" style={{ color: FR.text }}>
              Unfriend {unfriendTarget.username}? You can re-add them anytime.
            </p>
            <div className="flex" style={{ borderTop: '1px solid #f1f5f9' }}>
              <button onClick={() => setUnfriendTarget(null)} className="flex-1 px-4 py-3 text-xs font-extrabold" style={{ color: FR.label }}>Cancel</button>
              <button
                onClick={async () => {
                  const f = unfriendTarget;
                  setUnfriendTarget(null);
                  await removeFriend(f.id);
                }}
                className="flex-1 px-4 py-3 text-xs font-black"
                style={{ color: '#dc2626', borderLeft: '1px solid #f1f5f9' }}
              >
                Unfriend
              </button>
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
      <span className="ml-auto text-sm font-black" style={{ color: FR.solid }}>→</span>
    </Link>
  );
}
