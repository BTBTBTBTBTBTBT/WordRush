'use client';

// FRIENDS (§207) — the Friends card on the OWN profile page: friends list
// with counts, incoming requests (Accept / Decline), and the Add-by-username
// field. Same card shell + type scale as the referral InvitePanel next to it.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Users, UserPlus, Check, X, Bell, Send, ChevronRight, MoreHorizontal } from 'lucide-react';
import { FRIEND_TAUNTS } from '@/lib/friends-taunts';
import { useAuth } from '@/lib/auth-context';
import {
  loadFriends,
  getFriends,
  getIncoming,
  getOutgoing,
  acceptFriend,
  declineFriend,
  requestFriend,
  onFriendsChange,
  searchUsers,
  isFriend,
  hasRequested,
  getMeDigest,
  remindFriend,
  removeFriend,
  sendTaunt,
  type FriendProfile,
} from '@/lib/friends-service';

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

function Avatar({ f }: { f: FriendProfile }) {
  if (f.avatar_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={f.avatar_url} alt={f.username} className="w-8 h-8 rounded-full object-cover" />;
  }
  // Chosen emoji beats the initial (Aug 11 — profile-avatar parity).
  const emoji = f.avatar_emoji?.trim();
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black"
      style={{ background: '#7c3aed22', color: '#7c3aed' }}
    >
      {emoji || f.username.charAt(0).toUpperCase()}
    </div>
  );
}

export function FriendsPanel() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [, force] = useState(0);
  const [username, setUsername] = useState('');
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [inviteNote, setInviteNote] = useState<string | null>(null);
  // The note is a transient confirmation — the row's "Reminded" pill carries
  // the durable state, so this clears itself (founder: it "just lingered").
  // 2.5s matches the Android panel's existing auto-dismiss.
  useEffect(() => {
    if (!inviteNote) return;
    const t = setTimeout(() => setInviteNote(null), 2500);
    return () => clearTimeout(t);
  }, [inviteNote]);
  // Typeahead (Aug 11): type 2+ letters → matching users, so invites go to
  // the right Carlie instead of a blind exact-match fire.
  const [suggestions, setSuggestions] = useState<FriendProfile[]>([]);
  // §212: one-tap taunts from friend rows (same picker as the leaderboard).
  const [tauntTarget, setTauntTarget] = useState<FriendProfile | null>(null);
  const [tauntStatus, setTauntStatus] = useState<string | null>(null);
  // §225: per-row kebab menu — unfriending used to be reachable only from
  // the friend's profile page, so it effectively didn't exist. The menu
  // puts View profile / Taunt / Unfriend one quiet tap away.
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [unfriendTarget, setUnfriendTarget] = useState<FriendProfile | null>(null);
  // Any click outside the open menu dismisses it (menu clicks stopPropagation).
  useEffect(() => {
    if (!menuFor) return;
    const close = () => setMenuFor(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [menuFor]);

  useEffect(() => {
    if (!user) return;
    loadFriends().then(() => force((v) => v + 1));
    return onFriendsChange(() => force((v) => v + 1));
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

  if (!user) return null;

  const friends = getFriends();
  const incoming = getIncoming();
  const outgoing = getOutgoing();

  // Weekly race podium (§212): me + friends by this week's daily points.
  const meDigest = getMeDigest();
  const podium = (() => {
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
    // Always on (§216): a Monday-morning zero-point podium still shows the
    // race — medals wait for the first score (see raceStarted below).
    entries.sort((a, b) => b.pts - a.pts);
    return entries.slice(0, 3);
  })();
  const raceStarted = podium.some((e) => e.pts > 0);

  // §216: the week's leader wears the crown on roster rows (and on the
  // friends leaderboard) — only once someone has actually scored.
  const crownId = raceStarted ? podium[0].id : null;

  // §218: when the weekly race closes — weeks run Mon–Sun, reset Monday
  // 00:00 local (same boundary as weekStart in the friends digest).
  const weekEndsLabel = (() => {
    const dow = new Date().getDay(); // 0 Sun … 6 Sat
    const daysLeft = dow === 0 ? 1 : 8 - dow; // Mon→7 … Sat→2, Sun→1
    return daysLeft === 1 ? 'ends tonight' : `ends Sunday · ${daysLeft}d left`;
  })();

  // §216: "topped N of M friends today" — my day total vs each friend's.
  const myToday = meDigest?.todayPoints ?? 0;
  const toppedCount = myToday > 0
    ? friends.filter((f) => (f.todayPoints ?? 0) < myToday).length
    : 0;

  // §216: friendversary chip on milestone days.
  const friendversary = (f: FriendProfile): number | null => {
    if (!f.since) return null;
    const t = Date.parse(f.since);
    if (!Number.isFinite(t)) return null;
    const days = Math.floor((Date.now() - t) / 86_400_000);
    return [7, 30, 100, 365].includes(days) ? days : null;
  };

  // §216: one tap nudges every friend who hasn't played today (server still
  // enforces 1 taunt per friend per day).
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

  // §225: typing a username assumes the friend is already here — the share
  // link is the door for friends who aren't on Wordocious yet. Native share
  // sheet where the platform has one, clipboard + transient note elsewhere.
  const shareInvite = async () => {
    const myId = profile?.id ?? user.id;
    const text = `Add me on Wordocious — I'm ${profile?.username ?? ''}`.trim();
    const url = `https://wordocious.com/profile/${myId}`;
    if (typeof navigator.share === 'function') {
      try { await navigator.share({ text, url }); } catch { /* user closed the sheet */ }
      return;
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setNote('Link copied'); // auto-dismisses in 2.5s (§224)
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
      if ('error' in r) {
        setNote(r.error);
      } else {
        setNote(r.status === 'accepted' ? 'You’re now friends! 🎉' : 'Request sent 🤝');
        setUsername('');
      }
    } finally {
      setSending(false);
    }
  };

  return (
    // Two cards (founder ask, Aug 17): requests in flight moved out of the
    // FRIENDS box into their own INVITES card — the roster reads finished
    // even while invites are pending.
    <div className="space-y-3.5">
    <div
      className="p-5 space-y-4"
      style={{ background: 'var(--color-surface)', border: '1.5px solid #c4b5fd', borderRadius: '20px' }}
    >
      <div className="flex items-center gap-2">
        <Users className="w-5 h-5" style={{ color: '#7c3aed' }} />
        <h3
          className="text-base font-black tracking-tight text-transparent bg-clip-text"
          style={{ backgroundImage: 'linear-gradient(135deg, #7c3aed, #ec4899)' }}
        >
          FRIENDS
        </h3>
        {friends.length > 0 && (
          <span className="text-xs font-black" style={{ color: 'var(--color-text-muted)' }}>
            {friends.length}
          </span>
        )}
        {/* §216: one-tap nudge for everyone who hasn't played today. */}
        {slackers.length > 0 && (
          <button
            onClick={nudgeAll}
            aria-label="Nudge all friends who haven't played today"
            className="ml-auto text-[10px] font-bold px-2 py-1 rounded-lg"
            style={{ background: '#7c3aed18', border: '1.5px solid #c4b5fd', color: '#7c3aed' }}
          >
            🔔 Nudge slackers
          </button>
        )}
      </div>

      {/* Weekly race podium (§212) — who owns the week among your circle. */}
      {podium.length > 0 && (
        <div>
          {/* §218 (founder ask): the podium is the WEEKLY race, but bare "pts"
              read as today's score — name the window and when it closes. */}
          <div className="flex items-center justify-between text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
            <span className="font-black uppercase tracking-wider">This week&apos;s race</span>
            <span>{weekEndsLabel}</span>
          </div>
          <div className="flex items-end justify-center gap-5 py-2">
            {[1, 0, 2].filter((i) => i < podium.length).map((i) => {
              const e = podium[i];
              const medal = ['🥇', '🥈', '🥉'][i];
              return (
                // §225: podium columns are doors to the profiles too — same
                // dead-tap complaint as the roster rows below.
                <Link
                  key={e.id}
                  href={e.me ? '/profile' : `/profile/${e.id}`}
                  className={`flex flex-col items-center gap-0.5 hover:opacity-80 transition-opacity ${i === 0 ? '-mt-2' : ''}`}
                >
                  {/* Medals wait for the first score of the week (§216). */}
                  <span className={i === 0 ? 'text-lg' : 'text-sm'}>{raceStarted ? medal : '🏁'}</span>
                  <Avatar f={e as unknown as FriendProfile} />
                  {/* §225: 9px + 80px fits ~14 chars before the ellipsis —
                      "TheRealMich..." at 10px/72px cut the founder's name. */}
                  <span className="text-[9px] font-black truncate max-w-[80px]"
                    style={{ color: e.me ? '#7c3aed' : 'var(--color-text)' }}>
                    {e.username}
                  </span>
                  <span className="text-[9px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
                    {e.pts.toLocaleString()} pts
                  </span>
                </Link>
              );
            })}
          </div>
          {!raceStarted && (
            <p className="text-center text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
              Race resets Mondays — first daily takes the lead.
            </p>
          )}
        </div>
      )}

      {/* §216: today's race — how many friends you've topped so far. */}
      {myToday > 0 && friends.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
            <span>TODAY&apos;S RACE</span>
            <span>topped {toppedCount} of {friends.length} friend{friends.length === 1 ? '' : 's'}</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-hover)' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${Math.round((toppedCount / friends.length) * 100)}%`, background: 'linear-gradient(90deg, #7c3aed, #ec4899)' }}
            />
          </div>
        </div>
      )}

      {/* Friends list (§212) — live rows: today's progress, streak, H2H
          record, say-hi on NEW friendships, taunt bell for slackers. */}
      {friends.length > 0 ? (
        <div className="space-y-2.5">
          {friends.map((f) => {
            const played = f.playedToday ?? undefined;
            const record = (f.h2hW ?? 0) + (f.h2hL ?? 0) > 0
              ? ((f.h2hW ?? 0) >= (f.h2hL ?? 0) ? `${f.h2hW}–${f.h2hL} you` : `${f.h2hL}–${f.h2hW} them`)
              : null;
            return (
              // §225 (founder's dead-tap report): the WHOLE row navigates to
              // the friend's profile, not just the name — taps on the Lvl
              // label or the gaps used to go nowhere. Real controls (bell,
              // say-hi, kebab) handle themselves and stop the row tap.
              <div
                key={f.id}
                className="flex items-center gap-2.5 cursor-pointer"
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest('a,button')) return;
                  router.push(`/profile/${f.id}`);
                }}
              >
                <Link href={`/profile/${f.id}`} className="flex items-center gap-2.5 flex-1 min-w-0 hover:opacity-80 transition-opacity">
                  <Avatar f={f} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs font-extrabold truncate" style={{ color: 'var(--color-text)' }}>
                      {f.username}
                      {/* §216: the week's leader wears the crown. */}
                      {f.id === crownId && <span className="ml-1"> 👑</span>}
                      {isNewFriend(f) && (
                        <span
                          className="ml-1.5 text-[8px] font-black px-1 py-0.5 rounded align-middle"
                          style={{ background: '#7c3aed22', color: '#7c3aed' }}
                        >
                          NEW
                        </span>
                      )}
                      {/* §216: friendversary chip on milestone days. */}
                      {friendversary(f) !== null && (
                        <span
                          className="ml-1.5 text-[8px] font-black px-1 py-0.5 rounded align-middle"
                          style={{ background: '#ec489922', color: '#ec4899' }}
                        >
                          🎉 {friendversary(f)} DAYS
                        </span>
                      )}
                    </span>
                    {played !== undefined && (
                      <span className="block text-[10px] font-bold truncate" style={{ color: 'var(--color-text-muted)' }}>
                        {/* §225: show the score, not just the count — the
                            digest already ships todayPoints (§216). */}
                        {played > 0
                          ? `${played}/9 today · ${(f.todayPoints ?? 0).toLocaleString()} pts${f.streak ? ` · 🔥${f.streak}` : ''}`
                          : "hasn't played today"}
                        {record ? ` · ${record}` : ''}
                      </span>
                    )}
                  </span>
                </Link>
                {isNewFriend(f) && (
                  <button
                    onClick={(e) => { e.stopPropagation(); sayHi(f); }}
                    aria-label={`Say hi to ${f.username}`}
                    className="text-[10px] font-bold px-2 py-1 rounded-lg"
                    style={{ background: '#7c3aed18', border: '1.5px solid #c4b5fd', color: '#7c3aed' }}
                  >
                    👋 Say hi
                  </button>
                )}
                {/* §225: fixed-width slot whether or not the bell renders
                    (friends who already played show none), so the Lvl labels
                    line up in a clean column instead of jittering per row. */}
                <span className="w-7 shrink-0 flex justify-center">
                  {played === 0 && !isNewFriend(f) && (
                    <button
                      // stopPropagation: a bell tap taunts, it never navigates.
                      onClick={(e) => { e.stopPropagation(); setTauntTarget(f); }}
                      aria-label={`Taunt ${f.username}`}
                      className="w-7 h-7 rounded-full flex items-center justify-center active:scale-95 transition-transform"
                      style={{ background: 'var(--color-surface-hover)', border: '1.5px solid var(--color-border)' }}
                    >
                      <Bell className="w-3.5 h-3.5" style={{ color: '#7c3aed' }} />
                    </button>
                  )}
                </span>
                <span className="text-[10px] font-bold shrink-0" style={{ color: 'var(--color-text-muted)' }}>
                  Lvl {f.level}
                </span>
                {/* §225: the chevron is the "this row goes somewhere" cue. */}
                <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--color-text-muted)' }} />
                {/* §225 kebab: View profile / Taunt / Unfriend — unfriending
                    finally reachable without hunting for the profile page. */}
                <span className="relative shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); setMenuFor((m) => (m === f.id ? null : f.id)); }}
                    aria-label={`More options for ${f.username}`}
                    className="w-6 h-6 flex items-center justify-center rounded-lg hover:opacity-80 transition-opacity"
                  >
                    <MoreHorizontal className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
                  </button>
                  {menuFor === f.id && (
                    <div
                      className="absolute right-0 top-7 z-40 w-36 overflow-hidden"
                      style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => { setMenuFor(null); router.push(`/profile/${f.id}`); }}
                        className="w-full text-left px-3 py-2 text-xs font-extrabold hover:opacity-80"
                        style={{ color: 'var(--color-text)', borderBottom: '1px solid var(--color-border)' }}
                      >
                        View profile
                      </button>
                      <button
                        onClick={() => { setMenuFor(null); setTauntTarget(f); }}
                        className="w-full text-left px-3 py-2 text-xs font-extrabold hover:opacity-80"
                        style={{ color: 'var(--color-text)', borderBottom: '1px solid var(--color-border)' }}
                      >
                        Taunt
                      </button>
                      <button
                        onClick={() => { setMenuFor(null); setUnfriendTarget(f); }}
                        className="w-full text-left px-3 py-2 text-xs font-extrabold hover:opacity-80"
                        style={{ color: '#dc2626' }}
                      >
                        Unfriend
                      </button>
                    </div>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        incoming.length === 0 && outgoing.length === 0 && (
          <div className="space-y-1.5 text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>
            <p>1. Add friends below by username, or from the <span style={{ color: '#7c3aed' }}>Add Friend</span> button on any player&apos;s profile.</p>
            <p>2. Requests you send and receive land right here.</p>
            <p>3. Once a friend accepts, flip the leaderboard to <span style={{ color: '#7c3aed' }}>FRIENDS</span> for your own private race.</p>
          </div>
        )
      )}

      {/* Add by username — exact match, same lookup as VS invites. */}
      <div className="flex items-center gap-2">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="Add by username"
          className="flex-1 min-w-0 px-3 py-2 rounded-xl text-xs font-bold outline-none"
          style={{
            background: 'var(--color-surface-hover)',
            border: '1.5px solid var(--color-border)',
            color: 'var(--color-text)',
          }}
        />
        <button
          onClick={handleAdd}
          disabled={sending || !username.trim()}
          aria-label="Send friend request"
          className="px-3 py-2 rounded-xl text-xs font-black text-white btn-3d disabled:opacity-50 flex items-center gap-1.5"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', boxShadow: '0 4px 0 #4c1d95' }}
        >
          <UserPlus className="w-3.5 h-3.5" /> Add
        </button>
      </div>
      {/* §225: the invite door for friends who aren't on Wordocious yet —
          typing a username only works once they already have an account. */}
      <button
        onClick={shareInvite}
        className="flex items-center gap-1.5 text-[10px] font-bold hover:opacity-80 transition-opacity"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <Send className="w-3.5 h-3.5" /> Share invite link
      </button>
      {/* Typeahead results — tap sends to that exact account (by id). */}
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
              style={{ background: 'var(--color-surface-hover)', border: '1.5px solid var(--color-border)' }}
            >
              <Avatar f={u} />
              <span className="flex-1 min-w-0 text-xs font-extrabold truncate" style={{ color: 'var(--color-text)' }}>
                {u.username}
              </span>
              <span className="text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
                Lvl {u.level}
              </span>
              <UserPlus className="w-3.5 h-3.5" style={{ color: '#7c3aed' }} />
            </button>
          ))}
        </div>
      )}
      {note && (
        <p className="text-xs font-extrabold" style={{ color: 'var(--color-text-muted)' }}>{note}</p>
      )}

      {/* Taunt picker — same modal as the friends leaderboard (§207). */}
      {tauntTarget && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => { setTauntTarget(null); setTauntStatus(null); }}
        >
          <div
            className="w-full max-w-sm overflow-hidden"
            style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '16px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <p className="text-xs font-black uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                Taunt {tauntTarget.username}
              </p>
            </div>
            {tauntStatus ? (
              <div className="p-6 text-center text-sm font-extrabold" style={{ color: 'var(--color-text)' }}>
                {tauntStatus}
              </div>
            ) : (
              <div>
                {FRIEND_TAUNTS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => fireTaunt(t.id)}
                    className="w-full text-left px-4 py-3 text-xs font-extrabold transition-colors hover:opacity-80"
                    style={{ color: 'var(--color-text)', borderBottom: '1px solid var(--color-border)' }}
                  >
                    {t.text}
                  </button>
                ))}
                <button
                  onClick={() => setTauntTarget(null)}
                  className="w-full px-4 py-3 text-xs font-extrabold"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* §225: unfriend confirm — a mis-tap on a destructive menu item
          shouldn't cost a friendship (re-adding takes a whole new request
          round trip). Same modal shell as the taunt picker above. */}
      {unfriendTarget && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setUnfriendTarget(null)}
        >
          <div
            className="w-full max-w-sm overflow-hidden"
            style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '16px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="px-4 pt-4 pb-3 text-sm font-extrabold" style={{ color: 'var(--color-text)' }}>
              Unfriend {unfriendTarget.username}? You can re-add them anytime.
            </p>
            <div className="flex" style={{ borderTop: '1px solid var(--color-border)' }}>
              <button
                onClick={() => setUnfriendTarget(null)}
                className="flex-1 px-4 py-3 text-xs font-extrabold"
                style={{ color: 'var(--color-text-muted)' }}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const f = unfriendTarget;
                  setUnfriendTarget(null);
                  // Optimistic mutator — the roster refreshes via onFriendsChange.
                  await removeFriend(f.id);
                }}
                className="flex-1 px-4 py-3 text-xs font-black"
                style={{ color: '#dc2626', borderLeft: '1px solid var(--color-border)' }}
              >
                Unfriend
              </button>
            </div>
          </div>
        </div>
      )}
    </div>

    {/* INVITES card — requests in flight (incoming + sent), split out of the
        FRIENDS card so the roster reads finished (founder ask, Aug 17).
        Renders only when something is actually pending. */}
    {(incoming.length > 0 || outgoing.length > 0) && (
      <div
        className="p-5 space-y-4"
        style={{ background: 'var(--color-surface)', border: '1.5px solid #c4b5fd', borderRadius: '20px' }}
      >
        <div className="flex items-center gap-2">
          <Send className="w-4 h-4" style={{ color: '#7c3aed' }} />
          <h3
            className="text-base font-black tracking-tight text-transparent bg-clip-text"
            style={{ backgroundImage: 'linear-gradient(135deg, #7c3aed, #ec4899)' }}
          >
            INVITES
          </h3>
          <span className="text-xs font-black" style={{ color: 'var(--color-text-muted)' }}>
            {incoming.length + outgoing.length}
          </span>
        </div>

        {/* Incoming requests first — they're the actionable part. */}
        {incoming.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
              Friend requests
            </p>
            {incoming.map((r) => (
              <div key={r.id} className="flex items-center gap-2.5">
                <Avatar f={r} />
                <Link
                  href={`/profile/${r.id}`}
                  className="flex-1 min-w-0 text-xs font-extrabold truncate hover:opacity-80 transition-opacity"
                  style={{ color: 'var(--color-text)' }}
                >
                  {r.username}
                </Link>
                <button
                  onClick={() => acceptFriend(r.id)}
                  aria-label={`Accept ${r.username}`}
                  className="w-7 h-7 rounded-full flex items-center justify-center active:scale-95 transition-transform"
                  style={{ background: '#7c3aed', color: '#ffffff' }}
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => declineFriend(r.id)}
                  aria-label={`Decline ${r.username}`}
                  className="w-7 h-7 rounded-full flex items-center justify-center active:scale-95 transition-transform"
                  style={{ background: 'var(--color-surface-hover)', border: '1.5px solid var(--color-border)', color: 'var(--color-text-muted)' }}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Sent requests — the loop's missing feedback (Tier 1, Aug 11):
            sending a request now visibly puts something here, with a cancel. */}
        {outgoing.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
              Sent — waiting
            </p>
            {outgoing.map((r) => (
              <div key={r.id} className="flex items-center gap-2.5">
                <Avatar f={r} />
                <Link
                  href={`/profile/${r.id}`}
                  className="flex-1 min-w-0 text-xs font-extrabold truncate hover:opacity-80 transition-opacity"
                  style={{ color: 'var(--color-text)' }}
                >
                  {r.username}{' '}
                  <span className="font-bold text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                    · {agoShort(r.requestedAt)}
                  </span>
                </Link>
                {/* §212: the invite usually died unseen — re-push, 1/24h. */}
                <button
                  onClick={async () => {
                    const res = await remindFriend(r.id);
                    setInviteNote('error' in res && res.error ? res.error : `Reminder sent to ${r.username} 🔔`);
                  }}
                  disabled={withinDay(r.remindedAt)}
                  aria-label={`Remind ${r.username}`}
                  className="text-[10px] font-bold px-2 py-1 rounded-lg disabled:opacity-50"
                  style={{ background: '#7c3aed18', border: '1.5px solid #c4b5fd', color: '#7c3aed' }}
                >
                  {withinDay(r.remindedAt) ? 'Reminded' : 'Remind'}
                </button>
                <button
                  onClick={() => declineFriend(r.id)}
                  aria-label={`Cancel request to ${r.username}`}
                  className="text-[10px] font-bold px-2 py-1 rounded-lg"
                  style={{ background: 'var(--color-surface-hover)', border: '1.5px solid var(--color-border)', color: 'var(--color-text-muted)' }}
                >
                  Cancel
                </button>
              </div>
            ))}
          </div>
        )}

        {inviteNote && (
          <p
            className="text-xs font-extrabold cursor-pointer"
            style={{ color: 'var(--color-text-muted)' }}
            onClick={() => setInviteNote(null)}
          >
            {inviteNote}
          </p>
        )}
      </div>
    )}
    </div>
  );
}


/**
 * Compact "Friends (N) →" row for the profile page (Tier 3, Aug 11) — the
 * full card moved to /friends; this is the door, with the request badge.
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
  const pending = getIncoming().length;
  return (
    <Link
      href="/friends"
      className="flex items-center gap-2.5 p-4 hover:opacity-90 transition-opacity"
      style={{ background: 'var(--color-surface)', border: '1.5px solid #c4b5fd', borderRadius: '20px' }}
    >
      <Users className="w-5 h-5" style={{ color: '#7c3aed' }} />
      <span
        className="text-base font-black tracking-tight text-transparent bg-clip-text"
        style={{ backgroundImage: 'linear-gradient(135deg, #7c3aed, #ec4899)' }}
      >
        FRIENDS
      </span>
      {count > 0 && (
        <span className="text-xs font-black" style={{ color: 'var(--color-text-muted)' }}>{count}</span>
      )}
      {pending > 0 && (
        <span
          className="text-[10px] font-black px-1.5 py-0.5 rounded-full"
          style={{ background: '#dc2626', color: '#fff' }}
          aria-label={`${pending} pending friend requests`}
        >
          {pending}
        </span>
      )}
      <span className="ml-auto text-sm font-black" style={{ color: '#7c3aed' }}>→</span>
    </Link>
  );
}
